/**
 * Seguridad etileno: relé pegado / runaway (ver error_gas.md).
 * Evaluación pura; el caller ejecuta comandos físicos (tipo 5 dato=1, tipo 6 AVL).
 *
 * Escalada:
 *  +20% set → pulso 1 s + consulta 20 min (poll 2 min)
 *  +60% set → otro pulso
 *  +100% set → otro pulso
 *  ≥400 ppm (tras haber pasado +20% y +60%) → otro pulso
 *  ≥410 ppm → ventilación AVL 200 por 20 min
 * Tras saturación/vent: no reinyectar hasta caída brusca (p. ej. apertura de puerta).
 */

/** +20 % del set → primer pulso. */
export const ETHYLENE_OVERSHOOT_RATIO = 1.2;
/** +60 % del set → segundo pulso en consulta. */
export const ETHYLENE_OVERSHOOT_60_RATIO = 1.6;
/** +100 % del set → tercer pulso en consulta. */
export const ETHYLENE_OVERSHOOT_100_RATIO = 2.0;

/** Pulso físico anti-relé (segundos de relé ON). */
export const ETHYLENE_STUCK_PULSE_DATO = 1;
/** Ventana de consulta tras pulso. */
export const ETHYLENE_STUCK_WATCH_MS = 20 * 60 * 1000;
/** Umbral absoluto de pulso extra (requiere hit20 + hit60). */
export const ETHYLENE_HIGH_PULSE_PPM = 400;
/** Umbral de ventilación de emergencia. */
export const ETHYLENE_VENT_PPM = 410;
/** Alias legacy (documentación / export). */
export const ETHYLENE_RUNAWAY_PPM = ETHYLENE_VENT_PPM;

export const ETHYLENE_VENT_AVL = 200;
export const ETHYLENE_VENT_DURATION_MS = 20 * 60 * 1000;
/** Poll en modo seguridad / consulta. */
export const ETHYLENE_SAFETY_POLL_MS = 2 * 60 * 1000;
/** Lecturas consecutivas ≥ +20% antes del primer pulso (anti-spike). */
export const ETHYLENE_OVERSHOOT_CONFIRM = 2;
/** Mínimo entre pulsos de seguridad. */
export const ETHYLENE_PULSE_COOLDOWN_MS = ETHYLENE_SAFETY_POLL_MS;
/**
 * Caída brusca vs pico registrado → reanudar inyección (posible apertura de puerta).
 * reading ≤ peak * ratio.
 */
export const ETHYLENE_DRASTIC_DROP_RATIO = 0.5;

export function overshootThresholdPpm(target, ratio = ETHYLENE_OVERSHOOT_RATIO) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return null;
  return Number((t * ratio).toFixed(2));
}

export function isEthyleneSafetyActive(safety) {
  return Boolean(safety && safety.phase);
}

/** Bloqueo de dosis normal (consulta, vent o hold post-saturación). */
export function isEthyleneInjectionLocked(safety) {
  if (!safety) return false;
  if (safety.injectionLocked) return true;
  return ['consult', 'ventilate', 'hold_no_inject'].includes(String(safety.phase || ''));
}

function thresholdsFor(target) {
  return {
    thr20: overshootThresholdPpm(target, ETHYLENE_OVERSHOOT_RATIO),
    thr60: overshootThresholdPpm(target, ETHYLENE_OVERSHOOT_60_RATIO),
    thr100: overshootThresholdPpm(target, ETHYLENE_OVERSHOOT_100_RATIO),
  };
}

function canPulse(safety, now) {
  if (!safety?.lastPulseAt) return true;
  const last = new Date(safety.lastPulseAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now - last >= ETHYLENE_PULSE_COOLDOWN_MS;
}

function withReadingMeta(safety, reading, now) {
  const peak = Math.max(
    Number(safety.peakReading) || 0,
    Number(safety.lastKnownReading) || 0,
    reading
  );
  return {
    ...safety,
    lastKnownReading: reading,
    peakReading: peak,
    readingNull: false,
    lastReadingAt: new Date(now).toISOString(),
  };
}

function applyPulse(safety, reading, now, reason, flags = {}) {
  return {
    ...safety,
    phase: safety.phase === 'ventilate' ? 'ventilate' : 'consult',
    watchUntil: new Date(now + ETHYLENE_STUCK_WATCH_MS).toISOString(),
    readingAtPulse: reading,
    lastPulseAt: new Date(now).toISOString(),
    pulseCount: (Number(safety.pulseCount) || 0) + 1,
    reason,
    ...flags,
  };
}

function startConsultAfterFirstPulse(target, thr, reading, now, streak) {
  return withReadingMeta(
    {
      phase: 'consult',
      enteredAt: new Date(now).toISOString(),
      watchUntil: new Date(now + ETHYLENE_STUCK_WATCH_MS).toISOString(),
      ventUntil: null,
      readingAtEnter: reading,
      readingAtPulse: reading,
      targetPpm: target,
      overshootThreshold: thr.thr20,
      thr20: thr.thr20,
      thr60: thr.thr60,
      thr100: thr.thr100,
      hit20: true,
      hit60: false,
      hit100: false,
      hit400: false,
      pulseCount: 1,
      overshootStreak: streak,
      lastPulseAt: new Date(now).toISOString(),
      injectionLocked: false,
      peakReading: reading,
      lastKnownReading: reading,
      readingNull: false,
      reason: 'overshoot_1_20',
    },
    reading,
    now
  );
}

function isDrasticDrop(safety, reading, target) {
  const peak = Number(safety?.peakReading ?? safety?.lastKnownReading);
  if (Number.isFinite(peak) && peak > 0 && reading <= peak * ETHYLENE_DRASTIC_DROP_RATIO) {
    return true;
  }
  // Bajó claramente bajo el set tras haber estado saturado.
  if (Number.isFinite(target) && reading < target - 0.5 && Number.isFinite(peak) && peak >= target * 1.2) {
    return true;
  }
  return false;
}

/**
 * @param {{
 *   target: number,
 *   reading: number|null,
 *   safety: object|null,
 *   now?: number,
 * }} input
 * @returns {{
 *   safety: object|null,
 *   actions: Array<{ type: string, reason?: string }>,
 *   suspendNormal: boolean,
 *   pollMs: number,
 * }}
 */
export function evaluateEthyleneSafety(input) {
  const now = Number.isFinite(input?.now) ? input.now : Date.now();
  const target = Number(input?.target);
  const readingRaw = input?.reading;
  const reading =
    readingRaw != null && Number.isFinite(Number(readingRaw)) ? Number(readingRaw) : null;
  let safety = input?.safety && typeof input.safety === 'object' ? { ...input.safety } : null;
  const actions = [];
  const thr = thresholdsFor(target);

  if (!Number.isFinite(target) || target <= 0 || thr.thr20 == null) {
    return {
      safety,
      actions,
      suspendNormal: isEthyleneInjectionLocked(safety),
      pollMs: ETHYLENE_SAFETY_POLL_MS,
    };
  }

  // —— Lectura nula: mantener modo consulta / hold con último dato conocido ——
  if (reading == null) {
    if (isEthyleneSafetyActive(safety) || safety?.injectionLocked) {
      safety = {
        ...safety,
        readingNull: true,
        reason: safety?.reason || 'consult_null_reading',
      };
      return {
        safety,
        actions: [{ type: 'consult_null', reason: 'null_reading' }],
        suspendNormal: true,
        pollMs: ETHYLENE_SAFETY_POLL_MS,
      };
    }
    return {
      safety,
      actions,
      suspendNormal: false,
      pollMs: ETHYLENE_SAFETY_POLL_MS,
    };
  }

  if (safety) {
    safety = withReadingMeta(safety, reading, now);
  }

  // —— Hold post-saturación: no inyectar hasta caída brusca ——
  if (safety?.phase === 'hold_no_inject') {
    if (isDrasticDrop(safety, reading, target)) {
      actions.push({ type: 'clear', reason: 'drastic_drop' });
      return { safety: null, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }
    safety = {
      ...safety,
      injectionLocked: true,
      reason: 'hold_await_drop',
    };
    return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  // —— Ventilación ≥ 410 / en curso ——
  if (safety?.phase === 'ventilate' || reading >= ETHYLENE_VENT_PPM) {
    if (safety?.phase !== 'ventilate') {
      actions.push({ type: 'vent_start', reason: 'runaway_410' });
      safety = {
        ...(safety || {}),
        phase: 'ventilate',
        enteredAt: safety?.enteredAt || new Date(now).toISOString(),
        ventUntil: new Date(now + ETHYLENE_VENT_DURATION_MS).toISOString(),
        watchUntil: null,
        readingAtEnter: reading,
        targetPpm: target,
        overshootThreshold: thr.thr20,
        thr20: thr.thr20,
        thr60: thr.thr60,
        thr100: thr.thr100,
        hit20: Boolean(safety?.hit20) || reading >= thr.thr20,
        hit60: Boolean(safety?.hit60),
        hit100: Boolean(safety?.hit100),
        hit400: Boolean(safety?.hit400),
        pulseCount: Number(safety?.pulseCount) || 0,
        lastPulseAt: safety?.lastPulseAt ?? null,
        injectionLocked: true,
        peakReading: Math.max(Number(safety?.peakReading) || 0, reading),
        lastKnownReading: reading,
        reason: 'runaway_410',
      };
    } else {
      safety = { ...safety, injectionLocked: true };
    }

    const ventUntilMs = safety.ventUntil
      ? new Date(safety.ventUntil).getTime()
      : now + ETHYLENE_VENT_DURATION_MS;

    // Durante vent: solo pulso si vuelve a ≥ 400 (no si está bajo 400).
    if (reading >= ETHYLENE_HIGH_PULSE_PPM && reading < ETHYLENE_VENT_PPM && canPulse(safety, now)) {
      actions.push({ type: 'pulse', reason: 'vent_back_over_400' });
      safety = applyPulse(withReadingMeta(safety, reading, now), reading, now, 'vent_back_over_400', {
        hit400: true,
      });
    }

    if (now >= ventUntilMs) {
      actions.push({ type: 'vent_end', reason: 'vent_timeout_20min' });
      safety = {
        ...safety,
        phase: 'hold_no_inject',
        ventUntil: null,
        injectionLocked: true,
        reason: 'post_vent_hold',
      };
      return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  // —— Consulta 20 min tras pulso(s) ——
  if (safety?.phase === 'consult') {
    // Escalada por umbrales (prioridad: 100% → 60% → 400 con prerequisitos).
    if (reading >= thr.thr100 && !safety.hit100 && canPulse(safety, now)) {
      actions.push({ type: 'pulse', reason: 'overshoot_1_00' });
      safety = applyPulse(safety, reading, now, 'overshoot_1_00', {
        hit20: true,
        hit60: true,
        hit100: true,
      });
      return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    if (reading >= thr.thr60 && !safety.hit60 && canPulse(safety, now)) {
      actions.push({ type: 'pulse', reason: 'overshoot_1_60' });
      safety = applyPulse(safety, reading, now, 'overshoot_1_60', {
        hit20: true,
        hit60: true,
      });
      return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    if (
      reading >= ETHYLENE_HIGH_PULSE_PPM &&
      safety.hit20 &&
      safety.hit60 &&
      !safety.hit400 &&
      canPulse(safety, now)
    ) {
      actions.push({ type: 'pulse', reason: 'overshoot_400' });
      safety = applyPulse(safety, reading, now, 'overshoot_400', { hit400: true });
      return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    const watchUntilMs = safety.watchUntil ? new Date(safety.watchUntil).getTime() : 0;
    if (reading <= thr.thr20) {
      // Se estabilizó bajo +20% sin llegar a saturación → reanudar normal.
      if (!safety.hit60 && !safety.hit400 && !safety.injectionLocked) {
        actions.push({ type: 'clear', reason: 'stabilized' });
        return { safety: null, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
      }
    }

    if (now >= watchUntilMs) {
      if (reading <= thr.thr20 && !safety.hit60 && !safety.hit400) {
        actions.push({ type: 'clear', reason: 'consult_complete_stable' });
        return { safety: null, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
      }
      // Sigue alto tras consulta: bloquear reinfiltración (fruta consumirá exceso).
      safety = {
        ...safety,
        phase: 'hold_no_inject',
        injectionLocked: true,
        watchUntil: null,
        reason: 'consult_end_hold',
      };
      return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  // —— Entrada: +20% con confirmación anti-spike ——
  if (reading >= thr.thr20) {
    const streak = (Number(safety?.overshootStreak) || 0) + 1;
    if (streak < ETHYLENE_OVERSHOOT_CONFIRM) {
      safety = {
        phase: null,
        overshootStreak: streak,
        targetPpm: target,
        overshootThreshold: thr.thr20,
        thr20: thr.thr20,
        thr60: thr.thr60,
        thr100: thr.thr100,
        lastOvershootReading: reading,
        lastKnownReading: reading,
        readingNull: false,
        reason: 'overshoot_confirming',
      };
      return { safety, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    actions.push({ type: 'pulse', reason: 'overshoot_1_20' });
    safety = startConsultAfterFirstPulse(target, thr, reading, now, streak);
    return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  // Lectura bajo umbral: limpiar streak de confirmación.
  if (safety && !safety.phase && safety.overshootStreak) {
    return { safety: null, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  return {
    safety: safety?.phase ? safety : null,
    actions,
    suspendNormal: isEthyleneInjectionLocked(safety),
    pollMs: ETHYLENE_SAFETY_POLL_MS,
  };
}
