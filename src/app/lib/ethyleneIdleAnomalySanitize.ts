/**
 * Detecta picos esporádicos de etileno cuando no hay proceso activo:
 * subida brusca + isla corta + recuperación al baseline → null al cliente.
 * v2: MAX_ISLAND=5, baseline mediana (K=5), opción B suave al final de serie.
 * Ver gases_lectura.md.
 */

export const IDLE_ETHYLENE_ABS_JUMP_PPM = 25;
export const IDLE_ETHYLENE_MAX_ISLAND = 5;
export const IDLE_ETHYLENE_RETURN_TOL_PPM = 20;
export const IDLE_ETHYLENE_ISLAND_HOLD_RATIO = 0.6;
/** Mediana de los últimos K valores válidos como baseline (R2). */
export const IDLE_ETHYLENE_BASELINE_WINDOW_K = 5;
/** Salto mínimo sobre baseline para ocultar pico pendiente al final de la serie (R5). */
export const IDLE_ETHYLENE_PENDING_END_JUMP_PPM = 50;

export type SanitizeIdleEthyleneAnomaliesOptions = {
  /** Si se indica, solo esos índices pueden ocultarse; el resto corta el tramo. */
  eligible?: boolean[];
  absJumpPpm?: number;
  maxIsland?: number;
  returnTolPpm?: number;
  islandHoldRatio?: number;
  baselineWindowK?: number;
  pendingEndJumpPpm?: number;
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
 * Oculta islas anómalas (spike + recuperación) en series idle.
 * No interpola: los puntos anómalos pasan a null.
 * R5: si la serie termina en un salto ≥ pendingEndJump sobre baseline, oculta el tramo pendiente.
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
  const returnTol = opts?.returnTolPpm ?? IDLE_ETHYLENE_RETURN_TOL_PPM;
  const holdRatio = opts?.islandHoldRatio ?? IDLE_ETHYLENE_ISLAND_HOLD_RATIO;
  const baselineK = opts?.baselineWindowK ?? IDLE_ETHYLENE_BASELINE_WINDOW_K;
  const pendingEndJump = opts?.pendingEndJumpPpm ?? IDLE_ETHYLENE_PENDING_END_JUMP_PPM;
  const eligible = opts?.eligible;

  const isEligible = (i: number) => (eligible ? eligible[i] === true : true);

  let runStart = 0;
  while (runStart < n) {
    while (runStart < n && !isEligible(runStart)) runStart += 1;
    if (runStart >= n) break;
    let runEnd = runStart + 1;
    while (runEnd < n && isEligible(runEnd)) runEnd += 1;
    sanitizeContiguousRun(
      out,
      runStart,
      runEnd,
      absJump,
      maxIsland,
      returnTol,
      holdRatio,
      baselineK,
      pendingEndJump
    );
    runStart = runEnd;
  }

  return out;
}

function sanitizeContiguousRun(
  out: (number | null)[],
  start: number,
  end: number,
  absJump: number,
  maxIsland: number,
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

    let j = i;
    while (j < end) {
      const v = out[j];
      if (v == null || v < base + holdMin) break;
      j += 1;
    }

    const islandLen = j - i;
    if (islandLen < 1 || islandLen > maxIsland) {
      i = Math.max(i + 1, j);
      continue;
    }

    // Fin de tramo sin recuperación: R5 — ocultar si el salto es claramente anómalo.
    if (j >= end) {
      if (cur - base >= pendingEndJump) {
        for (let k = i; k < j; k++) out[k] = null;
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
      for (let k = i; k < j; k++) out[k] = null;
    }
    i = j;
  }
}
