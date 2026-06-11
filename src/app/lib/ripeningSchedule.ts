/** Cliente: tiempo efectivo de seguimiento (pausas no cuentan). */

type ScheduleSummary = {
  startedAt?: string;
  estimatedEndAt?: string | null;
  totalDurationHours?: number;
  plannedDurationMs?: number;
  totalPausedMs?: number;
  reactivatedAt?: string;
  elapsedMsAnchor?: number;
  currentExtensionMs?: number;
  lastClosureAt?: string;
};

type PayloadLike = {
  scheduleSummary?: ScheduleSummary;
  pauseState?: { pausedAt?: string; progressAtPause?: number };
  recipe?: { phases?: { enabled?: boolean; duration?: number; type?: string }[] };
  _closureSnapshot?: {
    at?: string;
    progress?: number;
    phaseLabel?: string;
    phaseType?: string;
    closureReason?: string;
  };
  reactivationHistory?: { at?: string; extensionHours?: number; closureAt?: string }[];
};

function phaseDurationHours(p: { enabled?: boolean; duration?: number; type?: string }) {
  if (!p || p.enabled === false) return 0;
  const d = Number(p.duration);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return String(p.type || '') === 'venting' ? d / 60 : d;
}

export function getPlannedDurationMs(payload: PayloadLike | null | undefined): number {
  if (!payload) return 0;
  const schedule = payload.scheduleSummary || {};
  const explicit = Number(schedule.plannedDurationMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const raw = payload.recipe?.phases;
  const totalHours =
    Number(schedule.totalDurationHours) ||
    (Array.isArray(raw)
      ? raw.filter((p) => p && p.enabled !== false).reduce((a, p) => a + phaseDurationHours(p), 0)
      : 0);
  if (totalHours > 0) return totalHours * 3600 * 1000;
  const s = schedule.startedAt ? new Date(schedule.startedAt).getTime() : NaN;
  const est = schedule.estimatedEndAt ? new Date(schedule.estimatedEndAt).getTime() : NaN;
  const paused = Number(schedule.totalPausedMs) || 0;
  if (Number.isFinite(s) && Number.isFinite(est) && est > s) return Math.max(0, est - s - paused);
  return 0;
}

export function getTotalPausedMs(
  payload: PayloadLike | null | undefined,
  nowMs = Date.now(),
  status = 'active'
): number {
  if (!payload) return 0;
  let total = Number(payload.scheduleSummary?.totalPausedMs) || 0;
  if (String(status).toLowerCase() === 'paused') {
    const pausedAt = payload.pauseState?.pausedAt;
    if (pausedAt) {
      const p0 = new Date(pausedAt).getTime();
      if (Number.isFinite(p0)) total += Math.max(0, nowMs - p0);
    }
  }
  return total;
}

export function getActiveElapsedMs(
  payload: PayloadLike | null | undefined,
  status = 'active',
  nowMs = Date.now()
): number {
  if (!payload?.scheduleSummary?.startedAt) return 0;
  const startMs = new Date(payload.scheduleSummary.startedAt).getTime();
  if (!Number.isFinite(startMs)) return 0;
  const schedule = payload.scheduleSummary || {};
  const reactivatedAt = schedule.reactivatedAt ? new Date(schedule.reactivatedAt).getTime() : NaN;
  const elapsedAnchor = Number(schedule.elapsedMsAnchor);
  const segmentMs = Number(schedule.currentExtensionMs);

  if (Number.isFinite(reactivatedAt) && Number.isFinite(elapsedAnchor) && elapsedAnchor >= 0) {
    const pausedSince = getTotalPausedMs(payload, nowMs, status);
    if (String(status).toLowerCase() === 'paused') {
      const pausedAt = payload.pauseState?.pausedAt;
      if (pausedAt) {
        const p0 = new Date(pausedAt).getTime();
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

  const closedPaused = Number(schedule.totalPausedMs) || 0;

  if (String(status).toLowerCase() === 'paused') {
    const pausedAt = payload.pauseState?.pausedAt;
    if (pausedAt) {
      const p0 = new Date(pausedAt).getTime();
      if (Number.isFinite(p0)) return Math.max(0, p0 - startMs - closedPaused);
    }
    const pPct = Number(payload.pauseState?.progressAtPause);
    const planned = getPlannedDurationMs(payload);
    if (Number.isFinite(pPct) && planned > 0) return (pPct / 100) * planned;
    return 0;
  }

  return Math.max(0, nowMs - startMs - getTotalPausedMs(payload, nowMs, status));
}

export function progressFromTrackingPayload(
  payload: PayloadLike | null | undefined,
  status = 'active',
  nowMs = Date.now()
): number {
  const planned = getPlannedDurationMs(payload);
  if (planned <= 0) return 0;
  if (String(status).toLowerCase() === 'paused') {
    const pPct = Number(payload?.pauseState?.progressAtPause);
    if (Number.isFinite(pPct)) return Math.min(100, Math.max(0, Math.round(pPct)));
  }
  const elapsed = getActiveElapsedMs(payload, status, nowMs);
  return Math.min(100, Math.max(0, Math.round((elapsed / planned) * 100)));
}
