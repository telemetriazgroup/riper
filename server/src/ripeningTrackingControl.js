/**
 * Control automático Gourmet driven por seguimiento activo (receta multi-fase).
 * Detecta etapa actual (homogenization, ripening, venting, cooling) y aplica la misma lógica del panel.
 */
import { pool } from './db.js';
import { isAutomatedControlDeviceId, resolveProcessControlAdapter } from './processControlAdapter.js';
import {
  AUTOMATED_PROCESS_TYPES,
  initGourmetProcessAutomation,
  tickGourmetControlContext,
} from './gourmetProcessControl.js';
import { appendTunnelEventLog, appendSessionTunnelEvent } from './tunnelEventLog.js';
import {
  controlParamsFromPhaseRaw,
  inferCurrentTrackingPhase,
  progressFromTrackingPayload,
  trackingPhaseToProcessType,
} from './ripeningPhaseInference.js';

function nowIso() {
  return new Date().toISOString();
}

async function saveTrackingPayload(trackingId, payload) {
  await pool.query(
    `UPDATE app_ripening_processes SET payload = $1::jsonb, updated_at = now() WHERE id = $2::uuid`,
    [JSON.stringify(payload), trackingId]
  );
}

function buildControlParams(payload, phaseInfo, processType) {
  const fromPhase = controlParamsFromPhaseRaw(phaseInfo.phaseRaw, processType);
  return {
    ...fromPhase,
    source: 'tracking_automation',
    trackingPhaseIndex: phaseInfo.currentIndex,
    trackingPhaseType: phaseInfo.currentType,
    trackingPhaseLabel: phaseInfo.currentLabel,
    trackingProcessType: processType,
    processAutomation: payload.controlAutomation,
    tunnelEventLog: payload.tunnelEventLog,
  };
}

async function tickTrackingRow(row) {
  const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
  const deviceId = String(payload.deviceId || '').trim();
  if (!deviceId || !isAutomatedControlDeviceId(deviceId)) return;

  const progress = progressFromTrackingPayload(payload);
  const phaseInfo = inferCurrentTrackingPhase(payload, progress);
  const processType = trackingPhaseToProcessType(phaseInfo.currentType);

  if (!processType || !AUTOMATED_PROCESS_TYPES.includes(processType)) {
    return;
  }

  const prevIndex = payload.trackingControl?.phaseIndex;
  const prevType = payload.trackingControl?.phaseType;
  const phaseChanged =
    prevIndex !== phaseInfo.currentIndex || String(prevType) !== String(phaseInfo.currentType);

  let controlParams = buildControlParams(payload, phaseInfo, processType);

  if (phaseChanged || !controlParams.processAutomation) {
    const auto = initGourmetProcessAutomation({ process_type: processType });
    auto.trackingPhaseIndex = phaseInfo.currentIndex;
    auto.trackingPhaseType = phaseInfo.currentType;
    controlParams = {
      ...controlParams,
      processAutomation: auto,
      tunnelEventLog: appendTunnelEventLog(payload, {
        action: phaseChanged && prevIndex != null ? 'tracking_phase_change' : 'process_automation_started',
        source: 'tracking_automation',
        processType,
        phaseType: phaseInfo.currentType,
        phaseLabel: phaseInfo.currentLabel,
        phaseIndex: phaseInfo.currentIndex,
        trackingId: row.id,
      }),
    };
    payload.trackingControl = {
      phaseIndex: phaseInfo.currentIndex,
      phaseType: phaseInfo.currentType,
      phaseLabel: phaseInfo.currentLabel,
      processType,
      updatedAt: nowIso(),
    };
  }

  const ctx = {
    device_id: deviceId,
    process_type: processType,
    estimated_end_at: phaseInfo.phaseEndAt,
    params: controlParams,
    adapter: resolveProcessControlAdapter(deviceId),
    async persist(nextParams) {
      const nextPayload = {
        ...payload,
        trackingControl: {
          phaseIndex: phaseInfo.currentIndex,
          phaseType: phaseInfo.currentType,
          phaseLabel: phaseInfo.currentLabel,
          processType,
          updatedAt: nowIso(),
        },
        controlAutomation: nextParams.processAutomation,
        tunnelEventLog: nextParams.tunnelEventLog,
        tunnelSyncedAt: nextParams.tunnelSyncedAt,
        source: 'tracking_automation',
      };
      await saveTrackingPayload(row.id, nextPayload);
      payload.controlAutomation = nextParams.processAutomation;
      payload.tunnelEventLog = nextParams.tunnelEventLog;
      controlParams.processAutomation = nextParams.processAutomation;
      controlParams.tunnelEventLog = nextParams.tunnelEventLog;
    },
  };

  await tickGourmetControlContext(ctx);
}

/** Cancela sesiones de control activas del equipo (al iniciar seguimiento). */
export async function cancelActiveControlSessionsForDevice(client, deviceId, cancelledByUserId, reason) {
  const dev = String(deviceId || '').trim();
  if (!dev) return 0;
  const db = client ?? pool;
  const { rows } = await db.query(
    `SELECT id FROM app_device_control_sessions
     WHERE device_id = $1 AND status = 'active' AND archived_at IS NULL`,
    [dev]
  );
  if (!rows.length) return 0;

  await db.query(
    `UPDATE app_device_control_sessions
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by_user_id = $2::uuid,
         updated_at = now()
     WHERE device_id = $1 AND status = 'active' AND archived_at IS NULL`,
    [dev, cancelledByUserId ?? null]
  );

  for (const r of rows) {
    await appendSessionTunnelEvent(db, r.id, {
      action: 'process_cancelled',
      source: 'tracking_automation',
      reason: reason || 'superseded_by_tracking',
      cancelledBy: cancelledByUserId,
    }).catch(() => {});
  }
  return rows.length;
}

export async function processGourmetActiveTrackingSessions(limit = 8) {
  const { rows } = await pool.query(
    `SELECT * FROM app_ripening_processes
     WHERE deleted_at IS NULL
       AND status = 'active'
       AND payload->>'deviceId' IS NOT NULL
       AND TRIM(payload->>'deviceId') <> ''
     ORDER BY updated_at ASC
     LIMIT $1`,
    [limit]
  );

  let processed = 0;
  for (const row of rows) {
    const deviceId = String(row.payload?.deviceId || '').trim();
    if (!isAutomatedControlDeviceId(deviceId)) continue;
    try {
      await tickTrackingRow(row);
      processed += 1;
    } catch (e) {
      console.error('[tracking-control]', row.id, e.message);
    }
  }
  return processed;
}

/** Arranque inmediato tras crear seguimiento. */
export async function kickTrackingControlForProcess(trackingId) {
  const { rows } = await pool.query(
    `SELECT * FROM app_ripening_processes WHERE id = $1::uuid AND status = 'active'`,
    [trackingId]
  );
  if (!rows.length) return;
  await tickTrackingRow(rows[0]);
}
