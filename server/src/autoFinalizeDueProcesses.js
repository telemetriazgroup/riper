import { pool } from './db.js';

/** Fin programado UTC (ms) desde scheduleSummary del seguimiento, o null si no se puede inferir fin. */
export function getRipeningEstimatedEndMs(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const schedule = payload.scheduleSummary || {};
  const s = schedule.startedAt;
  if (!s) return null;
  const start = new Date(String(s)).getTime();
  if (!Number.isFinite(start)) return null;
  const totalHours = Number(schedule.totalDurationHours) || 0;
  const est = schedule.estimatedEndAt;
  let endMs;
  if (est) {
    const e = new Date(String(est)).getTime();
    endMs = Number.isFinite(e) ? e : null;
  } else   if (totalHours > 0) {
    endMs = start + totalHours * 3600 * 1000;
  } else {
    return null;
  }
  return endMs;
}

let lastRipeningFinalize = 0;
let lastDcFinalize = 0;
const DEBOUNCE_MS = 4000;

/**
 * Pasar seguimientos `active` a `completed` cuando ya venció el fin programado
 * (`estimatedEndAt` o `startedAt` + duración horas).
 */
export async function finalizeDueRipeningProcesses() {
  const { rows } = await pool.query(
    `SELECT id, payload FROM app_ripening_processes
     WHERE deleted_at IS NULL AND status = 'active'`
  );
  const now = Date.now();
  const ids = [];
  for (const row of rows) {
    const end = getRipeningEstimatedEndMs(row.payload);
    if (end != null && now >= end) ids.push(row.id);
  }
  if (!ids.length) return 0;
  const result = await pool.query(
    `UPDATE app_ripening_processes
        SET status = 'completed',
            updated_at = now()
      WHERE id = ANY($1::uuid[])
        AND status = 'active'`,
    [ids]
  );
  return result.rowCount ?? ids.length;
}

/** Sesiones de control de dispositivo vencidas → `completed`. */
export async function finalizeDueDeviceControlSessions() {
  const result = await pool.query(
    `UPDATE app_device_control_sessions
        SET status = 'completed',
            updated_at = now()
      WHERE archived_at IS NULL
        AND status = 'active'
        AND estimated_end_at <= now()`
  );
  return result.rowCount ?? 0;
}

export async function maybeFinalizeRipeningDebounced() {
  const now = Date.now();
  if (now - lastRipeningFinalize < DEBOUNCE_MS) return;
  lastRipeningFinalize = now;
  try {
    const n = await finalizeDueRipeningProcesses();
    if (n > 0) console.log(`[finalize] ripening_processes completed: ${n}`);
  } catch (e) {
    console.error('[finalize] ripening:', e.message);
    throw e;
  }
}

export async function maybeFinalizeDeviceControlDebounced() {
  const now = Date.now();
  if (now - lastDcFinalize < DEBOUNCE_MS) return;
  lastDcFinalize = now;
  try {
    const n = await finalizeDueDeviceControlSessions();
    if (n > 0) console.log(`[finalize] device_control_sessions completed: ${n}`);
  } catch (e) {
    console.error('[finalize] device_control:', e.message);
    throw e;
  }
}
