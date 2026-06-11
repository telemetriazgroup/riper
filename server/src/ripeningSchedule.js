/** Tiempo efectivo de seguimiento: pausas no cuentan; el fin se desplaza por `totalPausedMs`. */

function phaseDurationHours(p) {
  if (!p || p.enabled === false) return 0;
  const d = Number(p.duration);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return String(p.type || '') === 'venting' ? d / 60 : d;
}

export function totalRecipeHoursFromPayload(payload) {
  const raw = payload?.recipe?.phases;
  if (!Array.isArray(raw)) return Number(payload?.scheduleSummary?.totalDurationHours) || 0;
  return raw
    .filter((p) => p && p.enabled !== false)
    .reduce((acc, p) => acc + phaseDurationHours(p), 0);
}

/** Duración activa planificada (sin pausas). */
export function getPlannedDurationMs(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  const schedule = payload.scheduleSummary || {};
  const explicit = Number(schedule.plannedDurationMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const totalHours = Number(schedule.totalDurationHours) || totalRecipeHoursFromPayload(payload);
  if (totalHours > 0) return totalHours * 3600 * 1000;
  const s = schedule.startedAt ? new Date(schedule.startedAt).getTime() : NaN;
  const est = schedule.estimatedEndAt ? new Date(schedule.estimatedEndAt).getTime() : NaN;
  const paused = Number(schedule.totalPausedMs) || 0;
  if (Number.isFinite(s) && Number.isFinite(est) && est > s) {
    return Math.max(0, est - s - paused);
  }
  return 0;
}

/** Pausas cerradas + pausa abierta si `status === paused`. */
export function getTotalPausedMs(payload, nowMs = Date.now(), status = 'active') {
  if (!payload || typeof payload !== 'object') return 0;
  const schedule = payload.scheduleSummary || {};
  let total = Number(schedule.totalPausedMs) || 0;
  if (String(status).toLowerCase() === 'paused') {
    const pausedAt = payload.pauseState?.pausedAt;
    if (pausedAt) {
      const p0 = new Date(String(pausedAt)).getTime();
      if (Number.isFinite(p0)) total += Math.max(0, nowMs - p0);
    }
  }
  return total;
}

/** Milisegundos de proceso activo transcurridos (congelado en pausa). */
export function getActiveElapsedMs(payload, status = 'active', nowMs = Date.now()) {
  if (!payload || typeof payload !== 'object') return 0;
  const schedule = payload.scheduleSummary || {};
  const startMs = schedule.startedAt ? new Date(String(schedule.startedAt)).getTime() : NaN;
  if (!Number.isFinite(startMs)) return 0;
  const closedPaused = Number(schedule.totalPausedMs) || 0;
  const reactivatedAt = schedule.reactivatedAt ? new Date(String(schedule.reactivatedAt)).getTime() : NaN;
  const elapsedAnchor = Number(schedule.elapsedMsAnchor);
  const segmentMs = Number(schedule.currentExtensionMs);

  if (Number.isFinite(reactivatedAt) && Number.isFinite(elapsedAnchor) && elapsedAnchor >= 0) {
    const pausedSince = getTotalPausedMs(payload, nowMs, status);
    if (String(status).toLowerCase() === 'paused') {
      const pausedAt = payload.pauseState?.pausedAt;
      if (pausedAt) {
        const p0 = new Date(String(pausedAt)).getTime();
        if (Number.isFinite(p0)) {
          return elapsedAnchor + Math.max(0, p0 - reactivatedAt - pausedSince);
        }
      }
      const pPct = Number(payload.pauseState?.progressAtPause);
      const planned = getPlannedDurationMs(payload);
      if (Number.isFinite(pPct) && planned > 0) return (pPct / 100) * planned;
      return elapsedAnchor;
    }
    const since = Math.max(0, nowMs - reactivatedAt - pausedSince);
    if (Number.isFinite(segmentMs) && segmentMs > 0) {
      return elapsedAnchor + Math.min(segmentMs, since);
    }
    return elapsedAnchor + since;
  }

  if (String(status).toLowerCase() === 'paused') {
    const pausedAt = payload.pauseState?.pausedAt;
    if (pausedAt) {
      const p0 = new Date(String(pausedAt)).getTime();
      if (Number.isFinite(p0)) return Math.max(0, p0 - startMs - closedPaused);
    }
    const pPct = Number(payload.pauseState?.progressAtPause);
    const planned = getPlannedDurationMs(payload);
    if (Number.isFinite(pPct) && planned > 0) return (pPct / 100) * planned;
    return 0;
  }

  return Math.max(0, nowMs - startMs - getTotalPausedMs(payload, nowMs, status));
}

/** Fin efectivo en ms (incluye pausas acumuladas). */
export function getEffectiveEstimatedEndMs(payload, nowMs = Date.now(), status = 'active') {
  if (!payload || typeof payload !== 'object') return null;
  const schedule = payload.scheduleSummary || {};
  const startMs = schedule.startedAt ? new Date(String(schedule.startedAt)).getTime() : NaN;
  if (!Number.isFinite(startMs)) return null;
  const planned = getPlannedDurationMs(payload);
  if (planned <= 0) {
    const est = schedule.estimatedEndAt ? new Date(String(schedule.estimatedEndAt)).getTime() : NaN;
    return Number.isFinite(est) ? est : null;
  }

  const reactivatedAt = schedule.reactivatedAt ? new Date(String(schedule.reactivatedAt)).getTime() : NaN;
  const segmentMs = Number(schedule.currentExtensionMs);
  if (Number.isFinite(reactivatedAt) && Number.isFinite(segmentMs) && segmentMs > 0) {
    const paused = getTotalPausedMs(payload, nowMs, status);
    return reactivatedAt + segmentMs + paused;
  }

  const paused = getTotalPausedMs(payload, nowMs, status);
  return startMs + planned + paused;
}

export function progressFromTrackingPayload(payload, status = 'active', nowMs = Date.now()) {
  if (!payload || typeof payload !== 'object') return 0;
  const planned = getPlannedDurationMs(payload);
  if (planned <= 0) return 0;

  if (String(status).toLowerCase() === 'paused') {
    const pPct = Number(payload.pauseState?.progressAtPause);
    if (Number.isFinite(pPct)) return Math.min(100, Math.max(0, Math.round(pPct)));
  }

  const elapsed = getActiveElapsedMs(payload, status, nowMs);
  return Math.min(100, Math.max(0, Math.round((elapsed / planned) * 100)));
}

/** Sincroniza `estimatedEndAt` y `totalDurationHours` tras cambios de receta o pausa. */
export function syncScheduleSummary(payload, status = 'active', nowMs = Date.now()) {
  const schedule = { ...(payload.scheduleSummary || {}) };
  const totalHours = totalRecipeHoursFromPayload(payload);
  if (totalHours > 0) schedule.totalDurationHours = totalHours;

  const planned = getPlannedDurationMs({ ...payload, scheduleSummary: schedule });
  if (planned > 0 && !schedule.plannedDurationMs) {
    schedule.plannedDurationMs = planned;
  }

  const endMs = getEffectiveEstimatedEndMs(
    { ...payload, scheduleSummary: schedule },
    nowMs,
    status
  );
  if (endMs != null) schedule.estimatedEndAt = new Date(endMs).toISOString();

  return schedule;
}

export function ensurePlannedDurationOnCreate(payload) {
  const schedule = { ...(payload.scheduleSummary || {}) };
  schedule.totalPausedMs = Number(schedule.totalPausedMs) || 0;
  const s = schedule.startedAt ? new Date(String(schedule.startedAt)).getTime() : NaN;
  const est = schedule.estimatedEndAt ? new Date(String(schedule.estimatedEndAt)).getTime() : NaN;
  if (!schedule.plannedDurationMs && Number.isFinite(s) && Number.isFinite(est) && est > s) {
    schedule.plannedDurationMs = est - s;
  }
  if (!schedule.plannedDurationMs) {
    const h = Number(schedule.totalDurationHours) || totalRecipeHoursFromPayload(payload);
    if (h > 0) schedule.plannedDurationMs = h * 3600 * 1000;
  }
  return schedule;
}

/** Recalcula duración tras editar receta en curso. */
export function recalcScheduleAfterPayloadEdit(mergedPayload, previousPayload, status = 'active') {
  const prevHours = totalRecipeHoursFromPayload(previousPayload);
  const nextHours = totalRecipeHoursFromPayload(mergedPayload);
  const schedule = { ...(mergedPayload.scheduleSummary || {}) };

  if (nextHours > 0) schedule.totalDurationHours = nextHours;

  const prevPlanned = getPlannedDurationMs(previousPayload);
  let planned = prevPlanned;
  if (prevHours > 0 && nextHours > 0 && prevHours !== nextHours) {
    planned = Math.round((prevPlanned * nextHours) / prevHours);
  } else if (nextHours > 0) {
    planned = nextHours * 3600 * 1000;
  }
  if (planned > 0) schedule.plannedDurationMs = planned;

  const synced = syncScheduleSummary(
    { ...mergedPayload, scheduleSummary: schedule },
    status
  );
  return synced;
}

export function buildPauseState(payload, status, userMeta, nowMs = Date.now()) {
  const progressAtPause = progressFromTrackingPayload(payload, status, nowMs);
  return {
    pausedAt: new Date(nowMs).toISOString(),
    progressAtPause,
    byUserId: userMeta.userId ?? null,
    byEmail: userMeta.email ?? null,
    byName: userMeta.name ?? null,
  };
}

export function applyPauseToPayload(payload, userMeta, nowMs = Date.now()) {
  const pauseState = {
    ...buildPauseState(payload, 'active', userMeta, nowMs),
    automationSuspended: true,
    trackingControlSnapshot: payload.trackingControl ?? null,
    controlAutomationSnapshot: payload.controlAutomation ?? null,
  };
  const schedule = syncScheduleSummary(payload, 'active', nowMs);
  const next = {
    ...payload,
    scheduleSummary: schedule,
    pauseState,
    pauseIntervals: [
      ...(Array.isArray(payload.pauseIntervals) ? payload.pauseIntervals : []),
      { from: pauseState.pausedAt, byUserId: userMeta.userId ?? null },
    ],
    trackingControl: {
      ...(payload.trackingControl && typeof payload.trackingControl === 'object'
        ? payload.trackingControl
        : {}),
      automationActive: false,
      pausedAt: pauseState.pausedAt,
      updatedAt: new Date(nowMs).toISOString(),
    },
    source: 'tracking_paused',
  };
  delete next.controlAutomation;
  return next;
}

export function applyResumeToPayload(payload, nowMs = Date.now()) {
  const pauseState = payload.pauseState || {};
  const pausedAt = pauseState.pausedAt ? new Date(String(pauseState.pausedAt)).getTime() : NaN;
  if (!Number.isFinite(pausedAt)) {
    throw new Error('no open pause interval');
  }
  const pauseMs = Math.max(0, nowMs - pausedAt);
  const schedule = { ...(payload.scheduleSummary || {}) };
  schedule.totalPausedMs = (Number(schedule.totalPausedMs) || 0) + pauseMs;

  const intervals = Array.isArray(payload.pauseIntervals) ? [...payload.pauseIntervals] : [];
  if (intervals.length) {
    const last = intervals[intervals.length - 1];
    if (last && !last.to) intervals[intervals.length - 1] = { ...last, to: new Date(nowMs).toISOString() };
  }

  const nextPayload = {
    ...payload,
    scheduleSummary: syncScheduleSummary({ ...payload, scheduleSummary: schedule }, 'active', nowMs),
    pauseIntervals: intervals,
    source: 'tracking_automation',
    trackingControl: {
      ...(payload.trackingControl && typeof payload.trackingControl === 'object'
        ? payload.trackingControl
        : {}),
      automationActive: true,
      pausedAt: null,
      updatedAt: new Date(nowMs).toISOString(),
    },
  };
  delete nextPayload.pauseState;
  return nextPayload;
}

export function buildTimelineControlEvent(type, title, userMeta, extra = {}) {
  return {
    id: `ev-${type}-${Date.now()}`,
    type: 'control',
    title,
    timestamp: new Date().toISOString(),
    user: userMeta.name || userMeta.email || 'Sistema',
    persona_escrita: userMeta.name || userMeta.email || 'Sistema',
    registered_by_user_id: userMeta.userId ?? null,
    registered_by_email: userMeta.email ?? null,
    description: extra.description || undefined,
    data: extra.data || [],
  };
}
