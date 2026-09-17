/**
 * Seguridad etileno: relé pegado / runaway (ver error_gas.md).
 * Evaluación pura; el caller ejecuta comandos físicos (tipo 5 dato=1, tipo 6 AVL).
 */

export const ETHYLENE_OVERSHOOT_RATIO = 1.2;
/** Pulso físico anti-relé (segundos de relé ON). */
export const ETHYLENE_STUCK_PULSE_DATO = 1;
export const ETHYLENE_STUCK_WATCH_MS = 10 * 60 * 1000;
export const ETHYLENE_RUNAWAY_PPM = 270;
export const ETHYLENE_VENT_AVL = 200;
export const ETHYLENE_VENT_DURATION_MS = 15 * 60 * 1000;
export const ETHYLENE_SAFETY_MAX_PULSES = 3;
/** Poll más frecuente en modo seguridad. */
export const ETHYLENE_SAFETY_POLL_MS = 2 * 60 * 1000;
/** Lecturas consecutivas sobre umbral antes de actuar (anti-spike). */
export const ETHYLENE_OVERSHOOT_CONFIRM = 2;
/** Subida mínima en la ventana de watch para considerar tendencia alcista. */
export const ETHYLENE_RISE_MIN_PPM = 5;

export function overshootThresholdPpm(target) {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return null;
  return Number((t * ETHYLENE_OVERSHOOT_RATIO).toFixed(2));
}

export function isEthyleneSafetyActive(safety) {
  return Boolean(safety && safety.phase);
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
  const reading =
    input?.reading != null && Number.isFinite(Number(input.reading)) ? Number(input.reading) : null;
  let safety = input?.safety && typeof input.safety === 'object' ? { ...input.safety } : null;
  const actions = [];
  const thr = overshootThresholdPpm(target);

  if (!Number.isFinite(target) || target <= 0 || thr == null) {
    return {
      safety,
      actions,
      suspendNormal: isEthyleneSafetyActive(safety),
      pollMs: ETHYLENE_SAFETY_POLL_MS,
    };
  }

  if (reading == null) {
    return {
      safety,
      actions,
      suspendNormal: isEthyleneSafetyActive(safety),
      pollMs: ETHYLENE_SAFETY_POLL_MS,
    };
  }

  // —— Emergencia ≥ 270 ——
  if (reading >= ETHYLENE_RUNAWAY_PPM) {
    if (safety?.phase !== 'ventilate') {
      actions.push({ type: 'vent_start', reason: 'runaway_270' });
      safety = {
        phase: 'ventilate',
        enteredAt: new Date(now).toISOString(),
        ventUntil: new Date(now + ETHYLENE_VENT_DURATION_MS).toISOString(),
        watchUntil: null,
        readingAtEnter: reading,
        readingAtPulse: reading,
        targetPpm: target,
        overshootThreshold: thr,
        pulseCount: safety?.pulseCount ?? 0,
        overshootStreak: safety?.overshootStreak ?? 0,
        lastPulseAt: safety?.lastPulseAt ?? null,
        reason: 'runaway_270',
      };
    } else {
      safety = { ...safety, readingAtEnter: reading };
    }

    const ventUntilMs = safety.ventUntil ? new Date(safety.ventUntil).getTime() : now + ETHYLENE_VENT_DURATION_MS;
    // Salida: lectura ≤ 120% del set (y preferible tras haber iniciado vent).
    if (reading <= thr) {
      actions.push({ type: 'vent_end', reason: 'back_under_overshoot' });
      actions.push({ type: 'clear', reason: 'vent_complete' });
      return { safety: null, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }
    // Tope 15 min: si sigue alto, pasar a watch (no inyectar) en lugar de ventilar eternamente.
    if (now >= ventUntilMs) {
      actions.push({ type: 'vent_end', reason: 'vent_timeout' });
      safety = {
        ...safety,
        phase: 'watch_rise',
        watchUntil: new Date(now + ETHYLENE_STUCK_WATCH_MS).toISOString(),
        ventUntil: null,
        readingAtPulse: reading,
        reason: 'vent_timeout_still_high',
      };
      return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  // —— Ya en ventilación pero bajó de 270: seguir hasta ≤ thr o timeout ——
  if (safety?.phase === 'ventilate') {
    const ventUntilMs = safety.ventUntil ? new Date(safety.ventUntil).getTime() : now;
    if (reading <= thr) {
      actions.push({ type: 'vent_end', reason: 'back_under_overshoot' });
      actions.push({ type: 'clear', reason: 'vent_complete' });
      return { safety: null, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }
    if (now >= ventUntilMs) {
      actions.push({ type: 'vent_end', reason: 'vent_timeout' });
      safety = {
        ...safety,
        phase: 'watch_rise',
        watchUntil: new Date(now + ETHYLENE_STUCK_WATCH_MS).toISOString(),
        ventUntil: null,
        readingAtPulse: reading,
        reason: 'vent_timeout_still_high',
      };
    }
    return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  // —— Watch tras pulso ——
  if (safety?.phase === 'watch_rise') {
    if (reading <= thr) {
      actions.push({ type: 'clear', reason: 'stabilized' });
      return { safety: null, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    const watchUntilMs = safety.watchUntil ? new Date(safety.watchUntil).getTime() : 0;
    const baseline = Number(safety.readingAtPulse ?? safety.readingAtEnter);
    const rising =
      Number.isFinite(baseline) && reading >= baseline + ETHYLENE_RISE_MIN_PPM;

    if (now >= watchUntilMs && rising) {
      const pulses = Number(safety.pulseCount) || 0;
      if (pulses < ETHYLENE_SAFETY_MAX_PULSES) {
        actions.push({ type: 'pulse', reason: 'watch_still_rising' });
        safety = {
          ...safety,
          pulseCount: pulses + 1,
          lastPulseAt: new Date(now).toISOString(),
          readingAtPulse: reading,
          watchUntil: new Date(now + ETHYLENE_STUCK_WATCH_MS).toISOString(),
          reason: 'watch_still_rising',
        };
      } else {
        // Sin más pulsos: mantener suspensión y reloj corto.
        safety = {
          ...safety,
          watchUntil: new Date(now + ETHYLENE_STUCK_WATCH_MS).toISOString(),
          reason: 'max_pulses_hold',
        };
      }
    }

    return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  // —— Entrada: overshoot con confirmación anti-spike ——
  if (reading >= thr) {
    const streak = (Number(safety?.overshootStreak) || 0) + 1;
    if (streak < ETHYLENE_OVERSHOOT_CONFIRM) {
      safety = {
        phase: null,
        overshootStreak: streak,
        targetPpm: target,
        overshootThreshold: thr,
        lastOvershootReading: reading,
        reason: 'overshoot_confirming',
      };
      return { safety, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
    }

    actions.push({ type: 'pulse', reason: 'overshoot_1_20' });
    safety = {
      phase: 'watch_rise',
      enteredAt: new Date(now).toISOString(),
      watchUntil: new Date(now + ETHYLENE_STUCK_WATCH_MS).toISOString(),
      ventUntil: null,
      readingAtEnter: reading,
      readingAtPulse: reading,
      targetPpm: target,
      overshootThreshold: thr,
      pulseCount: 1,
      overshootStreak: streak,
      lastPulseAt: new Date(now).toISOString(),
      reason: 'overshoot_1_20',
    };
    return { safety, actions, suspendNormal: true, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  // Lectura bajo umbral: limpiar streak de confirmación.
  if (safety && !safety.phase && safety.overshootStreak) {
    return { safety: null, actions, suspendNormal: false, pollMs: ETHYLENE_SAFETY_POLL_MS };
  }

  return {
    safety: safety?.phase ? safety : null,
    actions,
    suspendNormal: isEthyleneSafetyActive(safety),
    pollMs: ETHYLENE_SAFETY_POLL_MS,
  };
}
