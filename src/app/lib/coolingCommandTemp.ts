/** Debe coincidir con server/src/gourmetProcessControl.js */
export const COOLING_TEMP_OFFSET_C = 2;
export const COOLING_TEMP_OFFSET_THRESHOLD_C = 10;

/** Consigna efectiva enviada en enfriamiento (tipo 1). */
export function coolingCommandTempC(programmedSetPointC: number | null | undefined): number | null {
  if (programmedSetPointC == null || !Number.isFinite(programmedSetPointC)) return null;
  if (programmedSetPointC > COOLING_TEMP_OFFSET_THRESHOLD_C) {
    return programmedSetPointC - COOLING_TEMP_OFFSET_C;
  }
  return programmedSetPointC;
}
