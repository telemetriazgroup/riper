import type { Device } from '@/app/data';
import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import type { HistoryPoint } from '@/app/lib/api';
import { getStoredUser } from '@/app/lib/auth';
import { formatUiDecimal } from '@/app/lib/formatUiNumber';
import { GOURMET_TUNEL_DEVICE_ID } from '@/app/lib/tunelUnido';
import {
  GOURMET_STANDALONE_IMEI,
  GOURMET_TUNNEL_ETHYLENE_IMEI,
} from '@/app/lib/gourmetTunnelFleet';

const UNFILTERED_ETHYLENE_VIEWER_EMAIL = 'superadmin@riper.local';

function isUnfilteredEthyleneViewerLocal(): boolean {
  const email = (getStoredUser()?.email ?? '').trim().toLowerCase();
  return email === UNFILTERED_ETHYLENE_VIEWER_EMAIL;
}

/** Máximo +21 % sobre la inyección programada (ej. 50 → 60.5 ppm). */
export const GOURMET_ETHYLENE_DISPLAY_CAP_RATIO = 0.21;

const LS_PREFIX = 'gourmet_eth_prog:';
const LS_ZERO_STREAK = 'gourmet_eth_zero_streak:';
const LS_LAST_GOOD = 'gourmet_eth_last_good:';

/** Tras N lecturas crudas consecutivas en 0, ocultar valor (—) hasta lectura > 0. */
export const GOURMET_ETHYLENE_ZERO_STREAK_HIDE = 2;

export function gourmetEthyleneDisplayCapPpm(programmedTarget: number): number {
  const t = Number(programmedTarget);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Number((t * (1 + GOURMET_ETHYLENE_DISPLAY_CAP_RATIO)).toFixed(2));
}

/**
 * Etileno mostrado al cliente Gourmet: escala el exceso sobre el objetivo al 21 %
 * y limita al tope (objetivo × 1.21). Si lectura ≤ objetivo, muestra la lectura real.
 */
export function modulateGourmetEthyleneDisplayPpm(
  rawPpm: number | null | undefined,
  programmedTarget: number | null | undefined
): number | null {
  if (rawPpm == null || !Number.isFinite(rawPpm)) return null;
  const raw = Number(rawPpm);
  const target = programmedTarget != null && Number.isFinite(programmedTarget) ? Number(programmedTarget) : null;
  if (target == null || target <= 0) return raw;
  if (raw <= target) return Number(raw.toFixed(2));
  const cap = gourmetEthyleneDisplayCapPpm(target);
  const scaled = target + (raw - target) * GOURMET_ETHYLENE_DISPLAY_CAP_RATIO;
  return Number(Math.min(scaled, cap).toFixed(2));
}

function readLsInt(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeLsInt(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
  } catch {
    /* ignore */
  }
}

function readLastGoodDisplay(deviceId: string): number | null {
  try {
    const raw = localStorage.getItem(`${LS_LAST_GOOD}${String(deviceId).trim()}`);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLastGoodDisplay(deviceId: string, ppm: number): void {
  try {
    const id = String(deviceId).trim();
    if (!id || !Number.isFinite(ppm) || ppm <= 0) return;
    localStorage.setItem(`${LS_LAST_GOOD}${id}`, String(ppm));
  } catch {
    /* ignore */
  }
}

/**
 * Estado de flota Gourmet: nunca mostrar 0 ppm.
 * Caída brusca a 0 (falso positivo): 1.er cero mantiene último valor válido;
 * 2+ ceros consecutivos → ocultar (—) hasta lectura cruda > 0.
 */
export function applyGourmetFleetEthyleneZeroGuard(
  deviceId: string,
  rawPpm: number | null | undefined,
  modulatedPpm: number | null | undefined
): number | null {
  const id = String(deviceId).trim();
  const raw =
    rawPpm != null && Number.isFinite(Number(rawPpm)) ? Number(rawPpm) : null;
  const mod =
    modulatedPpm != null && Number.isFinite(Number(modulatedPpm)) ? Number(modulatedPpm) : null;

  if (raw != null && raw > 0) {
    writeLsInt(`${LS_ZERO_STREAK}${id}`, 0);
    const display = mod != null && mod > 0 ? mod : raw;
    writeLastGoodDisplay(id, display);
    return display;
  }

  if (raw === 0) {
    const streak = readLsInt(`${LS_ZERO_STREAK}${id}`) + 1;
    writeLsInt(`${LS_ZERO_STREAK}${id}`, streak);
    const lastGood = readLastGoodDisplay(id);

    if (streak >= GOURMET_ETHYLENE_ZERO_STREAK_HIDE) {
      return null;
    }
    if (lastGood != null && lastGood > 0) {
      return lastGood;
    }
    return null;
  }

  if (mod != null && mod > 0) {
    writeLastGoodDisplay(id, mod);
    return mod;
  }
  return readLastGoodDisplay(id);
}

/** Etiqueta etileno en tarjeta de flota (Gourmet). */
export function formatGourmetFleetEthyleneLabel(ppm: number | null | undefined): string {
  if (ppm == null || !Number.isFinite(ppm) || ppm <= 0) return '—';
  return formatUiDecimal(ppm);
}

export function cacheGourmetProgrammedEthylene(deviceId: string, ppm: number): void {
  try {
    const id = String(deviceId).trim();
    if (!id || !Number.isFinite(ppm)) return;
    localStorage.setItem(`${LS_PREFIX}${id}`, String(Math.round(ppm)));
  } catch {
    /* ignore */
  }
}

export function getCachedGourmetProgrammedEthylene(deviceId: string): number | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${String(deviceId).trim()}`);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function ethyleneFromSessionParams(params: unknown): number | null {
  if (!params || typeof params !== 'object') return null;
  const p = params as Record<string, unknown>;
  const v = p.ethylene_injection_programmed ?? p.ethylene ?? p.ethylene_injection;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Última inyección programada desde historial Manual de control de dispositivos. */
export function resolveGourmetProgrammedEthyleneFromSessions(
  deviceId: string,
  sessions: DeviceControlSessionRow[] | null | undefined
): number | null {
  const id = String(deviceId).trim();
  if (!id || !sessions?.length) return null;
  const manual = sessions.filter(
    (s) =>
      s.device_id === id &&
      s.process_type === 'Manual' &&
      ethyleneFromSessionParams(s.params) != null
  );
  if (manual.length === 0) return null;
  manual.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return ethyleneFromSessionParams(manual[0].params);
}

/** Objetivo de inyección para UI Gourmet (control manual / modulación). */
export function resolveGourmetProgrammedEthylenePpm(
  deviceId: string,
  sessions?: DeviceControlSessionRow[] | null
): number | null {
  const fromSessions = sessions ? resolveGourmetProgrammedEthyleneFromSessions(deviceId, sessions) : null;
  if (fromSessions != null) return fromSessions;
  return getCachedGourmetProgrammedEthylene(deviceId);
}

/** Dispositivos Gourmet con lectura de etileno modulada (no cuenta principal). */
export function isGourmetEthyleneDisplayDevice(deviceId: string): boolean {
  const id = String(deviceId).trim();
  return id === GOURMET_TUNEL_DEVICE_ID || id === GOURMET_STANDALONE_IMEI || id === GOURMET_TUNNEL_ETHYLENE_IMEI;
}

export function applyGourmetEthyleneDisplayToDevice(
  device: Device,
  programmedTarget: number | null | undefined
): Device {
  const raw = device.telemetry.ethylene_raw ?? device.telemetry.ethylene;

  if (isUnfilteredEthyleneViewerLocal()) {
    return {
      ...device,
      telemetry: {
        ...device.telemetry,
        ethylene: raw,
        ethylene_raw: raw,
        ethylene_programmed: programmedTarget ?? null,
      },
    };
  }

  const target =
    programmedTarget ??
    resolveGourmetProgrammedEthylenePpm(device.id) ??
    (device.madurador?.sp_ethyleno != null && Number.isFinite(device.madurador.sp_ethyleno)
      ? Number(device.madurador.sp_ethyleno)
      : null);

  if (target == null || target <= 0) {
    return {
      ...device,
      telemetry: {
        ...device.telemetry,
        ethylene: null,
        ethylene_raw: raw,
        ethylene_programmed: null,
      },
    };
  }

  const modulated = modulateGourmetEthyleneDisplayPpm(raw, target);
  const display = applyGourmetFleetEthyleneZeroGuard(device.id, raw, modulated);

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

export function applyGourmetEthyleneDisplayToHistory(
  points: HistoryPoint[],
  programmedTarget: number | null | undefined
): HistoryPoint[] {
  if (isUnfilteredEthyleneViewerLocal()) return points;
  if (programmedTarget == null || !Number.isFinite(programmedTarget)) {
    return points.map((p) => ({ ...p, ethylene: null }));
  }
  return points.map((p) => ({
    ...p,
    ethylene: modulateGourmetEthyleneDisplayPpm(p.ethylene, programmedTarget),
  }));
}

export function applyGourmetEthyleneDisplayToFleet(
  devices: Device[],
  sessions?: DeviceControlSessionRow[] | null
): Device[] {
  return devices.map((d) => {
    if (!isGourmetEthyleneDisplayDevice(d.id)) return d;
    const programmed = resolveGourmetProgrammedEthylenePpm(d.id, sessions);
    return applyGourmetEthyleneDisplayToDevice(d, programmed);
  });
}
