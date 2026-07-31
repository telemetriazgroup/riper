/**
 * Último comando de control TermoKing (set_point / defrost timing).
 * Base distinta al Madurador de comandos (:9050 por defecto).
 *
 * Las fechas del upstream (`fecha_ejecucion` / `fecha_creacion`) vienen como ISO
 * **sin zona** pero en reloj **GMT-5** (America/Lima). Si se parsean como UTC
 * (contenedor TZ=UTC), el “hace X min” se infla ~300 min y los cooldowns fallan.
 */

export function termokingUltimoControlApiBase() {
  return String(
    process.env.TERMOKING_ULTIMO_CONTROL_API_BASE ||
      process.env.TERMOKING_CONTROL_API_BASE ||
      'http://161.132.53.51:9050'
  ).replace(/\/$/, '');
}

/** Offset fijo del reloj de ultimo_control, p. ej. "-05:00". */
export function termokingUltimoControlTzOffset() {
  const raw = String(process.env.TERMOKING_ULTIMO_CONTROL_TZ_OFFSET || '-05:00').trim();
  if (/^[+-]\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^[+-]\d{2}\d{2}$/.test(raw)) return `${raw.slice(0, 3)}:${raw.slice(3)}`;
  return '-05:00';
}

/**
 * Parsea fecha de ultimo_control → epoch ms (UTC).
 * - Con Z / ±offset: Date estándar.
 * - Naive (sin zona): se interpreta en {@link termokingUltimoControlTzOffset} (default GMT-5).
 */
export function parseUltimoControlDateMs(iso) {
  if (iso == null) return null;
  let s = String(iso).trim();
  if (!s) return null;
  // "2026-07-31T15:30:28.138000" → recortar a ms (3 decimales) para Date
  s = s.replace(/(\.\d{3})\d+$/, '$1');

  if (/[zZ]$/.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    const ms = new Date(s).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  const offset = termokingUltimoControlTzOffset();
  const ms = new Date(`${s}${offset}`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @returns {Promise<{
 *   imei: string,
 *   tipo: string|null,
 *   dato: number|null,
 *   executedAtMs: number|null,
 *   fechaRaw: string|null,
 *   raw: object|null
 * }|null>}
 */
export async function fetchUltimoControl(imei) {
  const id = String(imei || '').trim();
  if (!id) return null;
  const base = termokingUltimoControlApiBase();
  const url = `${base}/TermoKing/ultimo_control/${encodeURIComponent(id)}`;
  const ctrl =
    typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl });
    if (!r.ok) {
      if (r.status === 404) return null;
      console.warn('[ultimo_control]', r.status, url);
      return null;
    }
    const text = await r.text();
    if (!text || text.trim() === 'null') return null;
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return null;
    }
    if (!json || typeof json !== 'object') return null;

    const tipo = json.tipo != null ? String(json.tipo).trim() : null;
    const datoRaw = json.dato;
    const datoN =
      typeof datoRaw === 'number'
        ? datoRaw
        : typeof datoRaw === 'string'
          ? Number(String(datoRaw).replace(',', '.'))
          : NaN;
    const dato = Number.isFinite(datoN) ? datoN : null;

    const execIso = json.fecha_ejecucion || json.fecha_creacion || null;
    const executedAtMs = parseUltimoControlDateMs(execIso);

    return {
      imei: String(json.imei || id).trim(),
      tipo,
      dato,
      executedAtMs,
      fechaRaw: execIso != null ? String(execIso) : null,
      raw: json,
    };
  } catch (e) {
    console.warn('[ultimo_control] fetch failed', id, e?.message || e);
    return null;
  }
}

/** Ms desde la última ejecución de un comando tipo (p. ej. "1" temperatura, "8" defrost). */
export function msSinceUltimoControlOfTipo(ultimo, tipoWant) {
  if (!ultimo || ultimo.executedAtMs == null) return null;
  const want = String(tipoWant ?? '').trim();
  if (want && String(ultimo.tipo || '').trim() !== want) return null;
  return Math.max(0, Date.now() - ultimo.executedAtMs);
}
