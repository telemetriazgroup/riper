/**
 * Detecta picos esporádicos de etileno cuando no hay proceso activo:
 * subida brusca + isla corta (1–3 lecturas) + recuperación al baseline → null al cliente.
 * Ver gases_lectura.md.
 */

export const IDLE_ETHYLENE_ABS_JUMP_PPM = 25;
export const IDLE_ETHYLENE_MAX_ISLAND = 3;
export const IDLE_ETHYLENE_RETURN_TOL_PPM = 20;
export const IDLE_ETHYLENE_ISLAND_HOLD_RATIO = 0.6;

export type SanitizeIdleEthyleneAnomaliesOptions = {
  /** Si se indica, solo esos índices pueden ocultarse; el resto corta el tramo. */
  eligible?: boolean[];
  absJumpPpm?: number;
  maxIsland?: number;
  returnTolPpm?: number;
  islandHoldRatio?: number;
};

function toNum(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

/**
 * Oculta islas anómalas (spike + recuperación) en series idle.
 * No interpola: los puntos anómalos pasan a null.
 * Si la serie termina en medio del pico (sin recuperación), no se oculta (opción A).
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
  const eligible = opts?.eligible;

  const isEligible = (i: number) => (eligible ? eligible[i] === true : true);

  let runStart = 0;
  while (runStart < n) {
    while (runStart < n && !isEligible(runStart)) runStart += 1;
    if (runStart >= n) break;
    let runEnd = runStart + 1;
    while (runEnd < n && isEligible(runEnd)) runEnd += 1;
    sanitizeContiguousRun(out, runStart, runEnd, absJump, maxIsland, returnTol, holdRatio);
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
  holdRatio: number
): void {
  const holdMin = absJump * holdRatio;
  let i = start + 1;
  while (i < end) {
    const prev = out[i - 1];
    const cur = out[i];
    if (prev == null || cur == null) {
      i += 1;
      continue;
    }
    if (cur - prev < absJump) {
      i += 1;
      continue;
    }

    const base = prev;
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

    // Sin punto de recuperación aún → no ocultar (opción A).
    if (j >= end) break;

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
