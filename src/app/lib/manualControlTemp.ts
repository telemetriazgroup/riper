/** Temperatura objetivo en control manual (siempre almacenada en °C). */
export const MANUAL_TARGET_TEMP_MIN_C = 1;
export const MANUAL_TARGET_TEMP_MAX_C = 30;
export const MANUAL_TARGET_TEMP_EXTENDED_MIN_C = -40;

export function manualTargetTempBoundsC(extended: boolean): { minC: number; maxC: number } {
  return {
    minC: extended ? MANUAL_TARGET_TEMP_EXTENDED_MIN_C : MANUAL_TARGET_TEMP_MIN_C,
    maxC: MANUAL_TARGET_TEMP_MAX_C,
  };
}

export function clampManualTargetTempC(celsius: number, extended: boolean): number {
  const { minC, maxC } = manualTargetTempBoundsC(extended);
  if (!Number.isFinite(celsius)) return MANUAL_TARGET_TEMP_MIN_C;
  return Math.min(maxC, Math.max(minC, celsius));
}

/** Valor fuera del rango estándar 1–30 °C requiere rango extendido. */
export function deviceNeedsExtendedTempRange(setPointC: number | null | undefined): boolean {
  if (setPointC == null || !Number.isFinite(setPointC)) return false;
  return setPointC < MANUAL_TARGET_TEMP_MIN_C || setPointC > MANUAL_TARGET_TEMP_MAX_C;
}

export function formatManualTempRangeDual(minC: number, maxC: number) {
  const minF = (minC * 9) / 5 + 32;
  const maxF = (maxC * 9) / 5 + 32;
  return {
    minC: minC.toFixed(1),
    maxC: maxC.toFixed(1),
    minF: minF.toFixed(1),
    maxF: maxF.toFixed(1),
  };
}
