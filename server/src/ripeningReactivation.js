/**
 * Cierre y reactivación de seguimientos (superadmin): conserva fase/progreso al cerrar
 * y extiende horas activas desde la reactivación para enriquecer el reporte.
 */
import {
  getActiveElapsedMs,
  getPlannedDurationMs,
  progressFromTrackingPayload,
  buildTimelineControlEvent,
} from './ripeningSchedule.js';
import { inferCurrentTrackingPhase } from './ripeningPhaseInference.js';

function phaseDurationHours(p) {
  if (!p || p.enabled === false) return 0;
  const d = Number(p.duration);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return String(p.type || '') === 'venting' ? d / 60 : d;
}

function addHoursToPhaseRaw(raw, extensionHours) {
  const pr = raw && typeof raw === 'object' ? { ...raw } : {};
  const type = String(pr.type || '').trim();
  const ext = Number(extensionHours);
  if (!Number.isFinite(ext) || ext <= 0) return pr;
  const dur = Number(pr.duration) || 0;
  if (type === 'venting') {
    pr.duration = dur + ext * 60;
  } else {
    pr.duration = dur + ext;
  }
  return pr;
}

/** Snapshot al completar o cancelar (para reactivación posterior). */
export function buildClosureSnapshot(payload, currentStatus, closureReason, nowMs = Date.now()) {
  const st = String(currentStatus || 'active').toLowerCase();
  const statusForProgress = st === 'paused' ? 'paused' : 'active';
  const progress = progressFromTrackingPayload(payload, statusForProgress, nowMs);
  const activeElapsedMs = getActiveElapsedMs(payload, statusForProgress, nowMs);
  const phaseInfo = inferCurrentTrackingPhase(payload, progress);
  return {
    at: new Date(nowMs).toISOString(),
    closureReason: String(closureReason || '').toLowerCase(),
    statusAtClose: st,
    progress,
    activeElapsedMs,
    phaseIndex: phaseInfo.currentIndex,
    phaseType: phaseInfo.currentType,
    phaseLabel: phaseInfo.currentLabel,
    plannedDurationMsAtClose: getPlannedDurationMs(payload),
  };
}

function resolveClosureSnapshot(payload, rowStatus, rowUpdatedAt) {
  if (payload._closureSnapshot && typeof payload._closureSnapshot === 'object') {
    return payload._closureSnapshot;
  }
  const at =
    payload._completedMeta?.at ||
    payload._cancelledMeta?.at ||
    rowUpdatedAt ||
    new Date().toISOString();
  const atMs = new Date(String(at)).getTime();
  const progress =
    Number(payload._completedMeta?.progress) ||
    Number(payload._closureSnapshot?.progress) ||
    progressFromTrackingPayload(payload, rowStatus, Number.isFinite(atMs) ? atMs : Date.now());
  const phaseInfo = inferCurrentTrackingPhase(payload, progress);
  const planned = getPlannedDurationMs(payload);
  return {
    at: String(at),
    closureReason: String(rowStatus).toLowerCase(),
    statusAtClose: 'active',
    progress,
    activeElapsedMs:
      Number.isFinite(atMs) && planned > 0
        ? Math.min(planned, (progress / 100) * planned)
        : getActiveElapsedMs(payload, rowStatus),
    phaseIndex: phaseInfo.currentIndex,
    phaseType: phaseInfo.currentType,
    phaseLabel: phaseInfo.currentLabel,
    plannedDurationMsAtClose: planned,
  };
}

/**
 * Aplica reactivación: extiende receta (fase al cierre), planifica segmento activo y ancla progreso.
 * @returns {{ payload: object, timelineEvent: object, summary: object }}
 */
export function applyReactivationToPayload(
  payload,
  {
    extensionHours,
    previousStatus,
    rowUpdatedAt,
    userMeta,
    note,
    nowMs = Date.now(),
  }
) {
  const extH = Number(extensionHours);
  if (!Number.isFinite(extH) || extH <= 0) {
    throw new Error('extensionHours must be a positive number');
  }
  if (extH > 720) {
    throw new Error('extensionHours exceeds maximum (720 h)');
  }

  const closure = resolveClosureSnapshot(payload, previousStatus, rowUpdatedAt);
  const extensionMs = extH * 3600 * 1000;
  const schedule = { ...(payload.scheduleSummary || {}) };
  const prevPlanned = getPlannedDurationMs(payload) || closure.plannedDurationMsAtClose || 0;
  schedule.plannedDurationMs = prevPlanned + extensionMs;
  schedule.totalDurationHours =
    (Number(schedule.totalDurationHours) || 0) + extH ||
    schedule.plannedDurationMs / 3600000;
  schedule.reactivatedAt = new Date(nowMs).toISOString();
  schedule.elapsedMsAnchor = Math.max(0, Number(closure.activeElapsedMs) || 0);
  schedule.currentExtensionMs = extensionMs;
  schedule.totalPausedMs = 0;
  schedule.estimatedEndAt = new Date(nowMs + extensionMs).toISOString();
  schedule.lastClosureAt = closure.at;

  const recipe = payload.recipe && typeof payload.recipe === 'object' ? { ...payload.recipe } : {};
  const phases = Array.isArray(recipe.phases) ? recipe.phases.map((p) => ({ ...p })) : [];
  const phaseIdx = Math.max(0, Number(closure.phaseIndex) || 0);
  if (phases[phaseIdx]) {
    phases[phaseIdx] = addHoursToPhaseRaw(phases[phaseIdx], extH);
  }
  recipe.phases = phases;

  const reactivationEntry = {
    at: schedule.reactivatedAt,
    extensionHours: extH,
    extensionMs,
    closureAt: closure.at,
    closureStatus: closure.closureReason || previousStatus,
    progressAtClosure: closure.progress,
    phaseIndex: closure.phaseIndex,
    phaseType: closure.phaseType,
    phaseLabel: closure.phaseLabel,
    note: note ? String(note).trim().slice(0, 500) : null,
    byUserId: userMeta.userId ?? null,
    byEmail: userMeta.email ?? null,
    byName: userMeta.name ?? null,
  };

  const history = Array.isArray(payload.reactivationHistory)
    ? [...payload.reactivationHistory, reactivationEntry]
    : [reactivationEntry];

  const nextPayload = {
    ...payload,
    recipe,
    scheduleSummary: schedule,
    reactivationHistory: history,
    trackingControl: {
      ...(payload.trackingControl && typeof payload.trackingControl === 'object'
        ? payload.trackingControl
        : {}),
      phaseIndex: closure.phaseIndex,
      phaseType: closure.phaseType,
      phaseLabel: closure.phaseLabel,
      automationActive: true,
      reactivatedAt: schedule.reactivatedAt,
      updatedAt: new Date(nowMs).toISOString(),
    },
    source: 'tracking_automation',
  };
  delete nextPayload.controlAutomation;
  delete nextPayload.pauseState;
  delete nextPayload._completedMeta;

  const phaseLabel = closure.phaseLabel || closure.phaseType || '—';
  const timelineEvent = buildTimelineControlEvent('reactivate', 'Seguimiento reactivado', userMeta, {
    description: note
      ? String(note).trim()
      : `Extensión de ${extH} h desde ${phaseLabel} (cierre ${closure.closureReason || previousStatus}).`,
    data: [
      { name: 'Horas añadidas', value: String(extH), unit: 'h' },
      { name: 'Fase al cierre', value: phaseLabel, unit: '' },
      { name: 'Progreso al cierre', value: String(closure.progress), unit: '%' },
      { name: 'Cierre', value: closure.at, unit: '' },
      { name: 'Fin estimado', value: schedule.estimatedEndAt, unit: '' },
    ],
  });

  return {
    payload: nextPayload,
    timelineEvent,
    summary: {
      closure,
      extensionHours: extH,
      estimatedEndAt: schedule.estimatedEndAt,
    },
  };
}
