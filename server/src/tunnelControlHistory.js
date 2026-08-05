import { pool } from './db.js';

function nowIso() {
  return new Date().toISOString();
}

function lastStepSummary(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const s = steps[steps.length - 1];
  if (!s || typeof s !== 'object') return null;
  const { at, action, ...rest } = s;
  return { at, action, ...rest };
}

function summarizeJob(job) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    target: job.target_value != null ? Number(job.target_value) : null,
    lastRead: job.last_read_value != null ? Number(job.last_read_value) : null,
    lastError: job.last_error ?? null,
    attempts: job.attempts ?? 0,
    completedAt: job.completed_at ?? null,
    meta: job.meta ?? {},
    lastStep: lastStepSummary(job.steps),
  };
}

function stepEventKey(jobId, idx, step) {
  return `${jobId}:${idx}:${step?.at ?? ''}:${step?.action ?? ''}`;
}

function buildEventLogFromJobs(jobs, prevLog = []) {
  const seen = new Set(
    (Array.isArray(prevLog) ? prevLog : []).map((e) => e?.key).filter(Boolean)
  );
  const log = Array.isArray(prevLog) ? [...prevLog] : [];

  for (const job of jobs) {
    const steps = Array.isArray(job.steps) ? job.steps : [];
    steps.forEach((step, idx) => {
      if (!step || typeof step !== 'object') return;
      const key = stepEventKey(job.id, idx, step);
      if (seen.has(key)) return;
      seen.add(key);
      const detail = { ...step, action: undefined, at: undefined };
      // Objetivo del job de control (etileno/temp/etc.) para explicar la decisión en bitácora.
      if (detail.target == null && job.target_value != null && Number.isFinite(Number(job.target_value))) {
        detail.target = Number(job.target_value);
      }
      if (
        detail.lastReading == null &&
        job.last_read_value != null &&
        Number.isFinite(Number(job.last_read_value))
      ) {
        detail.lastReading = Number(job.last_read_value);
      }
      log.push({
        key,
        at: step.at ?? null,
        jobId: job.id,
        kind: job.kind,
        action: step.action ?? null,
        target: detail.target ?? null,
        detail,
      });
    });
  }

  return log.sort((a, b) => {
    const ta = a?.at ? new Date(a.at).getTime() : 0;
    const tb = b?.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });
}

function deriveOverallTunnelStatus(jobs) {
  if (!jobs.length) return 'unknown';
  if (jobs.some((j) => j.status === 'failed' || j.status === 'cancelled')) return 'failed';
  if (jobs.every((j) => j.status === 'completed')) return 'completed';
  if (jobs.some((j) => ['pending', 'sent', 'verifying', 'waiting'].includes(j.status))) return 'in_progress';
  return 'unknown';
}

/** Actualiza la sesión de Control de dispositivos vinculada a un lote de comandos túnel. */
export async function syncControlSessionForTunnelBatch(batchId) {
  const id = String(batchId || '').trim();
  if (!id) return;

  const { rows: jobs } = await pool.query(
    `SELECT id, kind, status, target_value, last_read_value, last_error, steps, meta,
            attempts, completed_at, updated_at
     FROM app_tunnel_command_jobs
     WHERE batch_id = $1::uuid
     ORDER BY created_at ASC`,
    [id]
  );
  if (!jobs.length) return;

  const { rows: sessions } = await pool.query(
    `SELECT id, params FROM app_device_control_sessions
     WHERE params->>'tunnelCommandBatchId' = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [id]
  );
  if (!sessions.length) return;

  const session = sessions[0];
  const prevParams =
    session.params && typeof session.params === 'object' && !Array.isArray(session.params)
      ? session.params
      : {};

  const jobSnapshots = jobs.map(summarizeJob);
  const eventLog = buildEventLogFromJobs(jobs, prevParams.tunnelEventLog);
  const overallStatus = deriveOverallTunnelStatus(jobs);

  const nextParams = {
    ...prevParams,
    source: prevParams.source ?? 'tunnel_api',
    tunnelCommandBatchId: id,
    tunnelJobs: jobSnapshots,
    tunnelEventLog: eventLog,
    tunnelOverallStatus: overallStatus,
    tunnelSyncedAt: nowIso(),
  };

  await pool.query(
    `UPDATE app_device_control_sessions
     SET params = $1::jsonb, updated_at = now()
     WHERE id = $2::uuid`,
    [JSON.stringify(nextParams), session.id]
  );
}

/** Vincula un lote recién creado a la sesión Manual más reciente del mismo dispositivo (si aún no tiene batch). */
export async function linkTunnelBatchToLatestManualSession(deviceId, batchId, jobsSummary) {
  const dev = String(deviceId || '').trim();
  const batch = String(batchId || '').trim();
  if (!dev || !batch) return;

  const { rows } = await pool.query(
    `SELECT id, params FROM app_device_control_sessions
     WHERE device_id = $1
       AND process_type = 'Manual'
       AND (params->>'tunnelCommandBatchId' IS NULL OR params->>'tunnelCommandBatchId' = '')
     ORDER BY created_at DESC
     LIMIT 1`,
    [dev]
  );
  if (!rows.length) return;

  const prev = rows[0].params && typeof rows[0].params === 'object' ? rows[0].params : {};
  await pool.query(
    `UPDATE app_device_control_sessions
     SET params = $1::jsonb, updated_at = now()
     WHERE id = $2::uuid`,
    [
      JSON.stringify({
        ...prev,
        source: 'tunnel_api',
        tunnelCommandBatchId: batch,
        tunnelJobs: jobsSummary,
        tunnelOverallStatus: 'in_progress',
        tunnelLinkedAt: nowIso(),
      }),
      rows[0].id,
    ]
  );
}
