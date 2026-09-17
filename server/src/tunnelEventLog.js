/** Historial unificado de acciones de control (túnel / automatización). */

import { controlParamNumber, parseSessionParams } from './controlProcessParams.js';
import { isBitacoraDualWriteEnabled, queueBitacoraEvent } from './bitacora.js';

/** Cap JSON embebido (legacy). La fuente de verdad pasa a app_control_bitacora. */
export const TUNNEL_EVENT_LOG_EMBEDDED_MAX = (() => {
  const n = Number(process.env.TUNNEL_EVENT_LOG_EMBEDDED_MAX);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 80;
})();

export function programmedSummaryFromParams(params, processType) {
  const p = params && typeof params === 'object' ? params : {};
  const parts = [];
  const sp = controlParamNumber(p, 'setPoint', 'set_point');
  if (sp != null) parts.push(`Temp ${sp}°C`);
  const rh = controlParamNumber(p, 'humiditySetPoint', 'humidity_set_point');
  if (rh != null) parts.push(`HR ${rh}%`);
  const eth = controlParamNumber(p, 'ethylene', 'ethylene_injection_programmed');
  if (eth != null && String(processType) === 'Ripening') parts.push(`Etileno ${eth} ppm`);
  const co2 = controlParamNumber(p, 'co2', 'co2_limit');
  if (co2 != null && String(processType) === 'Ripening') parts.push(`CO₂ ${co2}%`);
  const dur = controlParamNumber(p, 'durationHours') ?? Number(p.durationHours);
  if (Number.isFinite(dur) && dur > 0) parts.push(`${dur} h`);
  return parts.join(' · ');
}

/**
 * @param {object} params
 * @param {object} entry
 * @param {{ deviceId?: string, sessionId?: string, trackingId?: string, processType?: string, userEmail?: string }} [meta]
 */
export function appendTunnelEventLog(params, entry, meta = {}) {
  const base = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  const at = new Date().toISOString();
  const event = {
    at,
    source: entry.source ?? 'control',
    ...entry,
  };

  const deviceId = String(meta.deviceId || entry.deviceId || base.deviceId || '').trim();
  if (deviceId) {
    queueBitacoraEvent({
      deviceId,
      sessionId: meta.sessionId ?? null,
      trackingId: meta.trackingId ?? null,
      processType: meta.processType ?? entry.processType ?? base.process_type ?? null,
      userEmail: meta.userEmail ?? entry.by ?? null,
      occurredAt: at,
      entry: event,
      source: event.source,
      action: event.action,
      kind: event.kind,
      summary: event.summaryEs ?? event.analysisEs ?? event.summary ?? null,
    });
  }

  // Sin dual-write JSON: no engordar params (flota liviana).
  if (!isBitacoraDualWriteEnabled()) {
    return Array.isArray(base.tunnelEventLog) ? base.tunnelEventLog : [];
  }

  if (TUNNEL_EVENT_LOG_EMBEDDED_MAX <= 0) {
    return [];
  }

  const log = Array.isArray(base.tunnelEventLog) ? [...base.tunnelEventLog] : [];
  log.push(event);
  return log.slice(-TUNNEL_EVENT_LOG_EMBEDDED_MAX);
}

export async function appendSessionTunnelEvent(client, sessionId, entry) {
  const { rows } = await client.query(
    `SELECT id, device_id, process_type, params FROM app_device_control_sessions WHERE id = $1::uuid`,
    [sessionId]
  );
  if (!rows.length) return;
  const row = rows[0];
  const prev = parseSessionParams(row.params);
  const nextParams = {
    ...prev,
    tunnelEventLog: appendTunnelEventLog(prev, entry, {
      deviceId: row.device_id,
      sessionId: row.id,
      processType: row.process_type,
    }),
    tunnelSyncedAt: new Date().toISOString(),
  };
  await client.query(
    `UPDATE app_device_control_sessions SET params = $1::jsonb, updated_at = now() WHERE id = $2::uuid`,
    [JSON.stringify(nextParams), sessionId]
  );
}
