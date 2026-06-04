import { clampEthyleneDose } from './ethyleneReading.js';
import { noteImeiCommandSent } from './deviceCommandLedger.js';

/** Cliente upstream: GET /Tunel/comando_control_tunel/{imei}?tipo=&dato= */

export function maduradorApiBase() {
  return String(process.env.MADURADOR_API_BASE || 'http://161.132.53.51:9051').replace(/\/$/, '');
}

/**
 * Formato del parámetro `dato` según tipo de comando túnel.
 * Temperatura (tipo 1): siempre °C con un decimal (ej. 14.1, 15.4).
 */
export function formatTunnelDato(tipo, dato) {
  const n = Number(dato);
  if (!Number.isFinite(n)) throw new Error('invalid dato');
  const t = Number(tipo);
  if (t === 1) return Number(n.toFixed(1));
  if (t === 3) return Number(n.toFixed(1));
  if (t === 2 || t === 5 || t === 0 || t === 6 || t === 10) return Math.round(n);
  return n;
}

/**
 * @param {string} imei
 * @param {number} tipo
 * @param {number|string} dato
 */
export async function sendTunnelControlCommand(imei, tipo, dato) {
  const base = maduradorApiBase();
  const id = String(imei || '').trim();
  if (!id) throw new Error('imei required');

  const formatted = formatTunnelDato(tipo, dato);
  const url = `${base}/Tunel/comando_control_tunel/${encodeURIComponent(id)}?tipo=${encodeURIComponent(String(tipo))}&dato=${encodeURIComponent(String(formatted))}`;
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
    const err = new Error(`tunnel upstream ${r.status}`);
    err.status = r.status;
    err.url = url;
    err.body = body;
    throw err;
  }

  noteImeiCommandSent(id, { tipo, dato: formatted, url });

  return { ok: true, url, status: r.status, body, dato: formatted, tipo };
}

/** Lectura etileno: tipo 0 con dato 1 (dispara muestra de campo_1). */
export async function sendEthylenePollCommand(imei) {
  return sendTunnelControlCommand(imei, 0, 1);
}

/** Inyección etileno legacy: tipo 5 (ppm) y luego tipo 0 (ppm). */
export async function sendEthyleneInjectionCommand(imei, ppm) {
  const value = Math.max(0, Math.round(Number(ppm)));
  const first = await sendTunnelControlCommand(imei, 5, value);
  const second = await sendTunnelControlCommand(imei, 0, value);
  return { ppm: value, steps: [first, second] };
}

/** Inyección incremental túnel: solo tipo 5. */
export async function sendEthyleneDoseCommand(imei, ppm) {
  const value = clampEthyleneDose(ppm);
  if (value <= 0) throw new Error('ethylene dose must be > 0');
  const sent = await sendTunnelControlCommand(imei, 5, value);
  return { ppm: value, step: sent };
}
