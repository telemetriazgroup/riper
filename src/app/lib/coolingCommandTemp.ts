/** Debe coincidir con server/src/gourmetProcessControl.js */
export const COOLING_TEMP_OFFSET_C = 2;
export const COOLING_TEMP_AGGRESSIVE_OFFSET_C = 3;
export const COOLING_RETURN_EXCESS_THRESHOLD_C = 3;

function roundTemp1(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(Number(v).toFixed(1));
}

/** Consigna enviada al equipo (no usar en tarjetas de flota — ahí va el objetivo programado). */
export function coolingCommandTempC(
  programmedSetPointC: number | null | undefined,
  returnAirC?: number | null
): number | null {
  const programmed = roundTemp1(programmedSetPointC);
  if (programmed == null) return null;
  const ret = roundTemp1(returnAirC);
  const aggressive =
    ret != null && ret - programmed > COOLING_RETURN_EXCESS_THRESHOLD_C;
  const offset = aggressive ? COOLING_TEMP_AGGRESSIVE_OFFSET_C : COOLING_TEMP_OFFSET_C;
  return roundTemp1(programmed - offset);
}
