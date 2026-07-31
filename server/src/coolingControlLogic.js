/**
 * Lógica dinámica Cooling (ver logica_enfriamiento.md / implicancia_coolin.md).
 * - Promedio cargo (−20…40); si avg > return_air → usar return_air.
 * - Ramas por evaporation_coil + cooldowns vía ultimo_control.
 */

import { resolveInternalTempAverageC } from './telemetrySanity.js';

export const COOLING_CARGO_VALID_MIN_C = -20;
export const COOLING_CARGO_VALID_MAX_C = 40;
export const COOLING_CARGO_ABOVE_TARGET_C = 5;
export const COOLING_EVAP_MILD_C = -5.9;
export const COOLING_EVAP_MID_C = -9.9;
export const COOLING_EVAP_SEVERE_C = -14.9;
export const COOLING_EVAP_OK_C = -4;
export const COOLING_SET_COOLDOWN_MILD_MS = 5 * 60 * 1000;
export const COOLING_SET_COOLDOWN_STEP_MS = 10 * 60 * 1000;
export const COOLING_DEFROST_COOLDOWN_MS = 5 * 60 * 1000;
export const COOLING_SET_TOLERANCE_C = 0.35;

function num(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

function round1(v) {
  return Number(Number(v).toFixed(1));
}

function setEquals(a, b) {
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= COOLING_SET_TOLERANCE_C;
}

function msSinceTempSet(ultimoControl, localLastSetAtMs) {
  if (ultimoControl?.tipo != null && String(ultimoControl.tipo).trim() === '1' && ultimoControl.executedAtMs != null) {
    return Math.max(0, Date.now() - ultimoControl.executedAtMs);
  }
  if (localLastSetAtMs != null && Number.isFinite(localLastSetAtMs)) {
    return Math.max(0, Date.now() - localLastSetAtMs);
  }
  return null;
}

function msSinceDefrost(ultimoControl, localLastDefrostAtMs) {
  if (ultimoControl?.tipo != null && String(ultimoControl.tipo).trim() === '8' && ultimoControl.executedAtMs != null) {
    return Math.max(0, Date.now() - ultimoControl.executedAtMs);
  }
  if (localLastDefrostAtMs != null && Number.isFinite(localLastDefrostAtMs)) {
    return Math.max(0, Date.now() - localLastDefrostAtMs);
  }
  return null;
}

function cooldownOk(msSince, needMs) {
  if (msSince == null) return true; // sin historial → permitir primera acción
  return msSince >= needMs;
}

/**
 * Fingerprint de telemetría relevante para skip si no cambió.
 */
export function coolingTelemetryFingerprint(snap) {
  if (!snap) return '';
  const parts = [
    snap.setPoint,
    snap.tempSupply,
    snap.returnAir,
    snap.evaporationCoil,
    snap.internalAvg,
    snap.cargo1,
    snap.cargo2,
    snap.cargo3,
    snap.cargo4,
  ].map((v) => (v == null || !Number.isFinite(v) ? 'x' : Number(v).toFixed(2)));
  return parts.join('|');
}

/**
 * @param {object} input
 * @param {number} input.objetivo
 * @param {number|null} input.setPoint
 * @param {number|null} input.returnAir
 * @param {number|null} input.tempSupply
 * @param {number|null} input.evaporationCoil
 * @param {number|null} [input.cargo1]
 * @param {number|null} [input.cargo2]
 * @param {number|null} [input.cargo3]
 * @param {number|null} [input.cargo4]
 * @param {object|null} [input.ultimoControl]
 * @param {number|null} [input.localLastSetAtMs]
 * @param {number|null} [input.localLastDefrostAtMs]
 * @param {string|null} [input.lastFingerprint]
 * @param {boolean} [input.telemetryGlitch]
 */
export function evaluateCoolingDecision(input) {
  const objetivo = num(input?.objetivo);
  if (objetivo == null || objetivo < 0) {
    return { action: 'none', reason: 'invalid_objetivo', meta: {} };
  }

  if (input?.telemetryGlitch && input?.setPoint == null && input?.returnAir == null) {
    return { action: 'none', reason: 'telemetry_glitch_no_hold', meta: {} };
  }

  const setPoint = num(input?.setPoint);
  const returnAir = num(input?.returnAir);
  const tempSupply = num(input?.tempSupply);
  const evaporationCoil = num(input?.evaporationCoil);
  const cargos = [input?.cargo1, input?.cargo2, input?.cargo3, input?.cargo4].map(num);
  const internalAvg = resolveInternalTempAverageC(cargos, returnAir);

  const snap = {
    objetivo,
    setPoint,
    returnAir,
    tempSupply,
    evaporationCoil,
    internalAvg,
    cargo1: cargos[0],
    cargo2: cargos[1],
    cargo3: cargos[2],
    cargo4: cargos[3],
  };
  const fingerprint = coolingTelemetryFingerprint(snap);

  if (input?.lastFingerprint && fingerprint === String(input.lastFingerprint)) {
    return {
      action: 'none',
      reason: 'telemetry_unchanged',
      meta: { ...snap, fingerprint },
    };
  }

  if (evaporationCoil == null || setPoint == null || returnAir == null) {
    return {
      action: 'none',
      reason: 'missing_critical_sensors',
      meta: { ...snap, fingerprint },
    };
  }

  const msSet = msSinceTempSet(input?.ultimoControl, input?.localLastSetAtMs);
  const msDefrost = msSinceDefrost(input?.ultimoControl, input?.localLastDefrostAtMs);
  const baseMeta = {
    ...snap,
    fingerprint,
    msSinceLastSet: msSet,
    msSinceLastDefrost: msDefrost,
  };

  // Cargo muy por encima del objetivo → forzar set a objetivo (cooldown 5 min).
  if (
    internalAvg != null &&
    internalAvg > objetivo + COOLING_CARGO_ABOVE_TARGET_C &&
    !setEquals(setPoint, objetivo) &&
    cooldownOk(msSet, COOLING_SET_COOLDOWN_MILD_MS)
  ) {
    return {
      action: 'set_temperature',
      targetC: round1(objetivo),
      reason: 'cargo_avg_above_target_plus_5',
      meta: baseMeta,
    };
  }

  // Evaporador severo primero.
  if (evaporationCoil < COOLING_EVAP_SEVERE_C) {
    if (cooldownOk(msDefrost, COOLING_DEFROST_COOLDOWN_MS)) {
      return { action: 'defrost', reason: 'evap_below_minus_14_9', meta: baseMeta };
    }
    return { action: 'none', reason: 'evap_severe_defrost_cooldown', meta: baseMeta };
  }

  if (evaporationCoil < COOLING_EVAP_MID_C) {
    if (!setEquals(setPoint, objetivo)) {
      if (cooldownOk(msSet, COOLING_SET_COOLDOWN_MILD_MS)) {
        return {
          action: 'set_temperature',
          targetC: round1(returnAir),
          reason: 'evap_below_minus_9_9_set_to_return',
          meta: baseMeta,
        };
      }
      return { action: 'none', reason: 'evap_mid_set_cooldown', meta: baseMeta };
    }
    if (setPoint > returnAir + COOLING_SET_TOLERANCE_C) {
      if (cooldownOk(msDefrost, COOLING_DEFROST_COOLDOWN_MS)) {
        return { action: 'defrost', reason: 'evap_below_minus_9_9_defrost', meta: baseMeta };
      }
      return { action: 'none', reason: 'evap_mid_defrost_cooldown', meta: baseMeta };
    }
    if (cooldownOk(msSet, COOLING_SET_COOLDOWN_MILD_MS)) {
      return {
        action: 'set_temperature',
        targetC: round1(returnAir),
        reason: 'evap_below_minus_9_9_set_to_return_equal_obj',
        meta: baseMeta,
      };
    }
    return { action: 'none', reason: 'evap_mid_noop_cooldown', meta: baseMeta };
  }

  if (evaporationCoil < COOLING_EVAP_MILD_C) {
    if (!setEquals(setPoint, objetivo)) {
      if (cooldownOk(msSet, COOLING_SET_COOLDOWN_MILD_MS)) {
        return {
          action: 'set_temperature',
          targetC: round1(objetivo),
          reason: 'evap_below_minus_5_9_set_to_objetivo',
          meta: baseMeta,
        };
      }
      return { action: 'none', reason: 'evap_mild_set_cooldown', meta: baseMeta };
    }
    if (cooldownOk(msSet, COOLING_SET_COOLDOWN_MILD_MS)) {
      return {
        action: 'set_temperature',
        targetC: round1(returnAir),
        reason: 'evap_below_minus_5_9_set_to_return',
        meta: baseMeta,
      };
    }
    return { action: 'none', reason: 'evap_mild_noop_cooldown', meta: baseMeta };
  }

  if (evaporationCoil > COOLING_EVAP_OK_C) {
    if (setPoint > objetivo + COOLING_SET_TOLERANCE_C) {
      if (cooldownOk(msSet, COOLING_SET_COOLDOWN_MILD_MS)) {
        return {
          action: 'set_temperature',
          targetC: round1(objetivo),
          reason: 'evap_ok_set_above_objetivo',
          meta: baseMeta,
        };
      }
      return { action: 'none', reason: 'evap_ok_set_cooldown', meta: baseMeta };
    }
    if (setEquals(setPoint, objetivo)) {
      if (cooldownOk(msSet, COOLING_SET_COOLDOWN_MILD_MS)) {
        return {
          action: 'set_temperature',
          targetC: round1(objetivo - 1),
          reason: 'evap_ok_set_equals_objetivo_minus_1',
          meta: baseMeta,
        };
      }
      return { action: 'none', reason: 'evap_ok_step_cooldown', meta: baseMeta };
    }
    // set < objetivo → bajar 1 °C cada 10 min
    if (cooldownOk(msSet, COOLING_SET_COOLDOWN_STEP_MS)) {
      return {
        action: 'set_temperature',
        targetC: round1(setPoint - 1),
        reason: 'evap_ok_step_down_1',
        meta: baseMeta,
      };
    }
    return { action: 'none', reason: 'evap_ok_step_down_cooldown', meta: baseMeta };
  }

  return { action: 'none', reason: 'evap_band_no_rule', meta: baseMeta };
}

export function isCoolingDynamicLogicEnabled() {
  const v = process.env.COOLING_DYNAMIC_LOGIC;
  if (v == null || String(v).trim() === '') return true;
  return !(v === '0' || /^false$/i.test(String(v).trim()));
}
