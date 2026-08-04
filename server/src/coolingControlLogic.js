/**
 * Lógica dinámica Cooling (ver logica_enfriamiento.md / implicancia_coolin.md).
 * - Promedio cargo (−20…40); si avg > return_air → usar return_air.
 * - Ramas por evaporation_coil + cooldowns vía ultimo_control.
 */

import { resolveInternalTempAverageC } from './telemetrySanity.js';

export const COOLING_CARGO_VALID_MIN_C = -20;
export const COOLING_CARGO_VALID_MAX_C = 40;
export const COOLING_CARGO_ABOVE_TARGET_C = 5;
/** Mild: evap < este valor → set a objetivo o return_air (cooldown 5 min). */
export const COOLING_EVAP_MILD_C = -6.5;
export const COOLING_EVAP_MID_C = -9.9;
export const COOLING_EVAP_SEVERE_C = -14.9;
/** Umbral “evap OK”: reglas de descenso si evap > este valor. Banda muerta: [-6.5 … -6]. */
export const COOLING_EVAP_OK_C = -6;
/** Cuando set = objetivo y evap > OK → bajar a objetivo − este offset. */
export const COOLING_EVAP_OK_EQUALS_OFFSET_C = 4;
/** Tope: set_point no puede bajar más de N °C bajo el objetivo (ej. obj 3 → mín −5). */
export const COOLING_SET_MAX_BELOW_OBJETIVO_C = 8;
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

/** Ms desde la acción más reciente (menor delta = más reciente). Prioriza local vs ultimo_control. */
function mostRecentMsSince(...candidates) {
  const vals = candidates.filter((v) => v != null && Number.isFinite(v));
  if (!vals.length) return null;
  return Math.min(...vals.map((v) => Math.max(0, v)));
}

function msSinceTempSet(ultimoControl, localLastSetAtMs) {
  let fromUltimo = null;
  if (ultimoControl?.tipo != null && String(ultimoControl.tipo).trim() === '1' && ultimoControl.executedAtMs != null) {
    fromUltimo = Date.now() - ultimoControl.executedAtMs;
  }
  let fromLocal = null;
  if (localLastSetAtMs != null && Number.isFinite(localLastSetAtMs)) {
    fromLocal = Date.now() - localLastSetAtMs;
  }
  return mostRecentMsSince(fromUltimo, fromLocal);
}

function msSinceDefrost(ultimoControl, localLastDefrostAtMs) {
  let fromUltimo = null;
  if (ultimoControl?.tipo != null && String(ultimoControl.tipo).trim() === '8' && ultimoControl.executedAtMs != null) {
    fromUltimo = Date.now() - ultimoControl.executedAtMs;
  }
  let fromLocal = null;
  if (localLastDefrostAtMs != null && Number.isFinite(localLastDefrostAtMs)) {
    fromLocal = Date.now() - localLastDefrostAtMs;
  }
  return mostRecentMsSince(fromUltimo, fromLocal);
}

function cooldownOk(msSince, needMs) {
  if (msSince == null) return true; // sin historial → permitir primera acción
  return msSince >= needMs;
}

/** Piso de set: objetivo − COOLING_SET_MAX_BELOW_OBJETIVO_C. */
export function coolingSetFloorC(objetivo) {
  const o = round1(num(objetivo));
  if (o == null) return null;
  return round1(o - COOLING_SET_MAX_BELOW_OBJETIVO_C);
}

/** Limita un target de set al piso (no más frío que obj−8). */
export function clampCoolingSetTargetC(targetC, objetivo) {
  const t = round1(num(targetC));
  const floor = coolingSetFloorC(objetivo);
  if (t == null) return null;
  if (floor == null) return t;
  return t < floor ? floor : t;
}

/**
 * USDA (cargo_1..4): válidos −20…40, ordenados de menor a mayor; promedio.
 * @returns {{ sorted: number[], avg: number|null }}
 */
export function resolveUsdaAverageC(cargoTemps) {
  const sorted = (Array.isArray(cargoTemps) ? cargoTemps : [])
    .map((v) => round1(num(v)))
    .filter((v) => v != null && v >= COOLING_CARGO_VALID_MIN_C && v <= COOLING_CARGO_VALID_MAX_C)
    .sort((a, b) => a - b);
  if (!sorted.length) return { sorted: [], avg: null };
  if (sorted.length === 1) return { sorted, avg: sorted[0] };
  const avg = round1(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { sorted, avg };
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
  ].map((v) => (v == null || !Number.isFinite(v) ? 'x' : Number(v).toFixed(1)));
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
  const objetivo = round1(num(input?.objetivo));
  if (objetivo == null || objetivo < 0) {
    return { action: 'none', reason: 'invalid_objetivo', meta: {} };
  }

  // Trama con sensores en 0: no evaluar (ni con hold — solo se usa el hold para mostrar).
  if (input?.telemetryGlitch) {
    return {
      action: 'none',
      reason: input?.usedHold ? 'telemetry_glitch_held' : 'telemetry_glitch_no_hold',
      meta: { usedHold: Boolean(input?.usedHold) },
    };
  }

  const setPoint = round1(num(input?.setPoint));
  const returnAir = round1(num(input?.returnAir));
  const tempSupply = round1(num(input?.tempSupply));
  const evaporationCoil = round1(num(input?.evaporationCoil));
  const cargos = [input?.cargo1, input?.cargo2, input?.cargo3, input?.cargo4].map((v) => round1(num(v)));
  const internalAvg = round1(resolveInternalTempAverageC(cargos, returnAir));
  const { sorted: usdaSorted, avg: usdaAvg } = resolveUsdaAverageC(cargos);

  const snap = {
    objetivo,
    setPoint,
    returnAir,
    tempSupply,
    evaporationCoil,
    internalAvg,
    usdaAvg,
    usdaSorted,
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
  const setFloor = coolingSetFloorC(objetivo);
  const baseMeta = {
    ...snap,
    fingerprint,
    msSinceLastSet: msSet,
    msSinceLastDefrost: msDefrost,
    setFloorC: setFloor,
    maxBelowObjetivoC: COOLING_SET_MAX_BELOW_OBJETIVO_C,
  };

  // Nota: regla cargoAvg > objetivo+5 (forzar set=objetivo) suspendida — interfería
  // con el descenso dinámico del set (p. ej. subía 1.8→2.8 mientras se bajaba).

  // Tope: si set ya está > 8 °C bajo el objetivo → volver a objetivo (no seguir bajando).
  if (setFloor != null && setPoint < setFloor - COOLING_SET_TOLERANCE_C) {
    if (cooldownOk(msSet, COOLING_SET_COOLDOWN_MILD_MS)) {
      return {
        action: 'set_temperature',
        targetC: round1(objetivo),
        reason: 'set_below_floor_reset_to_objetivo',
        meta: baseMeta,
      };
    }
    return { action: 'none', reason: 'set_below_floor_cooldown', meta: baseMeta };
  }

  /** Emite set con tope obj−8; si el target queda igual al set actual, no comanda. */
  const decideSet = (rawTarget, reason, cooldownReason, cooldownMs = COOLING_SET_COOLDOWN_MILD_MS) => {
    const raw = round1(num(rawTarget));
    const targetC = clampCoolingSetTargetC(raw, objetivo);
    if (targetC == null) return { action: 'none', reason: 'invalid_target', meta: baseMeta };
    if (setEquals(targetC, setPoint)) {
      return {
        action: 'none',
        reason:
          setFloor != null && setPoint <= setFloor + COOLING_SET_TOLERANCE_C
            ? 'set_at_floor'
            : 'set_target_unchanged',
        meta: baseMeta,
      };
    }
    if (!cooldownOk(msSet, cooldownMs)) {
      return { action: 'none', reason: cooldownReason, meta: baseMeta };
    }
    const clamped = raw != null && setFloor != null && raw < setFloor - 1e-9;
    return {
      action: 'set_temperature',
      targetC,
      reason: clamped ? 'set_clamped_to_floor' : reason,
      meta: { ...baseMeta, rawTargetC: raw, clampedToFloor: clamped },
    };
  };

  // Evaporador severo primero.
  if (evaporationCoil < COOLING_EVAP_SEVERE_C) {
    if (cooldownOk(msDefrost, COOLING_DEFROST_COOLDOWN_MS)) {
      return { action: 'defrost', reason: 'evap_below_minus_14_9', meta: baseMeta };
    }
    return { action: 'none', reason: 'evap_severe_defrost_cooldown', meta: baseMeta };
  }

  if (evaporationCoil < COOLING_EVAP_MID_C) {
    if (!setEquals(setPoint, objetivo)) {
      return decideSet(
        returnAir,
        'evap_below_minus_9_9_set_to_return',
        'evap_mid_set_cooldown'
      );
    }
    if (setPoint > returnAir + COOLING_SET_TOLERANCE_C) {
      if (cooldownOk(msDefrost, COOLING_DEFROST_COOLDOWN_MS)) {
        return { action: 'defrost', reason: 'evap_below_minus_9_9_defrost', meta: baseMeta };
      }
      return { action: 'none', reason: 'evap_mid_defrost_cooldown', meta: baseMeta };
    }
    return decideSet(
      returnAir,
      'evap_below_minus_9_9_set_to_return_equal_obj',
      'evap_mid_noop_cooldown'
    );
  }

  if (evaporationCoil < COOLING_EVAP_MILD_C) {
    if (!setEquals(setPoint, objetivo)) {
      return decideSet(
        objetivo,
        'evap_below_minus_6_5_set_to_objetivo',
        'evap_mild_set_cooldown'
      );
    }
    return decideSet(
      returnAir,
      'evap_below_minus_6_5_set_to_return',
      'evap_mild_noop_cooldown'
    );
  }

  // return_air < objetivo + hay USDA válidas → mantenimiento por promedio USDA.
  // Sin cargos válidos → no entrar aquí; seguir lógica normal de return_air / evap.
  if (
    returnAir < objetivo - COOLING_SET_TOLERANCE_C &&
    usdaAvg != null
  ) {
    const holdTarget =
      usdaAvg < objetivo - COOLING_SET_TOLERANCE_C
        ? round1(objetivo - 1)
        : round1(objetivo - 2);
    const reason =
      usdaAvg < objetivo - COOLING_SET_TOLERANCE_C
        ? 'return_below_obj_usda_avg_low_set_obj_minus_1'
        : 'return_below_obj_usda_avg_high_set_obj_minus_2';
    return decideSet(holdTarget, reason, 'return_below_obj_hold_cooldown', COOLING_SET_COOLDOWN_MILD_MS);
  }

  // Banda intermedia [-6.5 … -6]: sin comando (ni mild < -6.5 ni OK > -6).
  if (evaporationCoil > COOLING_EVAP_OK_C) {
    if (setPoint > objetivo + COOLING_SET_TOLERANCE_C) {
      return decideSet(objetivo, 'evap_ok_set_above_objetivo', 'evap_ok_set_cooldown');
    }
    if (setEquals(setPoint, objetivo)) {
      return decideSet(
        objetivo - COOLING_EVAP_OK_EQUALS_OFFSET_C,
        'evap_ok_set_equals_objetivo_minus_4',
        'evap_ok_step_cooldown'
      );
    }
    // set < objetivo → bajar 1 °C cada 10 min (tope obj−8)
    return decideSet(
      setPoint - 1,
      'evap_ok_step_down_1',
      'evap_ok_step_down_cooldown',
      COOLING_SET_COOLDOWN_STEP_MS
    );
  }

  return { action: 'none', reason: 'evap_band_no_rule', meta: baseMeta };
}

export function isCoolingDynamicLogicEnabled() {
  const v = process.env.COOLING_DYNAMIC_LOGIC;
  if (v == null || String(v).trim() === '') return true;
  return !(v === '0' || /^false$/i.test(String(v).trim()));
}

const REASON_ANALYSIS_ES = {
  cargo_avg_above_target_plus_5:
    'Promedio interno (cargo) supera el objetivo en más de 5 °C → forzar set_point al objetivo. (regla suspendida)',
  evap_below_minus_14_9:
    'Evaporador < -14.9 °C → enviar DEFROST (tipo 8).',
  evap_severe_defrost_cooldown:
    'Evaporador < -14.9 °C pero DEFROST en cooldown (< 5 min).',
  evap_below_minus_9_9_set_to_return:
    'Evaporador < -9.9 °C y set ≠ objetivo → set_point = return_air.',
  evap_below_minus_9_9_defrost:
    'Evaporador < -9.9 °C, set = objetivo y set > return_air → DEFROST.',
  evap_below_minus_9_9_set_to_return_equal_obj:
    'Evaporador < -9.9 °C y set = objetivo pero set ≤ return_air → set_point = return_air.',
  evap_mid_set_cooldown: 'Evaporador < -9.9 °C; cambio de set en cooldown (< 5 min).',
  evap_mid_defrost_cooldown: 'Evaporador < -9.9 °C; DEFROST en cooldown (< 5 min).',
  evap_mid_noop_cooldown: 'Evaporador < -9.9 °C; sin acción (cooldown).',
  evap_below_minus_5_9_set_to_objetivo:
    'Evaporador < umbral mild y set ≠ objetivo → set_point = objetivo. (legacy)',
  evap_below_minus_5_9_set_to_return:
    'Evaporador < umbral mild y set = objetivo → set_point = return_air. (legacy)',
  evap_below_minus_6_5_set_to_objetivo:
    'Evaporador < -6.5 °C y set ≠ objetivo → set_point = objetivo.',
  evap_below_minus_6_5_set_to_return:
    'Evaporador < -6.5 °C y set = objetivo → set_point = return_air.',
  evap_mild_set_cooldown: 'Evaporador < -6.5 °C; cambio de set en cooldown (< 5 min).',
  evap_mild_noop_cooldown: 'Evaporador < -6.5 °C; sin acción (cooldown).',
  evap_ok_set_above_objetivo:
    'Evaporador > -6 °C y set > objetivo → set_point = objetivo.',
  evap_ok_set_equals_objetivo_minus_1:
    'Evaporador > -6 °C y set = objetivo → set_point = objetivo − 4. (legacy reason code)',
  evap_ok_set_equals_objetivo_minus_3:
    'Evaporador > -6 °C y set = objetivo → set_point = objetivo − 4. (legacy reason code)',
  evap_ok_set_equals_objetivo_minus_4:
    'Evaporador > -6 °C y set = objetivo → set_point = objetivo − 4.',
  evap_ok_step_down_1:
    'Evaporador > -6 °C y set < objetivo → set_point = set − 1 (paso cada 10 min).',
  evap_ok_set_cooldown: 'Evaporador > -6 °C; cambio de set en cooldown.',
  evap_ok_step_cooldown: 'Evaporador > -6 °C; paso objetivo−4 en cooldown.',
  evap_ok_step_down_cooldown: 'Evaporador > -6 °C; paso −1 en cooldown (10 min).',
  evap_band_no_rule: 'Evaporador en banda intermedia (−6.5…−6); sin regla de cambio.',
  set_below_floor_reset_to_objetivo:
    'Set_point más de 8 °C bajo el objetivo → forzar set_point = objetivo.',
  set_below_floor_cooldown:
    'Set_point bajo el tope (obj−8); espera cooldown antes de volver a objetivo.',
  set_clamped_to_floor:
    'Target bajo el tope → set_point limitado a objetivo − 8 °C.',
  set_at_floor: 'Set_point ya en el tope (objetivo − 8 °C); no bajar más.',
  set_target_unchanged: 'Target de set igual al actual; sin comando.',
  return_below_obj_usda_avg_low_set_obj_minus_1:
    'return_air < objetivo (enfriamiento casi listo). Promedio USDA < objetivo → set_point = objetivo − 1 (mantener).',
  return_below_obj_usda_avg_high_set_obj_minus_2:
    'return_air < objetivo (enfriamiento casi listo). Promedio USDA ≥ objetivo → set_point = objetivo − 2 (mantener).',
  return_below_obj_hold_cooldown:
    'return_air < objetivo; mantenimiento USDA en cooldown (< 5 min).',
  telemetry_unchanged: 'Telemetría sin cambios respecto al último análisis; no se decide.',
  missing_critical_sensors: 'Faltan sensores críticos (set_point / return_air / evaporador).',
  invalid_objetivo: 'Objetivo de producto inválido.',
  telemetry_glitch_no_hold: 'Lectura glitch (ceros) sin valor previo para sostener.',
  telemetry_glitch_held:
    'Lectura glitch (retorno/suministro/evaporador/cargos en 0); se mantiene el dato anterior. Sin evaluación.',
};

function fmtC(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Number(Number(v).toFixed(1))}°C`;
}

function fmtMin(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return `${Math.round(ms / 60000)} min`;
}

/**
 * Trazabilidad estructurada de una decisión Cooling (para bitácora y análisis).
 * @param {ReturnType<typeof evaluateCoolingDecision>} decision
 * @param {{ ultimoControl?: object|null }} [extra]
 */
export function buildCoolingDecisionTrace(decision, extra = {}) {
  const meta = decision?.meta || {};
  const action = decision?.action || 'none';
  const reasonCode = decision?.reason || 'unknown';
  const targetC = decision?.targetC != null ? round1(decision.targetC) : null;
  const setFrom = meta.setPoint != null ? round1(meta.setPoint) : null;

  let change = { type: 'none' };
  if (action === 'set_temperature' && targetC != null) {
    change = {
      type: 'set_point',
      fromC: setFrom,
      toC: targetC,
      deltaC: setFrom != null ? round1(targetC - setFrom) : null,
    };
  } else if (action === 'defrost') {
    change = { type: 'defrost', tipo: 8, dato: 1 };
  }

  const ultimo = extra.ultimoControl || null;
  const inputs = {
    objetivo_C: meta.objetivo ?? null,
    set_point_C: meta.setPoint ?? null,
    set_floor_C: meta.setFloorC ?? null,
    max_below_objetivo_C: meta.maxBelowObjetivoC ?? COOLING_SET_MAX_BELOW_OBJETIVO_C,
    return_air_C: meta.returnAir ?? null,
    temp_supply_1_C: meta.tempSupply ?? null,
    evaporation_coil_C: meta.evaporationCoil ?? null,
    cargo_1_temp_C: meta.cargo1 ?? null,
    cargo_2_temp_C: meta.cargo2 ?? null,
    cargo_3_temp_C: meta.cargo3 ?? null,
    cargo_4_temp_C: meta.cargo4 ?? null,
    internal_avg_C: meta.internalAvg ?? null,
    usda_avg_C: meta.usdaAvg ?? null,
    usda_sorted_C: Array.isArray(meta.usdaSorted) ? meta.usdaSorted : null,
  };

  const analysisEs =
    REASON_ANALYSIS_ES[reasonCode] ||
    `Decisión Cooling: ${reasonCode}`;

  const changeEs =
    change.type === 'set_point'
      ? `Cambio set_point: ${fmtC(change.fromC)} → ${fmtC(change.toC)} (Δ ${fmtC(change.deltaC)}).`
      : change.type === 'defrost'
        ? 'Acción: enviar DEFROST (tipo 8, dato 1).'
        : 'Sin cambio de comando.';

  const sensorsEs = [
    `objetivo=${fmtC(inputs.objetivo_C)}`,
    `set=${fmtC(inputs.set_point_C)}`,
    `piso(obj-8)=${fmtC(inputs.set_floor_C)}`,
    `retorno=${fmtC(inputs.return_air_C)}`,
    `supply=${fmtC(inputs.temp_supply_1_C)}`,
    `evap=${fmtC(inputs.evaporation_coil_C)}`,
    `cargoAvg=${fmtC(inputs.internal_avg_C)}`,
    `usdaAvg=${fmtC(inputs.usda_avg_C)}`,
    `usdaSorted=[${
      Array.isArray(inputs.usda_sorted_C)
        ? inputs.usda_sorted_C.map((v) => fmtC(v)).join(',')
        : '—'
    }]`,
    `cargos=[${fmtC(inputs.cargo_1_temp_C)},${fmtC(inputs.cargo_2_temp_C)},${fmtC(inputs.cargo_3_temp_C)},${fmtC(inputs.cargo_4_temp_C)}]`,
  ].join(' | ');

  const timingEs = `último set hace ${fmtMin(meta.msSinceLastSet)}; último defrost hace ${fmtMin(meta.msSinceLastDefrost)}`;

  const summaryEs = `${analysisEs} ${changeEs} Datos: ${sensorsEs}. Timing: ${timingEs}.`;

  return {
    at: new Date().toISOString(),
    action,
    reasonCode,
    analysisEs,
    changeEs,
    summaryEs,
    change,
    inputs,
    timing: {
      msSinceLastSet: meta.msSinceLastSet ?? null,
      msSinceLastDefrost: meta.msSinceLastDefrost ?? null,
    },
    ultimoControl: ultimo
      ? {
          tipo: ultimo.tipo ?? null,
          dato: ultimo.dato ?? null,
          executedAtMs: ultimo.executedAtMs ?? null,
        }
      : null,
    fingerprint: meta.fingerprint ?? null,
  };
}
