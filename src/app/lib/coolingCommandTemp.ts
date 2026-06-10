/** Debe coincidir con server/src/gourmetProcessControl.js */
export const COOLING_TEMP_OFFSET_C = 2;
export const COOLING_TEMP_AGGRESSIVE_OFFSET_C = 3;
export const COOLING_RETURN_EXCESS_THRESHOLD_C = 3;

/** Consigna enviada al equipo (no usar en tarjetas de flota — ahí va el objetivo programado). */
export function coolingCommandTempC(
  programmedSetPointC: number | null | undefined,
  returnAirC?: number | null
): number | null {
  if (programmedSetPointC == null || !Number.isFinite(programmedSetPointC)) return null;
  const aggressive =
    returnAirC != null &&
    Number.isFinite(returnAirC) &&
    returnAirC - programmedSetPointC > COOLING_RETURN_EXCESS_THRESHOLD_C;
  const offset = aggressive ? COOLING_TEMP_AGGRESSIVE_OFFSET_C : COOLING_TEMP_OFFSET_C;
  return programmedSetPointC - offset;
}
