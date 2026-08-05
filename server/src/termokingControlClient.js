/** Cliente upstream TermoKing: GET /TermoKing/comando_control/{deviceId}?tipo=&dato= */

import { formatTunnelDato, maduradorApiBase } from './tunelControlClient.js';
import { clampEthyleneDose } from './ethyleneReading.js';
import { noteImeiCommandSent } from './deviceCommandLedger.js';

/**
 * @param {string} deviceId IMEI / identificador del equipo (ej. MEX3001, NEWY2001)
 * @param {number} tipo
 * @param {number|string} dato
 */
export async function sendTermoKingControlCommand(deviceId, tipo, dato) {
  const base = maduradorApiBase();
  const id = String(deviceId || '').trim();
  if (!id) throw new Error('deviceId required');

  // Dynamic import evita ciclo: tunnelCommandTelemetry → tunelControlClient.
  const { assertLiveTelemetryForCommand } = await import('./commandTelemetryGate.js');
  await assertLiveTelemetryForCommand(id);

  const formatted = formatTunnelDato(tipo, dato);
  const url = `${base}/TermoKing/comando_control/${encodeURIComponent(id)}?tipo=${encodeURIComponent(String(tipo))}&dato=${encodeURIComponent(String(formatted))}`;
  const ctrl =
    typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined;

  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl });
  const text = await r.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!r.ok) {
    const err = new Error(`termoking upstream ${r.status}`);
    err.status = r.status;
    err.url = url;
    err.body = body;
    throw err;
  }

  noteImeiCommandSent(id, { tipo, dato: formatted, url });

  return { ok: true, url, status: r.status, body, dato: formatted, tipo };
}

/** Lectura etileno: tipo 0 con dato 1. */
export async function sendTermoKingEthylenePollCommand(deviceId) {
  return sendTermoKingControlCommand(deviceId, 0, 1);
}

/** Inyección incremental: tipo 5 (ppm). */
export async function sendTermoKingEthyleneDoseCommand(deviceId, ppm) {
  const value = clampEthyleneDose(ppm);
  if (value <= 0) throw new Error('ethylene dose must be > 0');
  const sent = await sendTermoKingControlCommand(deviceId, 5, value);
  return { ppm: value, step: sent };
}
