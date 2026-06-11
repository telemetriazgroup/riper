import { pool } from './db.js';
import { fireEmailNotification } from './emailNotifications.js';
import { getEffectiveEstimatedEndMs, progressFromTrackingPayload } from './ripeningSchedule.js';
import { buildClosureSnapshot } from './ripeningReactivation.js';

/** Fin programado UTC (ms) desde scheduleSummary del seguimiento, o null si no se puede inferir fin. */
export function getRipeningEstimatedEndMs(payload, status = 'active') {
  return getEffectiveEstimatedEndMs(payload, Date.now(), status);
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
    `SELECT id, payload, display_name FROM app_ripening_processes
     WHERE deleted_at IS NULL AND status = 'active'`
  );
  const now = Date.now();
  const toFinalize = [];
  for (const row of rows) {
    const end = getRipeningEstimatedEndMs(row.payload, row.status);
    if (end != null && now >= end) toFinalize.push(row);
  }
  if (!toFinalize.length) return 0;
  let count = 0;
  for (const row of toFinalize) {
    const prog = progressFromTrackingPayload(row.payload, 'active');
    const closure = buildClosureSnapshot(row.payload, 'active', 'completed', Date.now());
    const meta = {
      at: closure.at,
      progress: prog,
      source: 'auto_finalize',
    };
    const payload =
      row.payload && typeof row.payload === 'object'
        ? { ...row.payload, _completedMeta: meta, _closureSnapshot: closure }
        : { _completedMeta: meta, _closureSnapshot: closure };
    const result = await pool.query(
      `UPDATE app_ripening_processes
          SET status = 'completed',
              updated_at = now(),
              payload = $2::jsonb
        WHERE id = $1::uuid
          AND status = 'active'`,
      [row.id, JSON.stringify(payload)]
    );
    count += result.rowCount ?? 0;
  }
  for (const row of toFinalize) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const deviceId = payload.deviceId ? String(payload.deviceId).trim() : '';
    if (deviceId) {
      fireEmailNotification({
        deviceId,
        eventType: 'tracking_complete',
        meta: {
          display_name: row.display_name,
          processId: row.id,
          source: 'auto_finalize',
        },
      });
    }
  }
  return count;
}

/** Sesiones de control de dispositivo vencidas → `completed`. */
export async function finalizeDueDeviceControlSessions() {
  const { rows: due } = await pool.query(
    `SELECT id, device_id, process_type, display_label FROM app_device_control_sessions
     WHERE archived_at IS NULL
       AND status = 'active'
       AND estimated_end_at <= now()`
  );
  if (!due.length) return 0;
  const result = await pool.query(
    `UPDATE app_device_control_sessions
        SET status = 'completed',
            updated_at = now()
      WHERE archived_at IS NULL
        AND status = 'active'
        AND estimated_end_at <= now()`
  );
  for (const row of due) {
    if (row.device_id) {
      fireEmailNotification({
        deviceId: row.device_id,
        eventType: 'phase_complete',
        meta: {
          processType: row.process_type,
          displayLabel: row.display_label,
          source: 'auto_finalize',
        },
      });
    }
  }
  return result.rowCount ?? due.length;
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
