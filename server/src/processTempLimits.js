/**
 * Rangos de temperatura programada (°C) por tipo de proceso / control manual.
 */

export const MANUAL_TEMP_MIN_C = 5;
export const MANUAL_TEMP_MAX_C = 30;
export const MANUAL_TEMP_EXTENDED_MIN_C = -40;
export const MANUAL_TEMP_EXTENDED_MAX_C = 5;

export const RIPENING_TEMP_MIN_C = 14;
export const RIPENING_TEMP_MAX_C = 30;

export const COOLING_TEMP_MIN_C = 6;
export const COOLING_TEMP_MAX_C = 14;

export const HOMOGENIZATION_TEMP_MIN_C = 15;
export const HOMOGENIZATION_TEMP_MAX_C = 30;

/**
 * @param {string} processType
 * @param {number|null} setPointC
 * @param {{ extendedManual?: boolean }} [opts]
 * @returns {string|null} mensaje de error o null si OK
 */
export function validateProcessSetPointC(processType, setPointC, opts = {}) {
  if (setPointC == null || !Number.isFinite(Number(setPointC))) return 'setPoint required';
  const sp = Number(setPointC);
  const pt = String(processType || '').trim();

  if (pt === 'Manual') {
    if (opts.extendedManual) {
      if (sp < MANUAL_TEMP_EXTENDED_MIN_C || sp > MANUAL_TEMP_EXTENDED_MAX_C) {
        return `setPoint out of extended range (${MANUAL_TEMP_EXTENDED_MIN_C}…${MANUAL_TEMP_EXTENDED_MAX_C} °C)`;
      }
      return null;
    }
    if (sp < MANUAL_TEMP_MIN_C || sp > MANUAL_TEMP_MAX_C) {
      return `setPoint out of range (${MANUAL_TEMP_MIN_C}…${MANUAL_TEMP_MAX_C} °C); use extended range for lower temps`;
    }
    return null;
  }

  if (pt === 'Ripening') {
    if (sp < RIPENING_TEMP_MIN_C || sp > RIPENING_TEMP_MAX_C) {
      return `setPoint out of range for Ripening (${RIPENING_TEMP_MIN_C}…${RIPENING_TEMP_MAX_C} °C)`;
    }
    return null;
  }

  if (pt === 'Cooling') {
    if (sp < COOLING_TEMP_MIN_C || sp > COOLING_TEMP_MAX_C) {
      return `setPoint out of range for Cooling (${COOLING_TEMP_MIN_C}…${COOLING_TEMP_MAX_C} °C)`;
    }
    return null;
  }

  if (pt === 'Homogenization') {
    if (sp < HOMOGENIZATION_TEMP_MIN_C || sp > HOMOGENIZATION_TEMP_MAX_C) {
      return `setPoint out of range for Homogenization (${HOMOGENIZATION_TEMP_MIN_C}…${HOMOGENIZATION_TEMP_MAX_C} °C)`;
    }
    return null;
  }

  return null;
}
