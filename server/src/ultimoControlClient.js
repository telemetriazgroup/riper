/**
 * Último comando de control TermoKing (set_point / defrost timing).
 * Base distinta al Madurador de comandos (:9050 por defecto).
 */

export function termokingUltimoControlApiBase() {
  return String(
    process.env.TERMOKING_ULTIMO_CONTROL_API_BASE ||
      process.env.TERMOKING_CONTROL_API_BASE ||
      'http://161.132.53.51:9050'
  ).replace(/\/$/, '');
}

/**
 * @returns {Promise<{
 *   imei: string,
 *   tipo: string|null,
 *   dato: number|null,
 *   executedAtMs: number|null,
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
    const executedAtMs = execIso ? new Date(execIso).getTime() : null;

    return {
      imei: String(json.imei || id).trim(),
      tipo,
      dato,
      executedAtMs: Number.isFinite(executedAtMs) ? executedAtMs : null,
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
