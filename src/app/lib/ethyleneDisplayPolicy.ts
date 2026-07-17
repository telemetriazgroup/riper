import type { Device } from '@/app/data';
import type { HistoryPoint } from '@/app/lib/api';
import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { getStoredUser } from '@/app/lib/auth';
import {
  buildEthyleneProcessWindows,
  resolveClientEthyleneDisplayAtMs,
  resolveEthyleneTargetAtMs,
  resolveIdleEthyleneDisplayPpmForClient,
} from '@/app/lib/ethyleneHistoryPolicy';
import { sanitizeIdleEthyleneAnomalies } from '@/app/lib/ethyleneIdleAnomalySanitize';
import {
  applyGourmetFleetEthyleneZeroGuard,
  formatGourmetFleetEthyleneLabel,
  getCachedGourmetProgrammedEthylene,
  modulateGourmetEthyleneDisplayPpm,
  resolveGourmetProgrammedEthyleneFromSessions,
} from '@/app/lib/gourmetEthyleneDisplay';
import { formatUiDecimal } from '@/app/lib/formatUiNumber';
import { showsUnfilteredTelemetry, type TelemetryViewOptions } from '@/app/lib/telemetryViewPolicy';

export const UNFILTERED_ETHYLENE_VIEWER_EMAIL = 'superadmin@riper.local';

/** Sin proceso activo en flota instantánea: real hasta 150 ppm; >150 → 150.1. */
export const ETHYLENE_IDLE_DISPLAY_MAX_REAL_PPM = 150;
export const ETHYLENE_IDLE_DISPLAY_CAP_PPM = 150.1;

/** @deprecated usar resolveIdleEthyleneDisplayPpmForClient */
export const ETHYLENE_IDLE_DISPLAY_MAX_PPM = 40;

/** Solo esta cuenta ve etileno crudo en flota y gráficas. */
export function isUnfilteredEthyleneViewer(): boolean {
  const email = (getStoredUser()?.email ?? '').trim().toLowerCase();
  return email === UNFILTERED_ETHYLENE_VIEWER_EMAIL;
}

function ethyleneFromSessionParams(params: unknown): number | null {
  if (!params || typeof params !== 'object') return null;
  const p = params as Record<string, unknown>;
  const v = p.ethylene_injection_programmed ?? p.ethylene ?? p.ethylene_injection;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function trackingRecipeHasRipeningPhase(
  payload: RipeningProcessRow['payload'] | undefined | null
): boolean {
  const raw = (payload?.recipe as { phases?: { enabled?: boolean; type?: string }[] } | undefined)?.phases;
  if (!Array.isArray(raw)) return false;
  return raw.some(
    (p) => p && p.enabled !== false && String(p.type ?? '').trim().toLowerCase() === 'ripening'
  );
}

export function ethylenePpmFromRipeningRecipe(
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

function panelSessionQualifiesForEthylene(session: DeviceControlSessionRow | null | undefined): boolean {
  if (!session || session.status !== 'active') return false;
  const pt = String(session.process_type || '').trim();
  if (pt === 'Ripening') return true;
  if (pt === 'Manual') return ethyleneFromSessionParams(session.params) != null;
  return false;
}

/** Proceso/seguimiento activo con maduración o panel Ripening/Manual con inyección. */
export function hasActiveEthyleneProcessContext(opts: {
  trackingProcess?: RipeningProcessRow | null;
  panelActiveSession?: DeviceControlSessionRow | null;
}): boolean {
  if (panelSessionQualifiesForEthylene(opts.panelActiveSession)) return true;
  const tracking = opts.trackingProcess;
  return Boolean(tracking?.status === 'active' && trackingRecipeHasRipeningPhase(tracking.payload));
}

/** @deprecated use hasActiveEthyleneProcessContext */
export function shouldShowEthyleneToUser(opts: {
  trackingProcess?: RipeningProcessRow | null;
  panelActiveSession?: DeviceControlSessionRow | null;
}): boolean {
  if (isUnfilteredEthyleneViewer()) return true;
  return hasActiveEthyleneProcessContext(opts);
}

function resolveIdleEthyleneDisplayPpm(raw: number | null | undefined): number | null {
  return resolveIdleEthyleneDisplayPpmForClient(raw);
}

export function resolveEthyleneDisplayTargetPpm(opts: {
  deviceId: string;
  trackingProcess?: RipeningProcessRow | null;
  panelActiveSession?: DeviceControlSessionRow | null;
  sessions?: DeviceControlSessionRow[] | null;
  device?: Device | null;
}): number | null {
  const fromRecipe = ethylenePpmFromRipeningRecipe(opts.trackingProcess?.payload);
  if (fromRecipe != null) return fromRecipe;

  const spEarly = opts.device?.madurador?.sp_ethyleno ?? opts.device?.telemetry?.sp_ethyleno;
  if (
    fromRecipe == null &&
    opts.trackingProcess?.status === 'active' &&
    trackingRecipeHasRipeningPhase(opts.trackingProcess.payload) &&
    spEarly != null &&
    Number.isFinite(Number(spEarly)) &&
    Number(spEarly) > 0
  ) {
    return Number(spEarly);
  }

  if (opts.panelActiveSession?.status === 'active') {
    const fromPanel = ethyleneFromSessionParams(opts.panelActiveSession.params);
    if (fromPanel != null) return fromPanel;
    if (String(opts.panelActiveSession.process_type || '').trim() === 'Ripening') {
      const sp = opts.device?.madurador?.sp_ethyleno ?? opts.device?.telemetry?.sp_ethyleno;
      if (sp != null && Number.isFinite(Number(sp))) return Number(sp);
    }
  }

  const fromSessions = opts.sessions
    ? resolveGourmetProgrammedEthyleneFromSessions(opts.deviceId, opts.sessions)
    : null;
  if (fromSessions != null) return fromSessions;

  const cached = getCachedGourmetProgrammedEthylene(opts.deviceId);
  if (cached != null) return cached;

  const programmed = opts.device?.telemetry?.ethylene_programmed;
  if (programmed != null && Number.isFinite(Number(programmed)) && Number(programmed) > 0) {
    return Number(programmed);
  }

  const sp = opts.device?.madurador?.sp_ethyleno ?? opts.device?.telemetry?.sp_ethyleno;
  if (sp != null && Number.isFinite(Number(sp)) && Number(sp) > 0) return Number(sp);

  return null;
}

export function resolveFleetEthyleneDisplayPpm(
  device: Device,
  opts?: {
    trackingProcess?: RipeningProcessRow | null;
    panelActiveSession?: DeviceControlSessionRow | null;
    sessions?: DeviceControlSessionRow[] | null;
    view?: TelemetryViewOptions;
  }
): number | null {
  const raw =
    device.telemetry.ethylene_raw != null
      ? device.telemetry.ethylene_raw
      : device.telemetry.ethylene;

  if (showsUnfilteredTelemetry(opts?.view)) {
    if (raw == null || !Number.isFinite(Number(raw))) return null;
    return Number(raw);
  }

  if (!hasActiveEthyleneProcessContext(opts ?? {})) {
    return resolveIdleEthyleneDisplayPpm(raw);
  }

  const target = resolveEthyleneDisplayTargetPpm({
    deviceId: device.id,
    trackingProcess: opts?.trackingProcess,
    panelActiveSession: opts?.panelActiveSession,
    sessions: opts?.sessions,
    device,
  });

  const modulated = modulateGourmetEthyleneDisplayPpm(raw, target);
  return applyGourmetFleetEthyleneZeroGuard(device.id, raw, modulated);
}

export function formatFleetEthyleneLabel(
  device: Device,
  opts?: {
    trackingProcess?: RipeningProcessRow | null;
    panelActiveSession?: DeviceControlSessionRow | null;
    sessions?: DeviceControlSessionRow[] | null;
    view?: TelemetryViewOptions;
  }
): string {
  const ppm = resolveFleetEthyleneDisplayPpm(device, opts);
  if (showsUnfilteredTelemetry(opts?.view)) {
    if (ppm == null || !Number.isFinite(ppm)) return '—';
    if (ppm === 0) return 'NA';
    return `${formatUiDecimal(ppm)} PPM`;
  }
  const label = formatGourmetFleetEthyleneLabel(ppm);
  return label === '—' ? '—' : `${label} PPM`;
}

export type EthyleneDisplayPolicyContext = {
  deviceId: string;
  trackingProcess?: RipeningProcessRow | null;
  /** Historial de seguimientos del equipo (gráficas / histórico). */
  trackingProcesses?: RipeningProcessRow[] | null;
  panelActiveSession?: DeviceControlSessionRow | null;
  sessions?: DeviceControlSessionRow[] | null;
  device?: Device | null;
  view?: TelemetryViewOptions;
};

/** Bitácora / panel: ocultar lecturas crudas de etileno al cliente. */
export function shouldShowClientSafeProcessEvents(): boolean {
  return !isUnfilteredEthyleneViewer();
}

/** Suaviza ceros breves en series históricas (lecturas filtradas estables en gráfica). */
function smoothFilteredEthyleneHistory(values: (number | null | undefined)[]): (number | null)[] {
  const out: (number | null)[] = [];
  let lastGood: number | null = null;
  let zeroStreak = 0;

  for (const raw of values) {
    const v = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
    if (v != null && v > 0) {
      zeroStreak = 0;
      lastGood = v;
      out.push(v);
      continue;
    }
    if (v === 0) {
      zeroStreak += 1;
      out.push(zeroStreak >= 2 ? null : lastGood);
      continue;
    }
    out.push(v);
  }
  return out;
}

export function applyEthyleneDisplayPolicyToDevice(
  device: Device,
  opts?: {
    trackingProcess?: RipeningProcessRow | null;
    panelActiveSession?: DeviceControlSessionRow | null;
    sessions?: DeviceControlSessionRow[] | null;
    view?: TelemetryViewOptions;
  }
): Device {
  const raw =
    device.telemetry.ethylene_raw != null
      ? device.telemetry.ethylene_raw
      : device.telemetry.ethylene;
  const display = resolveFleetEthyleneDisplayPpm(device, opts);
  const target = resolveEthyleneDisplayTargetPpm({
    deviceId: device.id,
    trackingProcess: opts?.trackingProcess,
    panelActiveSession: opts?.panelActiveSession,
    sessions: opts?.sessions,
    device,
  });

  return {
    ...device,
    telemetry: {
      ...device.telemetry,
      ethylene: display,
      ethylene_raw: raw,
      ethylene_programmed: target,
    },
  };
}

export function applyEthyleneDisplayPolicyToHistory(
  points: HistoryPoint[],
  opts: EthyleneDisplayPolicyContext
): HistoryPoint[] {
  if (!points.length) return points;
  if (showsUnfilteredTelemetry(opts.view)) return points;

  const windows = buildEthyleneProcessWindows({
    deviceId: opts.deviceId,
    trackingProcesses:
      opts.trackingProcesses ??
      (opts.trackingProcess ? [opts.trackingProcess] : []),
    controlSessions: opts.sessions,
    device: opts.device,
  });

  const idleEligible: boolean[] = [];
  const timestampsMs: number[] = [];
  const modulated = points.map((p) => {
    const tsMs = new Date(p.timestamp).getTime();
    timestampsMs.push(Number.isFinite(tsMs) ? tsMs : NaN);
    if (!Number.isFinite(tsMs)) {
      idleEligible.push(true);
      return resolveIdleEthyleneDisplayPpmForClient(p.ethylene);
    }
    const hasProcess = resolveEthyleneTargetAtMs(tsMs, windows) != null;
    idleEligible.push(!hasProcess);
    return resolveClientEthyleneDisplayAtMs(p.ethylene, tsMs, windows);
  });

  const withoutIdleSpikes = sanitizeIdleEthyleneAnomalies(modulated, {
    eligible: idleEligible,
    timestampsMs,
  });
  const smoothed = smoothFilteredEthyleneHistory(withoutIdleSpikes);

  return points.map((p, i) => ({
    ...p,
    ethylene: smoothed[i],
  }));
}
