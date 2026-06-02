/** Historial unificado de acciones de control (túnel / automatización). */

import { controlParamNumber } from './controlProcessParams.js';

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

export function appendTunnelEventLog(params, entry) {
  const base = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  const log = Array.isArray(base.tunnelEventLog) ? [...base.tunnelEventLog] : [];
  log.push({
    at: new Date().toISOString(),
    source: entry.source ?? 'control',
    ...entry,
  });
  return log.slice(-500);
}

export async function appendSessionTunnelEvent(client, sessionId, entry) {
  const { rows } = await client.query(
    `SELECT params FROM app_device_control_sessions WHERE id = $1::uuid`,
    [sessionId]
  );
  if (!rows.length) return;
  const prev = rows[0].params && typeof rows[0].params === 'object' ? rows[0].params : {};
  const nextParams = {
    ...prev,
    tunnelEventLog: appendTunnelEventLog(prev, entry),
    tunnelSyncedAt: new Date().toISOString(),
  };
  await client.query(
    `UPDATE app_device_control_sessions SET params = $1::jsonb, updated_at = now() WHERE id = $2::uuid`,
    [JSON.stringify(nextParams), sessionId]
  );
}
