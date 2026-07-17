/**
 * Detecta picos esporádicos de etileno cuando no hay proceso activo.
 * v3: E2 colapsa ráfagas densas; E1 mide islas por duración de reloj (≤12 min).
 * Ver estrateia_lectura_gas_cliente.md y gases_lectura.md.
 */

export const IDLE_ETHYLENE_ABS_JUMP_PPM = 25;
/** Tope por conteo solo si no hay timestamps. */
export const IDLE_ETHYLENE_MAX_ISLAND = 5;
/** Criterio principal v3: duración máxima de isla anómala (minutos). */
export const IDLE_ETHYLENE_MAX_ISLAND_DURATION_MIN = 12;
export const IDLE_ETHYLENE_RETURN_TOL_PPM = 20;
export const IDLE_ETHYLENE_ISLAND_HOLD_RATIO = 0.6;
export const IDLE_ETHYLENE_BASELINE_WINDOW_K = 5;
export const IDLE_ETHYLENE_PENDING_END_JUMP_PPM = 50;
/** E2: fusionar muestras casi iguales separadas por menos de este Δt. */
export const IDLE_ETHYLENE_BURST_MERGE_MAX_SEC = 25;
/** E2: |Δppm| máximo para considerar misma ráfaga. */
export const IDLE_ETHYLENE_BURST_VALUE_TOL_PPM = 1;

export type SanitizeIdleEthyleneAnomaliesOptions = {
  /** Timestamps alineados con `values` (ms epoch). Activa E1 por duración y E2. */
  timestampsMs?: (number | null | undefined)[];
  /** Si se indica, solo esos índices pueden ocultarse; el resto corta el tramo. */
  eligible?: boolean[];
  absJumpPpm?: number;
  maxIsland?: number;
  maxIslandDurationMin?: number;
  returnTolPpm?: number;
  islandHoldRatio?: number;
  baselineWindowK?: number;
  pendingEndJumpPpm?: number;
  burstMergeMaxSec?: number;
  burstValueTolPpm?: number;
};

function toNum(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

function medianOf(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return (s[mid - 1] + s[mid]) / 2;
}

/** Mediana de hasta `k` valores no nulos inmediatamente anteriores a `beforeIndex` en [start, beforeIndex). */
export function resolveIdleBaselineMedian(
  values: (number | null)[],
  start: number,
  beforeIndex: number,
  k: number
): number | null {
  const buf: number[] = [];
  for (let i = beforeIndex - 1; i >= start && buf.length < k; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) buf.push(v);
  }
  return medianOf(buf);
}

/**
 * E2 — dentro de un tramo, anula muestras previas de una ráfaga densa
 * (mismo valor ± tol y Δt ≤ burstMergeMaxSec), dejando la última.
 */
export function collapseIdleEthyleneBursts(
  values: (number | null)[],
  timestampsMs: (number | null | undefined)[] | undefined,
  start: number,
  end: number,
  burstMergeMaxSec: number,
  burstValueTolPpm: number
): void {
  if (!timestampsMs?.length) return;
  const maxMs = burstMergeMaxSec * 1000;
  for (let i = start + 1; i < end; i++) {
    const cur = values[i];
    const prev = values[i - 1];
    if (cur == null || prev == null) continue;
    const tCur = timestampsMs[i];
    const tPrev = timestampsMs[i - 1];
    if (tCur == null || tPrev == null || !Number.isFinite(Number(tCur)) || !Number.isFinite(Number(tPrev))) {
      continue;
    }
    const dt = Number(tCur) - Number(tPrev);
    if (dt < 0 || dt > maxMs) continue;
    if (Math.abs(cur - prev) <= burstValueTolPpm) {
      values[i - 1] = null;
    }
  }
}

/**
 * Oculta islas anómalas (spike + recuperación) en series idle.
 * Con timestamps: E2 + E1 (duración ≤ maxIslandDurationMin).
 * Sin timestamps: fallback por conteo (maxIsland).
 */
export function sanitizeIdleEthyleneAnomalies(
  values: (number | null | undefined)[],
  opts?: SanitizeIdleEthyleneAnomaliesOptions
): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = values.map((v) => toNum(v));
  if (n < 3) return out;

  const absJump = opts?.absJumpPpm ?? IDLE_ETHYLENE_ABS_JUMP_PPM;
  const maxIsland = opts?.maxIsland ?? IDLE_ETHYLENE_MAX_ISLAND;
  const maxDurationMin = opts?.maxIslandDurationMin ?? IDLE_ETHYLENE_MAX_ISLAND_DURATION_MIN;
  const returnTol = opts?.returnTolPpm ?? IDLE_ETHYLENE_RETURN_TOL_PPM;
  const holdRatio = opts?.islandHoldRatio ?? IDLE_ETHYLENE_ISLAND_HOLD_RATIO;
  const baselineK = opts?.baselineWindowK ?? IDLE_ETHYLENE_BASELINE_WINDOW_K;
  const pendingEndJump = opts?.pendingEndJumpPpm ?? IDLE_ETHYLENE_PENDING_END_JUMP_PPM;
  const burstMergeMaxSec = opts?.burstMergeMaxSec ?? IDLE_ETHYLENE_BURST_MERGE_MAX_SEC;
  const burstValueTol = opts?.burstValueTolPpm ?? IDLE_ETHYLENE_BURST_VALUE_TOL_PPM;
  const timestampsMs = opts?.timestampsMs;
  const eligible = opts?.eligible;

  const isEligible = (i: number) => (eligible ? eligible[i] === true : true);

  let runStart = 0;
  while (runStart < n) {
    while (runStart < n && !isEligible(runStart)) runStart += 1;
    if (runStart >= n) break;
    let runEnd = runStart + 1;
    while (runEnd < n && isEligible(runEnd)) runEnd += 1;

    collapseIdleEthyleneBursts(
      out,
      timestampsMs,
      runStart,
      runEnd,
      burstMergeMaxSec,
      burstValueTol
    );

    sanitizeContiguousRun(
      out,
      timestampsMs,
      runStart,
      runEnd,
      absJump,
      maxIsland,
      maxDurationMin,
      returnTol,
      holdRatio,
      baselineK,
      pendingEndJump
    );
    runStart = runEnd;
  }

  return out;
}

function islandDurationMin(
  timestampsMs: (number | null | undefined)[] | undefined,
  i: number,
  j: number
): number | null {
  if (!timestampsMs?.length || j <= i) return null;
  const t0 = timestampsMs[i];
  const t1 = timestampsMs[j - 1];
  if (t0 == null || t1 == null || !Number.isFinite(Number(t0)) || !Number.isFinite(Number(t1))) {
    return null;
  }
  return Math.max(0, (Number(t1) - Number(t0)) / 60000);
}

function islandWithinLimit(
  islandLen: number,
  durationMin: number | null,
  maxIsland: number,
  maxDurationMin: number
): boolean {
  if (islandLen < 1) return false;
  if (durationMin != null) return durationMin <= maxDurationMin;
  return islandLen <= maxIsland;
}

function sanitizeContiguousRun(
  out: (number | null)[],
  timestampsMs: (number | null | undefined)[] | undefined,
  start: number,
  end: number,
  absJump: number,
  maxIsland: number,
  maxDurationMin: number,
  returnTol: number,
  holdRatio: number,
  baselineK: number,
  pendingEndJump: number
): void {
  const holdMin = absJump * holdRatio;
  let i = start + 1;
  while (i < end) {
    const cur = out[i];
    if (cur == null) {
      i += 1;
      continue;
    }

    const base = resolveIdleBaselineMedian(out, start, i, baselineK);
    if (base == null) {
      i += 1;
      continue;
    }
    if (cur - base < absJump) {
      i += 1;
      continue;
    }

    // Extiende isla saltando nulls (huecos de E2 / ráfagas colapsadas).
    let j = i;
    let elevatedCount = 0;
    let lastElevated = i;
    while (j < end) {
      const v = out[j];
      if (v == null) {
        j += 1;
        continue;
      }
      if (v < base + holdMin) break;
      elevatedCount += 1;
      lastElevated = j;
      j += 1;
    }

    // Isla = desde i hasta último elevado inclusive (j apunta al recover o end).
    const islandEnd = lastElevated + 1;
    if (elevatedCount < 1) {
      i += 1;
      continue;
    }

    const durationMin = islandDurationMin(timestampsMs, i, islandEnd);
    if (!islandWithinLimit(elevatedCount, durationMin, maxIsland, maxDurationMin)) {
      i = Math.max(i + 1, islandEnd);
      continue;
    }

    // Fin de tramo sin recuperación: R5 — ocultar si el salto es claramente anómalo.
    if (j >= end) {
      if (cur - base >= pendingEndJump) {
        for (let k = i; k < islandEnd; k++) out[k] = null;
      }
      break;
    }

    const recover = out[j];
    if (recover == null) {
      i = j + 1;
      continue;
    }

    const recoveredNearBase = Math.abs(recover - base) <= returnTol;
    const recoveredDrop =
      recover <= base + returnTol && cur - recover >= absJump;

    if (recoveredNearBase || recoveredDrop) {
      for (let k = i; k < islandEnd; k++) out[k] = null;
    }
    i = j;
  }
}
