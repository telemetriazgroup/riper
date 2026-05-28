import { randomUUID } from 'node:crypto';
import { pool } from './db.js';
import { sendEthyleneInjectionCommand, sendTunnelControlCommand } from './tunelControlClient.js';
import { fetchDeviceRowByImei, readTelemetryField } from './tunnelCommandTelemetry.js';

export const ETHYLENE_VERIFY_DELAY_MS = 4 * 60 * 1000;
export const SIMPLE_VERIFY_DELAY_MS = 30 * 1000;
export const POLL_INTERVAL_MS = 15 * 1000;

const KIND_CONFIG = {
  temperature: { tunnelTipo: 1, verifyField: 'set_point', tolerance: 0.3 },
  humidity: { tunnelTipo: 2, verifyField: 'humidity_set_point', tolerance: 1 },
  ventilation: { tunnelTipo: 6, verifyField: 'avl', tolerance: 2 },
  ethylene: { tunnelTipo: 5, verifyField: 'campo_1', tolerance: 0.5 },
};

function nowIso() {
  return new Date().toISOString();
}

function appendStep(steps, entry) {
  const arr = Array.isArray(steps) ? [...steps] : [];
  arr.push({ at: nowIso(), ...entry });
  return arr;
}

function valuesMatch(actual, target, tolerance) {
  if (actual == null || !Number.isFinite(actual)) return false;
  return Math.abs(actual - target) <= tolerance;
}

/** Etileno: cumplido cuando lectura >= objetivo (con tolerancia inferior). */
function ethyleneTargetReached(actual, target, tolerance) {
  if (actual == null || !Number.isFinite(actual)) return false;
  return actual >= target - tolerance;
}

async function updateJob(id, patch) {
  const fields = [];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'steps' || k === 'meta') {
      fields.push(`${k} = $${i++}::jsonb`);
      vals.push(JSON.stringify(v ?? (k === 'steps' ? [] : {})));
    } else {
      fields.push(`${k} = $${i++}`);
      vals.push(v);
    }
  }
  fields.push('updated_at = now()');
  vals.push(id);
  await pool.query(`UPDATE app_tunnel_command_jobs SET ${fields.join(', ')} WHERE id = $${i}`, vals);
}

/**
 * @param {{ client?: import('pg').PoolClient, userId: string, deviceId: string, commands: Record<string, number> }} opts
 */
export async function createTunnelCommandJobs({ client, userId, deviceId, commands }) {
  const db = client ?? pool;
  const batchId = randomUUID();
  const jobs = [];

  for (const [kind, cfg] of Object.entries(KIND_CONFIG)) {
    const raw = commands[kind];
    if (raw == null || raw === '') continue;
    const target = Number(raw);
    if (!Number.isFinite(target)) continue;

    const { rows } = await db.query(
      `INSERT INTO app_tunnel_command_jobs
         (user_id, device_id, batch_id, kind, target_value, status, tunnel_tipo, verify_field, tolerance, meta)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [
        userId,
        deviceId,
        batchId,
        kind,
        target,
        cfg.tunnelTipo,
        cfg.verifyField,
        cfg.tolerance,
        JSON.stringify(kind === 'ethylene' ? { ethyleneTargetPpm: target } : {}),
      ]
    );
    jobs.push(rows[0]);
  }

  return { batchId, jobs };
}

async function dispatchInitialSend(job) {
  const imei = job.device_id;
  const target = Number(job.target_value);
  let steps = job.steps ?? [];

  try {
    if (job.kind === 'ethylene') {
      const sent = await sendEthyleneInjectionCommand(imei, target);
      steps = appendStep(steps, {
        action: 'send_ethylene',
        ppm: sent.ppm,
        urls: sent.steps.map((s) => s.url),
      });
      const nextCheck = new Date(Date.now() + ETHYLENE_VERIFY_DELAY_MS);
      await updateJob(job.id, {
        status: 'waiting',
        steps,
        next_check_at: nextCheck.toISOString(),
        attempts: 1,
      });
      return;
    }

    const sent = await sendTunnelControlCommand(imei, job.tunnel_tipo, target);
    steps = appendStep(steps, {
      action: 'send',
      tipo: job.tunnel_tipo,
      dato: target,
      url: sent.url,
    });
    const nextCheck = new Date(Date.now() + SIMPLE_VERIFY_DELAY_MS);
    await updateJob(job.id, {
      status: 'verifying',
      steps,
      next_check_at: nextCheck.toISOString(),
      attempts: 1,
    });
  } catch (e) {
    steps = appendStep(steps, { action: 'error', message: String(e.message) });
    await updateJob(job.id, {
      status: 'failed',
      steps,
      last_error: String(e.message),
      completed_at: nowIso(),
    });
  }
}

async function verifySimpleJob(job, row) {
  const target = Number(job.target_value);
  const tolerance = Number(job.tolerance);
  const actual = readTelemetryField(row, job.verify_field);
  let steps = appendStep(job.steps ?? [], {
    action: 'read',
    field: job.verify_field,
    value: actual,
    target,
  });

  if (valuesMatch(actual, target, tolerance)) {
    await updateJob(job.id, {
      status: 'completed',
      steps: appendStep(steps, { action: 'completed', reason: 'target_reached' }),
      last_read_value: actual,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  const attempts = Number(job.attempts) + 1;
  if (attempts >= Number(job.max_attempts)) {
    await updateJob(job.id, {
      status: 'failed',
      steps: appendStep(steps, { action: 'failed', reason: 'max_attempts' }),
      last_read_value: actual,
      attempts,
      last_error: `No alcanzó objetivo (${job.verify_field}=${actual}, target=${target})`,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  const nextCheck = new Date(Date.now() + SIMPLE_VERIFY_DELAY_MS);
  await updateJob(job.id, {
    status: 'verifying',
    steps,
    last_read_value: actual,
    attempts,
    next_check_at: nextCheck.toISOString(),
  });
}

async function verifyEthyleneJob(job, row) {
  const target = Number(job.target_value);
  const tolerance = Number(job.tolerance);
  const actual = readTelemetryField(row, 'campo_1');
  let steps = appendStep(job.steps ?? [], {
    action: 'read_ethylene',
    field: 'campo_1',
    value: actual,
    target,
  });

  if (ethyleneTargetReached(actual, target, tolerance)) {
    await updateJob(job.id, {
      status: 'completed',
      steps: appendStep(steps, { action: 'completed', reason: 'ethylene_target_reached' }),
      last_read_value: actual,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  const delta = Math.max(0, Math.round(target - (actual ?? 0)));
  const attempts = Number(job.attempts) + 1;

  if (delta <= 0) {
    await updateJob(job.id, {
      status: 'completed',
      steps: appendStep(steps, { action: 'completed', reason: 'ethylene_no_delta_needed' }),
      last_read_value: actual,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  if (attempts >= Number(job.max_attempts)) {
    await updateJob(job.id, {
      status: 'failed',
      steps: appendStep(steps, { action: 'failed', reason: 'max_attempts' }),
      last_read_value: actual,
      attempts,
      last_error: `Etileno no alcanzó ${target} ppm (lectura ${actual})`,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  try {
    const sent = await sendEthyleneInjectionCommand(job.device_id, delta);
    steps = appendStep(steps, {
      action: 'retry_ethylene',
      deltaPpm: delta,
      readPpm: actual,
      urls: sent.steps.map((s) => s.url),
    });
    const nextCheck = new Date(Date.now() + ETHYLENE_VERIFY_DELAY_MS);
    await updateJob(job.id, {
      status: 'waiting',
      steps,
      last_read_value: actual,
      attempts,
      next_check_at: nextCheck.toISOString(),
    });
  } catch (e) {
    await updateJob(job.id, {
      status: 'failed',
      steps: appendStep(steps, { action: 'error', message: String(e.message) }),
      last_error: String(e.message),
      completed_at: nowIso(),
      next_check_at: null,
    });
  }
}

async function processOneJob(job) {
  if (job.status === 'pending') {
    await dispatchInitialSend(job);
    return;
  }

  if (job.status !== 'verifying' && job.status !== 'waiting') return;

  const row = await fetchDeviceRowByImei(job.device_id);
  if (!row) {
    const attempts = Number(job.attempts) + 1;
    if (attempts >= Number(job.max_attempts)) {
      await updateJob(job.id, {
        status: 'failed',
        attempts,
        last_error: 'Sin telemetría del dispositivo',
        completed_at: nowIso(),
        next_check_at: null,
      });
      return;
    }
    const nextCheck = new Date(
      Date.now() + (job.kind === 'ethylene' ? ETHYLENE_VERIFY_DELAY_MS : SIMPLE_VERIFY_DELAY_MS)
    );
    await updateJob(job.id, {
      attempts,
      next_check_at: nextCheck.toISOString(),
      last_error: 'Sin telemetría del dispositivo',
    });
    return;
  }

  if (job.kind === 'ethylene') {
    await verifyEthyleneJob(job, row);
  } else {
    await verifySimpleJob(job, row);
  }
}

/** Procesa trabajos pendientes o en verificación cuyo next_check_at ya venció. */
export async function processTunnelCommandJobs(limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM app_tunnel_command_jobs
     WHERE status IN ('pending', 'verifying', 'waiting')
       AND (next_check_at IS NULL OR next_check_at <= now())
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  for (const job of rows) {
    try {
      await processOneJob(job);
    } catch (e) {
      console.error('[tunnel-compliance]', job.id, e.message);
      await updateJob(job.id, {
        status: 'failed',
        last_error: String(e.message),
        completed_at: nowIso(),
        next_check_at: null,
      }).catch(() => {});
    }
  }

  return rows.length;
}

/** Tras crear jobs, dispara envío inicial inmediato. */
export async function kickoffTunnelCommandBatch(batchId) {
  const { rows } = await pool.query(
    `SELECT * FROM app_tunnel_command_jobs WHERE batch_id = $1 AND status = 'pending' ORDER BY created_at`,
    [batchId]
  );
  for (const job of rows) {
    await processOneJob(job);
  }
}

export async function listTunnelCommandJobs({ deviceId, batchId, activeOnly, limit = 50 }) {
  const clauses = [];
  const vals = [];
  let i = 1;

  if (deviceId) {
    clauses.push(`device_id = $${i++}`);
    vals.push(deviceId);
  }
  if (batchId) {
    clauses.push(`batch_id = $${i++}`);
    vals.push(batchId);
  }
  if (activeOnly) {
    clauses.push(`status IN ('pending', 'sent', 'verifying', 'waiting')`);
  }
  vals.push(limit);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM app_tunnel_command_jobs ${where} ORDER BY created_at DESC LIMIT $${i}`,
    vals
  );
  return rows;
}
