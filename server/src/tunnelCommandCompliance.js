import { randomUUID } from 'node:crypto';
import { pool } from './db.js';
import {
  gourmetTradingStandaloneImei,
  gourmetTradingTunnelUnitImeis,
  gourmetTunnelEthyleneImei,
  isGourmetTunnelAggregateDeviceId,
} from './gourmetFleet.js';
import { syncControlSessionForTunnelBatch } from './tunnelControlHistory.js';
import {
  sendEthyleneInjectionCommand,
  sendEthylenePollCommand,
  sendTunnelControlCommand,
} from './tunelControlClient.js';
import { sendEthyleneDoseWithDeviceConfig } from './ethyleneDeviceConfig.js';
import { fetchDeviceRowByImei, readTelemetryField } from './tunnelCommandTelemetry.js';
import { resolveProcessControlAdapter } from './processControlAdapter.js';
import {
  ETHYLENE_MAX_READING,
  applyEthyleneReadingToMeta,
  computeInitialEthyleneDose,
  computeProportionalEthyleneDose,
  recordEthyleneDose,
  resolveEthyleneReading,
} from './ethyleneReading.js';

export const ETHYLENE_VERIFY_DELAY_MS = 4 * 60 * 1000;
export const ETHYLENE_POLL_INTERVAL_MS = 2 * 60 * 1000;
export const ETHYLENE_READINGS_NEEDED = 3;
export { ETHYLENE_MAX_READING } from './ethyleneReading.js';
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

function usesTunnelEthyleneAlgorithm(job) {
  if (Boolean(job.meta?.tunnelEthylene)) return true;
  if (isGourmetTunnelAggregateDeviceId(job.device_id)) return true;
  const id = String(job.device_id || '').trim();
  return id === gourmetTradingStandaloneImei() || id === gourmetTunnelEthyleneImei();
}

function resolveFanOutImeis(job) {
  const fromMeta = job.meta?.fanOutImeis;
  if (Array.isArray(fromMeta) && fromMeta.length > 0) {
    return fromMeta.map((x) => String(x).trim()).filter(Boolean);
  }
  if (isGourmetTunnelAggregateDeviceId(job.device_id)) {
    // Humedad: solo UNIT333 (867856038562796). Temp y ventilación: las 5 máquinas.
    if (job.kind === 'humidity') {
      return [gourmetTunnelEthyleneImei()];
    }
    return gourmetTradingTunnelUnitImeis();
  }
  const adapter = resolveProcessControlAdapter(job.device_id);
  if (adapter?.commandImeis) {
    const tipo = Number(job.tunnel_tipo);
    const fromAdapter = adapter.commandImeis(job.device_id, tipo);
    if (Array.isArray(fromAdapter) && fromAdapter.length > 0) {
      return fromAdapter.map((x) => String(x).trim()).filter(Boolean);
    }
  }
  if (adapter?.fanOutUnits) {
    const units = adapter.fanOutUnits(job.device_id);
    if (Array.isArray(units) && units.length > 0) {
      return units.map((x) => String(x).trim()).filter(Boolean);
    }
  }
  return [String(job.device_id).trim()];
}

/** Envía tipo/dato por flota (túnel Gourmet o TermoKing Greenyard/UltraOrganics). */
async function sendJobControlCommand(job, unitId, tipo, dato) {
  const adapter = resolveProcessControlAdapter(job.device_id);
  if (adapter?.sendCommand) {
    return adapter.sendCommand(unitId, tipo, dato);
  }
  return sendTunnelControlCommand(unitId, tipo, dato);
}

async function sendJobEthyleneDose(job, unitId, ppm) {
  const adapter = resolveProcessControlAdapter(job.device_id);
  if (adapter?.sendEthyleneDose) {
    return adapter.sendEthyleneDose(unitId, ppm);
  }
  return sendEthyleneInjectionCommand(unitId, ppm);
}

function resolveEthyleneImei(job) {
  const fromMeta = job.meta?.ethyleneImei;
  if (fromMeta) return String(fromMeta).trim();
  return gourmetTunnelEthyleneImei();
}

function isValidEthyleneReading(value, existing = []) {
  if (value == null || !Number.isFinite(value)) return false;
  if (value === 0 || value >= ETHYLENE_MAX_READING) return false;
  return !existing.some((r) => Math.abs(r - value) < 0.05);
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

  const batchRow = await pool.query(`SELECT batch_id FROM app_tunnel_command_jobs WHERE id = $1`, [id]);
  const batchId = batchRow.rows[0]?.batch_id;
  if (batchId) {
    await syncControlSessionForTunnelBatch(batchId).catch((e) =>
      console.warn('[tunnel-history] sync', batchId, e.message)
    );
  }
}

function buildJobMeta(deviceId, kind, target) {
  const meta = kind === 'ethylene' ? { ethyleneTargetPpm: target } : {};
  const id = String(deviceId || '').trim();

  if (
    kind === 'ethylene' &&
    (isGourmetTunnelAggregateDeviceId(id) ||
      id === gourmetTradingStandaloneImei() ||
      id === gourmetTunnelEthyleneImei())
  ) {
    return {
      ...meta,
      tunnelEthylene: true,
      ethyleneImei:
        id === gourmetTradingStandaloneImei() || id === gourmetTunnelEthyleneImei()
          ? id
          : gourmetTunnelEthyleneImei(),
      phase: 'init',
      readings: [],
    };
  }

  if (isGourmetTunnelAggregateDeviceId(id)) {
    if (kind === 'temperature' || kind === 'ventilation') {
      return { ...meta, fanOutImeis: gourmetTradingTunnelUnitImeis() };
    }
    if (kind === 'humidity') {
      return { ...meta, sensorImei: gourmetTunnelEthyleneImei() };
    }
  }

  const adapter = resolveProcessControlAdapter(id);
  if (adapter?.commandImeis && KIND_CONFIG[kind]) {
    const imeis = adapter.commandImeis(id, KIND_CONFIG[kind].tunnelTipo);
    if (Array.isArray(imeis) && imeis.length > 0) {
      return { ...meta, fanOutImeis: imeis };
    }
  }
  return meta;
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

    const meta = buildJobMeta(deviceId, kind, target);

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
        JSON.stringify(meta),
      ]
    );
    jobs.push(rows[0]);
  }

  return { batchId, jobs };
}

async function dispatchFanOutSimple(job) {
  const imeis = resolveFanOutImeis(job);
  const target = Number(job.target_value);
  let steps = job.steps ?? [];
  const sentUrls = [];

  try {
    for (const imei of imeis) {
      const sent = await sendJobControlCommand(job, imei, job.tunnel_tipo, target);
      sentUrls.push({ imei, url: sent.url, dato: sent.dato });
    }
    steps = appendStep(steps, {
      action: 'send_fanout',
      tipo: job.tunnel_tipo,
      dato: target,
      imeis,
      urls: sentUrls,
    });
    const nextCheck = new Date(Date.now() + SIMPLE_VERIFY_DELAY_MS);
    await updateJob(job.id, {
      status: 'verifying',
      steps,
      meta: { ...(job.meta ?? {}), fanOutImeis: imeis },
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

async function dispatchLegacyEthylene(job) {
  const imei = job.device_id;
  const target = Number(job.target_value);
  let steps = job.steps ?? [];

  try {
    const sent = await sendJobEthyleneDose(job, imei, target);
    const urls = Array.isArray(sent?.steps)
      ? sent.steps.map((s) => s.url)
      : sent?.step?.url
        ? [sent.step.url]
        : sent?.url
          ? [sent.url]
          : [];
    steps = appendStep(steps, {
      action: 'send_ethylene',
      ppm: sent?.ppm ?? target,
      urls,
    });
    const nextCheck = new Date(Date.now() + ETHYLENE_VERIFY_DELAY_MS);
    await updateJob(job.id, {
      status: 'waiting',
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

async function dispatchTunnelEthylene(job) {
  const imei = resolveEthyleneImei(job);
  const target = Number(job.target_value);
  const tolerance = Number(job.tolerance);
  let steps = job.steps ?? [];
  let meta = { ...(job.meta ?? {}), ethyleneImei: imei, readings: [], phase: 'polling' };

  try {
    const row = await fetchDeviceRowByImei(imei);
    const baselineRaw = readTelemetryField(row, 'campo_1');
    const resolved = resolveEthyleneReading(baselineRaw, meta);
    meta = applyEthyleneReadingToMeta(meta, resolved);
    const baseline = resolved.effective;

    if (baseline != null && ethyleneTargetReached(baseline, target, tolerance)) {
      await updateJob(job.id, {
        status: 'completed',
        steps: appendStep(steps, {
          action: 'completed',
          reason: 'ethylene_already_at_target',
          baseline,
          target,
        }),
        last_read_value: baseline,
        completed_at: nowIso(),
        meta,
      });
      return;
    }

    let baselineBeforeDose = baseline;
    let lastTipo5Dato = 0;

    if (baseline != null && baseline < target && resolved.canInject) {
      const dose = computeInitialEthyleneDose(baseline, target);
      const sent = await sendEthyleneDoseWithDeviceConfig(imei, dose);
      lastTipo5Dato = sent.doseLogical ?? sent.ppm;
      steps = appendStep(steps, {
        action: 'send_tipo5',
        dato: sent.doseLogical ?? sent.ppm,
        doseLogical: sent.doseLogical ?? sent.ppm,
        datoSent: sent.injectionMultiplier > 1 ? sent.datoSent : undefined,
        injectionMultiplier: sent.injectionMultiplier > 1 ? sent.injectionMultiplier : undefined,
        baselineBeforeDose: baseline,
        url: sent.step.url,
      });
      meta = recordEthyleneDose({ ...meta, baselineBeforeDose: baseline }, sent.doseLogical ?? sent.ppm, baseline);
    } else if (baseline == null) {
      await updateJob(job.id, {
        status: 'waiting',
        steps: appendStep(steps, {
          action: 'read_ethylene_poll',
          value: baselineRaw,
          reason: 'await_valid_baseline',
        }),
        meta,
        last_read_value: null,
        next_check_at: new Date(Date.now() + ETHYLENE_POLL_INTERVAL_MS).toISOString(),
        attempts: 1,
      });
      return;
    }

    await updateJob(job.id, {
      status: 'waiting',
      steps,
      meta,
      last_read_value: baselineBeforeDose,
      next_check_at: new Date(Date.now() + ETHYLENE_POLL_INTERVAL_MS).toISOString(),
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

async function dispatchInitialSend(job) {
  if (job.kind === 'ethylene') {
    if (usesTunnelEthyleneAlgorithm(job)) {
      await dispatchTunnelEthylene(job);
    } else {
      await dispatchLegacyEthylene(job);
    }
    return;
  }

  if (isGourmetTunnelAggregateDeviceId(job.device_id) || job.meta?.fanOutImeis?.length) {
    await dispatchFanOutSimple(job);
    return;
  }

  const target = Number(job.target_value);
  let steps = job.steps ?? [];

  try {
    const sent = await sendJobControlCommand(job, job.device_id, job.tunnel_tipo, target);
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

async function verifyFanOutSimpleJob(job) {
  const imeis = resolveFanOutImeis(job);
  const target = Number(job.target_value);
  const tolerance = Number(job.tolerance);
  let steps = job.steps ?? [];
  const unitResults = [];

  for (const imei of imeis) {
    const row = await fetchDeviceRowByImei(imei);
    const actual = readTelemetryField(row, job.verify_field);
    unitResults.push({ imei, actual, ok: valuesMatch(actual, target, tolerance) });
  }

  steps = appendStep(steps, {
    action: 'read_fanout',
    field: job.verify_field,
    target,
    unitResults,
  });

  const allOk = unitResults.length > 0 && unitResults.every((r) => r.ok);
  if (allOk) {
    await updateJob(job.id, {
      status: 'completed',
      steps: appendStep(steps, { action: 'completed', reason: 'all_units_reached' }),
      last_read_value: unitResults.reduce((s, r) => s + (r.actual ?? 0), 0) / unitResults.length,
      meta: { ...(job.meta ?? {}), unitResults },
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  const attempts = Number(job.attempts) + 1;
  if (attempts >= Number(job.max_attempts)) {
    const failed = unitResults.filter((r) => !r.ok).map((r) => r.imei);
    await updateJob(job.id, {
      status: 'failed',
      steps: appendStep(steps, { action: 'failed', reason: 'max_attempts', failedImeis: failed }),
      attempts,
      meta: { ...(job.meta ?? {}), unitResults },
      last_error: `Unidades sin objetivo: ${failed.join(', ')}`,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  const nextCheck = new Date(Date.now() + SIMPLE_VERIFY_DELAY_MS);
  await updateJob(job.id, {
    status: 'verifying',
    steps,
    attempts,
    meta: { ...(job.meta ?? {}), unitResults },
    next_check_at: nextCheck.toISOString(),
  });
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

async function verifyLegacyEthyleneJob(job, row) {
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
    const sent = await sendJobEthyleneDose(job, job.device_id, delta);
    const urls = Array.isArray(sent?.steps)
      ? sent.steps.map((s) => s.url)
      : sent?.step?.url
        ? [sent.step.url]
        : sent?.url
          ? [sent.url]
          : [];
    steps = appendStep(steps, {
      action: 'retry_ethylene',
      deltaPpm: delta,
      readPpm: actual,
      urls,
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

async function verifyTunnelEthyleneJob(job) {
  const imei = resolveEthyleneImei(job);
  const target = Number(job.target_value);
  const tolerance = Number(job.tolerance);
  let meta = { ...(job.meta ?? {}) };
  let steps = job.steps ?? [];
  const attempts = Number(job.attempts) + 1;

  try {
    const poll = await sendEthylenePollCommand(imei);
    steps = appendStep(steps, { action: 'poll_tipo0', url: poll.url, dato: 1 });
  } catch (e) {
    steps = appendStep(steps, { action: 'poll_error', message: String(e.message) });
  }

  const row = await fetchDeviceRowByImei(imei);
  const actualRaw = readTelemetryField(row, 'campo_1');
  const resolved = resolveEthyleneReading(actualRaw, meta);
  meta = applyEthyleneReadingToMeta(meta, resolved);

  steps = appendStep(steps, {
    action: resolved.ignoredZero ? 'read_ethylene_ignored_zero' : 'read_ethylene_poll',
    value: actualRaw,
    effective: resolved.effective,
    ignoredZero: resolved.ignoredZero,
    target,
    nonZeroReadings: [...resolved.history],
    readingsNeeded: ETHYLENE_READINGS_NEEDED,
  });

  const effective = resolved.effective;

  if (effective != null && ethyleneTargetReached(effective, target, tolerance)) {
    await updateJob(job.id, {
      status: 'completed',
      steps: appendStep(steps, { action: 'completed', reason: 'ethylene_target_reached' }),
      last_read_value: effective,
      meta,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  if (resolved.ignoredZero || meta.nonZeroReadings.length < ETHYLENE_READINGS_NEEDED) {
    if (attempts >= Number(job.max_attempts)) {
      await updateJob(job.id, {
        status: 'failed',
        steps: appendStep(steps, { action: 'failed', reason: 'max_attempts_poll' }),
        last_read_value: effective,
        attempts,
        meta,
        last_error: `No se obtuvieron ${ETHYLENE_READINGS_NEEDED} lecturas válidas de campo_1`,
        completed_at: nowIso(),
        next_check_at: null,
      });
      return;
    }
    await updateJob(job.id, {
      status: 'waiting',
      steps,
      last_read_value: effective,
      attempts,
      meta,
      next_check_at: new Date(Date.now() + ETHYLENE_POLL_INTERVAL_MS).toISOString(),
    });
    return;
  }

  const lastReading = meta.nonZeroReadings[meta.nonZeroReadings.length - 1];
  if (lastReading >= target - tolerance) {
    await updateJob(job.id, {
      status: 'completed',
      steps: appendStep(steps, { action: 'completed', reason: 'ethylene_target_reached_after_poll' }),
      last_read_value: lastReading,
      meta,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  const nextDose = computeProportionalEthyleneDose(meta, target, lastReading);

  if (nextDose <= 0 || attempts >= Number(job.max_attempts)) {
    await updateJob(job.id, {
      status: 'failed',
      steps: appendStep(steps, { action: 'failed', reason: 'max_attempts_dose' }),
      last_read_value: lastReading,
      attempts,
      meta,
      last_error: `Etileno no alcanzó ${target} ppm (lectura ${lastReading})`,
      completed_at: nowIso(),
      next_check_at: null,
    });
    return;
  }

  try {
    const previousBaseline = Number(meta.baselineBeforeDose ?? lastReading);
    const observedIncrement = lastReading - previousBaseline;
    const sent = await sendEthyleneDoseWithDeviceConfig(imei, nextDose);
    meta = recordEthyleneDose({ ...meta, baselineBeforeDose: lastReading }, sent.doseLogical ?? sent.ppm, lastReading);
    meta.readings = [];
    meta.nonZeroReadings = [];
    steps = appendStep(steps, {
      action: 'send_tipo5_proportional',
      dato: sent.doseLogical ?? sent.ppm,
      doseLogical: sent.doseLogical ?? sent.ppm,
      datoSent: sent.injectionMultiplier > 1 ? sent.datoSent : undefined,
      injectionMultiplier: sent.injectionMultiplier > 1 ? sent.injectionMultiplier : undefined,
      baselineBeforeDose: previousBaseline,
      lastReading,
      observedIncrement,
      remaining: target - lastReading,
      url: sent.step.url,
    });
    await updateJob(job.id, {
      status: 'waiting',
      steps,
      last_read_value: lastReading,
      attempts,
      meta,
      next_check_at: new Date(Date.now() + ETHYLENE_POLL_INTERVAL_MS).toISOString(),
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

  if (job.kind === 'ethylene') {
    if (usesTunnelEthyleneAlgorithm(job)) {
      await verifyTunnelEthyleneJob(job);
      return;
    }
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
      await updateJob(job.id, {
        attempts,
        next_check_at: new Date(Date.now() + ETHYLENE_VERIFY_DELAY_MS).toISOString(),
        last_error: 'Sin telemetría del dispositivo',
      });
      return;
    }
    await verifyLegacyEthyleneJob(job, row);
    return;
  }

  if (isGourmetTunnelAggregateDeviceId(job.device_id) || job.meta?.fanOutImeis?.length) {
    await verifyFanOutSimpleJob(job);
    return;
  }

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
    await updateJob(job.id, {
      attempts,
      next_check_at: new Date(Date.now() + SIMPLE_VERIFY_DELAY_MS).toISOString(),
      last_error: 'Sin telemetría del dispositivo',
    });
    return;
  }

  await verifySimpleJob(job, row);
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
