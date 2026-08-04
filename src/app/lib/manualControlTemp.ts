/** Temperatura objetivo en control manual (siempre almacenada en °C). */
export const MANUAL_TARGET_TEMP_MIN_C = 5;
export const MANUAL_TARGET_TEMP_MAX_C = 30;
/** Rango extendido (checkbox): solo temperaturas bajas; no supera 5 °C. */
export const MANUAL_TARGET_TEMP_EXTENDED_MIN_C = -40;
export const MANUAL_TARGET_TEMP_EXTENDED_MAX_C = 5;

/** Umbral bajo el cual se advierte daño a sensores CO₂ / etileno. */
export const MANUAL_TEMP_SENSOR_RISK_BELOW_C = 5;

export function manualTargetTempBoundsC(extended: boolean): { minC: number; maxC: number } {
  return extended
    ? { minC: MANUAL_TARGET_TEMP_EXTENDED_MIN_C, maxC: MANUAL_TARGET_TEMP_EXTENDED_MAX_C }
    : { minC: MANUAL_TARGET_TEMP_MIN_C, maxC: MANUAL_TARGET_TEMP_MAX_C };
}

export function clampManualTargetTempC(celsius: number, extended: boolean): number {
  const { minC, maxC } = manualTargetTempBoundsC(extended);
  if (!Number.isFinite(celsius)) return MANUAL_TARGET_TEMP_MIN_C;
  return Math.min(maxC, Math.max(minC, celsius));
}

/** Valor por debajo del estándar (5 °C) requiere rango extendido. */
export function deviceNeedsExtendedTempRange(setPointC: number | null | undefined): boolean {
  if (setPointC == null || !Number.isFinite(setPointC)) return false;
  return setPointC < MANUAL_TARGET_TEMP_MIN_C;
}

/** True si el set manual queda bajo 5 °C (riesgo sensores; responsabilidad del cliente). */
export function isManualTempBelowSensorSafeC(setPointC: number | null | undefined): boolean {
  if (setPointC == null || !Number.isFinite(setPointC)) return false;
  return setPointC < MANUAL_TEMP_SENSOR_RISK_BELOW_C;
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

/** Rangos de temperatura programada por tipo de proceso (panel). */
export const RIPENING_TARGET_TEMP_MIN_C = 14;
export const RIPENING_TARGET_TEMP_MAX_C = 30;
export const COOLING_TARGET_TEMP_MIN_C = 5;
export const COOLING_TARGET_TEMP_MAX_C = 14;
export const HOMOGENIZATION_TARGET_TEMP_MIN_C = 15;
export const HOMOGENIZATION_TARGET_TEMP_MAX_C = 30;
