/**
 * Lecturas de etileno (campo_1): ignora ceros espurios del sensor tras inyección reciente
 * o cuando ya hay historial ascendente (p. ej. 12 → 21 → 30 → 0 momentáneo).
 */

export const ETHYLENE_MAX_READING = 300;
export const ETHYLENE_NONZERO_HISTORY_MAX = 5;
/** Tras una inyección tipo 5, un 0 ppm suele ser fallo de sensor, no nivel real. */
export const ETHYLENE_RECENT_DOSE_MS = 10 * 60 * 1000;

function toFinitePpm(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

/** Historial recortado: últimos N valores > 0 y < saturación. */
export function normalizeNonZeroHistory(ethMeta) {
  const raw = ethMeta?.nonZeroReadings ?? ethMeta?.readings ?? [];
  return (Array.isArray(raw) ? raw : [])
    .map(toFinitePpm)
    .filter((v) => v != null && v > 0 && v < ETHYLENE_MAX_READING)
    .slice(-ETHYLENE_NONZERO_HISTORY_MAX);
}

export function pushNonZeroDistinctReading(history, value) {
  const v = toFinitePpm(value);
  if (v == null || v <= 0 || v >= ETHYLENE_MAX_READING) {
    return Array.isArray(history) ? [...history] : [];
  }
  const next = [...(Array.isArray(history) ? history : [])];
  if (next.length && Math.abs(next[next.length - 1] - v) < 0.05) return next;
  next.push(v);
  while (next.length > ETHYLENE_NONZERO_HISTORY_MAX) next.shift();
  return next;
}

export function lastNonZeroFromMeta(ethMeta, history) {
  if (history.length) return history[history.length - 1];
  const lr = toFinitePpm(ethMeta?.lastReading);
  if (lr != null && lr > 0 && lr < ETHYLENE_MAX_READING) return lr;
  return null;
}

export function recentlyInjectedEthylene(ethMeta, withinMs = ETHYLENE_RECENT_DOSE_MS) {
  const at = ethMeta?.lastDoseAt;
  if (at) {
    const t = new Date(at).getTime();
    if (Number.isFinite(t) && Date.now() - t < withinMs) return true;
  }
  return false;
}

/**
 * @returns {{
 *   raw: number|null,
 *   effective: number|null,
 *   ignoredZero: boolean,
 *   lastNonZero: number|null,
 *   history: number[],
 *   canInject: boolean,
 * }}
 */
export function resolveEthyleneReading(rawActual, ethMeta = {}) {
  const raw = toFinitePpm(rawActual);
  let history = normalizeNonZeroHistory(ethMeta);
  const lastNonZero = lastNonZeroFromMeta(ethMeta, history);
  const recentDose = recentlyInjectedEthylene(ethMeta);

  // Cero con historial previo o inyección reciente → mantener última lectura válida, seguir sondeando.
  if (raw === 0 && lastNonZero != null && (recentDose || history.length >= 1)) {
    return {
      raw,
      effective: lastNonZero,
      ignoredZero: true,
      lastNonZero,
      history,
      canInject: false,
    };
  }

  if (raw != null && raw > 0 && raw < ETHYLENE_MAX_READING) {
    const updated = pushNonZeroDistinctReading(history, raw);
    return {
      raw,
      effective: raw,
      ignoredZero: false,
      lastNonZero: raw,
      history: updated,
      canInject: true,
    };
  }

  if (raw != null && raw >= ETHYLENE_MAX_READING) {
    return {
      raw,
      effective: lastNonZero,
      ignoredZero: false,
      lastNonZero,
      history,
      canInject: false,
    };
  }

  return {
    raw,
    effective: lastNonZero,
    ignoredZero: false,
    lastNonZero,
    history,
    canInject: false,
  };
}

export function applyEthyleneReadingToMeta(ethMeta, resolved) {
  return {
    ...ethMeta,
    nonZeroReadings: resolved.history,
    readings: resolved.history,
    lastReading: resolved.effective ?? ethMeta?.lastReading ?? null,
  };
}

export function recordEthyleneDose(ethMeta, dosePpm, baselineBeforeDose) {
  const ppm = Math.max(0, Math.round(Number(dosePpm)));
  return {
    ...ethMeta,
    lastTipo5Dato: ppm,
    lastDoseAt: new Date().toISOString(),
    ...(baselineBeforeDose != null ? { baselineBeforeDose: baselineBeforeDose } : {}),
  };
}

/** @deprecated usar resolveEthyleneReading */
export function isValidEthyleneReading(value, existing = []) {
  if (value == null || !Number.isFinite(value)) return false;
  if (value === 0 || value >= ETHYLENE_MAX_READING) return false;
  return !existing.some((r) => Math.abs(r - value) < 0.05);
}
