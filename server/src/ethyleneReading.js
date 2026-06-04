/**
 * Lecturas de etileno (campo_1): ignora ceros espurios del sensor tras inyección reciente
 * o cuando ya hay historial ascendente (p. ej. 12 → 21 → 30 → 0 momentáneo).
 */

export const ETHYLENE_MAX_READING = 300;
/** Máximo dato enviado en tipo 5 por inyección (ppm/comando). */
export const ETHYLENE_MAX_DOSE = 120;
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

/** Limita dato tipo 5 a [1, ETHYLENE_MAX_DOSE]; 0 si no hay dosis válida. */
export function clampEthyleneDose(dose) {
  const n = Math.round(Number(dose));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(ETHYLENE_MAX_DOSE, n);
}

/** Primera inyección de ciclo: dosis fija de prueba (2). */
export function computeInitialEthyleneDose(_baseline, target) {
  const remaining = Math.max(0, Number(target) - Number(_baseline ?? 0));
  if (remaining <= 0) return 0;
  return 2;
}

/**
 * Dosis proporcional según incremento observado tras la última inyección.
 * Sin avance en lectura → 0 (seguir sondeando, no escalar).
 */
export function computeProportionalEthyleneDose(meta, target, lastReading) {
  const targetN = Number(target);
  const reading = Number(lastReading);
  if (!Number.isFinite(targetN) || !Number.isFinite(reading)) return 0;

  const remaining = targetN - reading;
  if (remaining <= 0) return 0;

  const baseline = Number(meta?.baselineBeforeDose);
  const lastDose = Number(meta?.lastTipo5Dato);

  if (!Number.isFinite(baseline) || !Number.isFinite(lastDose) || lastDose <= 0) {
    return clampEthyleneDose(Math.max(1, Math.round(remaining)));
  }

  const increment = reading - baseline;
  if (increment <= 0) return 0;

  const ppmPerUnit = increment / lastDose;
  if (ppmPerUnit <= 0) return 0;

  const estimated = Math.round(remaining / ppmPerUnit);
  const bounded = Math.max(1, Math.min(estimated, Math.round(remaining)));
  return clampEthyleneDose(bounded);
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
  const ppm = clampEthyleneDose(dosePpm);
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
