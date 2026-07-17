import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import { modulateGourmetEthyleneDisplayPpm } from '@/app/lib/gourmetEthyleneDisplay';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';

export type EthyleneProcessWindow = {
  startMs: number;
  endMs: number;
  targetPpm: number;
};

function trackingRecipeHasRipeningPhase(
  payload: RipeningProcessRow['payload'] | undefined | null
): boolean {
  const raw = (payload?.recipe as { phases?: { enabled?: boolean; type?: string }[] } | undefined)?.phases;
  if (!Array.isArray(raw)) return false;
  return raw.some(
    (p) => p && p.enabled !== false && String(p.type ?? '').trim().toLowerCase() === 'ripening'
  );
}

function ethylenePpmFromRipeningRecipe(
  payload: RipeningProcessRow['payload'] | undefined | null
): number | null {
  const raw = (payload?.recipe as { phases?: Record<string, unknown>[] } | undefined)?.phases;
  if (!Array.isArray(raw)) return null;
  const rip = raw.find(
    (p) => p && p.enabled !== false && String(p.type ?? '').trim().toLowerCase() === 'ripening'
  );
  if (!rip) return null;
  const v = rip.ethylene ?? rip.ethylene_ppm;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function trackingProcessEthyleneTargetPpm(
  row: RipeningProcessRow,
  device?: { madurador?: { sp_ethyleno?: number }; telemetry?: { sp_ethyleno?: number } } | null
): number | null {
  const fromRecipe = ethylenePpmFromRipeningRecipe(row.payload);
  if (fromRecipe != null && fromRecipe > 0) return fromRecipe;
  const payload = row.payload ?? {};
  const fromInitial = (payload.initialSample as { ethylene?: unknown } | undefined)?.ethylene;
  const nInitial =
    typeof fromInitial === 'number'
      ? fromInitial
      : typeof fromInitial === 'string'
        ? Number(fromInitial)
        : NaN;
  if (Number.isFinite(nInitial) && nInitial > 0) return nInitial;
  if (trackingRecipeHasRipeningPhase(row.payload)) {
    const sp = device?.madurador?.sp_ethyleno ?? device?.telemetry?.sp_ethyleno;
    if (sp != null && Number.isFinite(Number(sp)) && Number(sp) > 0) return Number(sp);
  }
  return null;
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function ethyleneFromSessionParams(params: unknown): number | null {
  if (!params || typeof params !== 'object') return null;
  const p = params as Record<string, unknown>;
  const v = p.ethylene_injection_programmed ?? p.ethylene ?? p.ethylene_injection;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function panelSessionTargetPpm(
  session: DeviceControlSessionRow,
  device?: { madurador?: { sp_ethyleno?: number }; telemetry?: { sp_ethyleno?: number } } | null
): number | null {
  const fromParams = ethyleneFromSessionParams(session.params);
  if (fromParams != null) return fromParams;
  if (String(session.process_type || '').trim() === 'Ripening') {
    const sp = device?.madurador?.sp_ethyleno ?? device?.telemetry?.sp_ethyleno;
    if (sp != null && Number.isFinite(Number(sp)) && Number(sp) > 0) return Number(sp);
  }
  return null;
}

function panelSessionQualifies(session: DeviceControlSessionRow): boolean {
  const pt = String(session.process_type || '').trim();
  if (pt === 'Ripening') return true;
  if (pt === 'Manual') return ethyleneFromSessionParams(session.params) != null;
  return false;
}

function controlSessionEndMs(session: DeviceControlSessionRow): number {
  const cancelled = parseMs(session.cancelled_at);
  if (cancelled != null) return cancelled;
  if (session.status === 'completed') {
    const est = parseMs(session.estimated_end_at);
    if (est != null) return est;
    const upd = parseMs(session.updated_at);
    if (upd != null) return upd;
  }
  if (session.status === 'cancelled' && cancelled == null) {
    const upd = parseMs(session.updated_at);
    if (upd != null) return upd;
  }
  return Date.now();
}

function trackingProcessEndMs(row: RipeningProcessRow): number {
  const payload = row.payload ?? {};
  const meta =
    parseMs((payload._cancelledMeta as { at?: string } | undefined)?.at) ??
    parseMs((payload._completedMeta as { at?: string } | undefined)?.at) ??
    parseMs((payload._closureSnapshot as { at?: string } | undefined)?.at);
  if (meta != null) return meta;
  if (row.status === 'completed' || row.status === 'cancelled') {
    const upd = parseMs(row.updated_at);
    if (upd != null) return upd;
  }
  return Date.now();
}

/** Ventanas temporales con set de etileno (seguimiento + panel Ripening/Manual). */
export function buildEthyleneProcessWindows(opts: {
  deviceId: string;
  trackingProcesses?: RipeningProcessRow[] | null;
  controlSessions?: DeviceControlSessionRow[] | null;
  device?: { madurador?: { sp_ethyleno?: number }; telemetry?: { sp_ethyleno?: number } } | null;
}): EthyleneProcessWindow[] {
  const id = String(opts.deviceId || '').trim();
  if (!id) return [];
  const windows: EthyleneProcessWindow[] = [];

  for (const row of opts.trackingProcesses ?? []) {
    const payloadDevice = String((row.payload as { deviceId?: string })?.deviceId ?? '').trim();
    if (payloadDevice !== id) continue;
    if (!trackingRecipeHasRipeningPhase(row.payload)) continue;
    const target = trackingProcessEthyleneTargetPpm(row, opts.device);
    if (target == null || target <= 0) continue;
    const startMs =
      parseMs((row.payload?.scheduleSummary as { startedAt?: string } | undefined)?.startedAt) ??
      parseMs(row.created_at);
    if (startMs == null) continue;
    const endMs = trackingProcessEndMs(row);
    if (endMs <= startMs) continue;
    windows.push({ startMs, endMs, targetPpm: target });
  }

  for (const session of opts.controlSessions ?? []) {
    if (String(session.device_id).trim() !== id) continue;
    if (!panelSessionQualifies(session)) continue;
    const target = panelSessionTargetPpm(session, opts.device);
    if (target == null || target <= 0) continue;
    const startMs = parseMs(session.started_at);
    if (startMs == null) continue;
    const endMs = controlSessionEndMs(session);
    if (endMs <= startMs) continue;
    windows.push({ startMs, endMs, targetPpm: target });
  }

  return windows.sort((a, b) => a.startMs - b.startMs);
}

/** Set de etileno vigente en un instante (proceso más reciente que cubra el timestamp). */
export function resolveEthyleneTargetAtMs(
  tsMs: number,
  windows: EthyleneProcessWindow[]
): number | null {
  let best: EthyleneProcessWindow | null = null;
  for (const w of windows) {
    if (tsMs < w.startMs || tsMs > w.endMs) continue;
    if (!best || w.startMs > best.startMs) best = w;
  }
  return best?.targetPpm ?? null;
}

/** Sin proceso activo en ese instante: real hasta 150 ppm; por encima → 150.1. */
export function resolveIdleEthyleneDisplayPpmForClient(
  raw: number | null | undefined
): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  if (n <= 0) return null;
  if (n <= 150) return Number(n.toFixed(2));
  return 150.1;
}

/** Etileno filtrado para un punto histórico (cliente). */
export function resolveClientEthyleneDisplayAtMs(
  raw: number | null | undefined,
  tsMs: number,
  windows: EthyleneProcessWindow[]
): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const target = resolveEthyleneTargetAtMs(tsMs, windows);
  if (target != null && target > 0) {
    return modulateGourmetEthyleneDisplayPpm(Number(raw), target);
  }
  return resolveIdleEthyleneDisplayPpmForClient(raw);
}
