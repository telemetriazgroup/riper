/** Inferencia de etapa actual del seguimiento (receta multi-fase). Espejo de ripeningProcessMappers. */

import { getTotalPausedMs, progressFromTrackingPayload as progressFromSchedule } from './ripeningSchedule.js';

function phaseDurationHours(p) {
  if (!p || p.enabled === false) return 0;
  const d = Number(p.duration);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return String(p.type || '') === 'venting' ? d / 60 : d;
}

export function progressFromTrackingPayload(payload, status = 'active', nowMs = Date.now()) {
  return progressFromSchedule(payload, status, nowMs);
}

export function enabledRecipePhases(payload) {
  const raw = payload?.recipe?.phases;
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => p && p.enabled !== false);
}

const PHASE_TYPE_LABELS = {
  homogenization: 'Homogenization',
  ripening: 'Ripening',
  venting: 'Ventilation',
  cooling: 'Cooling',
};

function phaseDisplayLabel(pr, idx) {
  const name = String(pr.name ?? '').trim();
  if (name) return name;
  const type = String(pr.type ?? '').trim();
  if (type === 'homogenization' && pr.meatControl === true) {
    return 'Homogenización - Carnes';
  }
  return PHASE_TYPE_LABELS[type] || type || `phase-${idx + 1}`;
}

/**
 * @returns {{
 *   currentIndex: number,
 *   currentType: string,
 *   currentLabel: string,
 *   phaseRaw: Record<string, unknown>,
 *   phaseEndAt: string | null,
 *   phasesMeta: { type: string, label: string, hours: number, raw: Record<string, unknown> }[],
 * }}
 */
export function inferCurrentTrackingPhase(payload, progressPct) {
  const phases = enabledRecipePhases(payload);
  const schedule = payload?.scheduleSummary || {};
  const startMs = schedule.startedAt ? new Date(schedule.startedAt).getTime() : NaN;

  const phasesMeta = phases.map((p, idx) => {
    const pr = p && typeof p === 'object' ? p : {};
    const type = String(pr.type ?? '').trim();
    const label = phaseDisplayLabel(pr, idx);
    return {
      type,
      label,
      hours: phaseDurationHours(pr),
      raw: pr,
    };
  });

  const pSafe = Math.min(100, Math.max(0, Number(progressPct) || 0));
  let currentIndex = 0;
  const totalH = phasesMeta.reduce((a, x) => a + x.hours, 0);

  if (totalH > 0 && phasesMeta.length) {
    const elapsed = (pSafe / 100) * totalH;
    let cum = 0;
    for (let i = 0; i < phasesMeta.length; i++) {
      cum += phasesMeta[i].hours;
      currentIndex = i;
      if (elapsed <= cum) break;
    }
  } else if (phasesMeta.length) {
    const n = phasesMeta.length;
    currentIndex = Math.min(n - 1, Math.floor((pSafe / 100) * n));
  }

  const cur = phasesMeta[currentIndex] ?? phasesMeta[0];
  let phaseEndAt = null;
  if (Number.isFinite(startMs) && phasesMeta.length) {
    const totalPaused = getTotalPausedMs(payload, Date.now(), 'active');
    let accH = 0;
    for (let i = 0; i <= currentIndex; i++) {
      accH += phasesMeta[i]?.hours ?? 0;
    }
    phaseEndAt = new Date(startMs + totalPaused + accH * 3600 * 1000).toISOString();
  }

  return {
    currentIndex,
    currentType: cur?.type ?? '',
    currentLabel: cur?.label ?? '—',
    phaseRaw: cur?.raw ?? {},
    phaseEndAt,
    phasesMeta,
  };
}

const PHASE_TO_PROCESS = {
  homogenization: 'Homogenization',
  ripening: 'Ripening',
  venting: 'Ventilation',
  cooling: 'Cooling',
};

export function trackingPhaseToProcessType(phaseType) {
  return PHASE_TO_PROCESS[String(phaseType || '').trim()] ?? null;
}

/** Parámetros de control panel a partir de la fase de receta activa. */
export function controlParamsFromPhaseRaw(phaseRaw, processType) {
  const p = phaseRaw && typeof phaseRaw === 'object' ? phaseRaw : {};
  const out = {};
  const temp = Number(p.temp);
  if (Number.isFinite(temp)) out.setPoint = temp;
  const rh = Number(p.humidity);
  if (Number.isFinite(rh)) out.humiditySetPoint = rh;
  const eth = Number(p.ethylene);
  if (Number.isFinite(eth)) out.ethylene = eth;
  const co2 = Number(p.co2Limit);
  if (Number.isFinite(co2)) {
    out.co2 = co2;
    if (processType === 'Ventilation') out.targetCo2 = co2;
  }
  const dur = Number(p.duration);
  if (Number.isFinite(dur) && dur > 0) {
    if (processType === 'Ventilation') out.durationMin = dur;
    else out.durationHours = dur;
  }
  if (p.meatControl === true) {
    out.meatControl = true;
    const airEx = Number(p.airExchangeMinutes);
    if (Number.isFinite(airEx) && airEx > 0) out.airExchangeMinutes = airEx;
    const airRen = Number(p.airRenewalHours);
    if (Number.isFinite(airRen) && airRen > 0) out.airRenewalHours = airRen;
  }
  out.trackingPhaseType = String(p.type ?? '');
  return out;
}
