import type { Device } from '@/app/data';
import type { HistoryPoint } from '@/app/lib/api';
import { getStoredUser } from '@/app/lib/auth';
import { GOURMET_TUNEL_DEVICE_ID } from '@/app/lib/tunelUnido';
import gourmetJson from '../../../data_gourmet.json';

type RawRow = Record<string, unknown> & {
  fecha?: { $date?: string } | string;
};

const gourmetRaw = gourmetJson as RawRow[];

export const GOURMET_USER_EMAIL = 'gourmettrading@ztrack.app';

/** IMEI por defecto empresa 5001 (Gourmet Trading). */
export const GOURMET_TRADING_DEFAULT_IMEIS = ['867856038562796', '866262036100104'] as const;

export function gourmetTradingLoginEmail(): string {
  const raw =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as unknown as { env?: { VITE_GOURMET_TRADING_EMAIL?: string } }).env?.VITE_GOURMET_TRADING_EMAIL)) ||
    GOURMET_USER_EMAIL;
  return String(raw).trim().toLowerCase() || GOURMET_USER_EMAIL.toLowerCase();
}

export function getGourmetTradingPinnedImeis(): string[] {
  const raw =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as unknown as { env?: { VITE_GOURMET_TRADING_DEVICE_IMEIS?: string } }).env
        ?.VITE_GOURMET_TRADING_DEVICE_IMEIS)) ||
    GOURMET_TRADING_DEFAULT_IMEIS.join(',');
  const list = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : [...GOURMET_TRADING_DEFAULT_IMEIS];
}

/** IMEIs pin + túnel agregado (seguimientos, flota, nombres). */
export function getGourmetTradingFleetDeviceIds(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...getGourmetTradingPinnedImeis(), GOURMET_TUNEL_DEVICE_ID]) {
    const k = String(id).trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export function isGourmetSession(): boolean {
  try {
    const u = getStoredUser();
    return (u?.email ?? '').toLowerCase() === gourmetTradingLoginEmail();
  } catch {
    return false;
  }
}

/** Perfil con identificador Madurador: datos reales upstream; flota empaquetada en api (standalone + túnel). */
export function isGourmetMaduradorFleetSession(): boolean {
  if (!isGourmetSession()) return false;
  return Boolean(getStoredUser()?.identificador?.trim());
}

/** Dispositivo IMEI Gourmet o túnel agregado: control manual vía API Tunel. */
export function isGourmetTunnelCommandDevice(deviceId?: string | null): boolean {
  if (!deviceId || !isGourmetSession()) return false;
  const id = String(deviceId).trim();
  if (id === GOURMET_TUNEL_DEVICE_ID) return true;
  return getGourmetTradingPinnedImeis().includes(id);
}

/** Ocultar «Estados de comandos» mientras hay proceso de panel activo (no Manual). */
export function showGourmetTunnelCommandStatesPanel(
  deviceId: string | undefined,
  activeProcessType: string | null | undefined,
  sessionStatus: string | null | undefined
): boolean {
  if (!deviceId || !isGourmetTunnelCommandDevice(deviceId)) return false;
  if (sessionStatus === 'active' && activeProcessType && activeProcessType !== 'Manual') {
    return false;
  }
  return true;
}

export const GOURMET_DEVICE_ID = 'CC:DB:A7:9D:F3:E8';
export const GOURMET_DEVICE_NAME = 'Madurador Gourment';

/** Fin de ventana (últimas 12 h de datos registrados) y última telemetría. */
export const GOURMET_LAST_TS_ISO = '2026-04-07T14:47:24.120Z';
const ETHYLENE_LAST_PPM = 85.6;
const WINDOW_MS = 12 * 60 * 60 * 1000;

/** Invalidar caché al cambiar ventana/lógica. */
const HISTORY_BUILD_VERSION = 2;
let gourmetHistoryCache: HistoryPoint[] | null = null;
let historyCacheVersion = 0;

function parseFecha(row: RawRow): number | null {
  const f = row.fecha;
  if (!f) return null;
  if (typeof f === 'string') return new Date(f).getTime();
  if (typeof f === 'object' && f !== null && '$date' in f) {
    const d = (f as { $date?: string }).$date;
    if (d) return new Date(d).getTime();
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function inRange(v: number | null, min: number, max: number): number | null {
  if (v == null) return null;
  if (v < min || v > max) return null;
  return v;
}

/** Fila normalizada para gráfica/tabla: fuera de rango → null */
export function sanitizeGourmetRow(row: RawRow): {
  temp_supply_1: number | null;
  return_air: number | null;
  ambient_air: number | null;
  relative_humidity: number | null;
  co2_reading: number | null;
  set_point: number | null;
  humidity_set_point: number | null;
  set_point_co2: number | null;
} {
  return {
    temp_supply_1: inRange(toNum(row.temp_supply_1), -40, 120),
    return_air: inRange(toNum(row.return_air), -40, 120),
    ambient_air: inRange(toNum(row.ambient_air), -40, 100),
    relative_humidity: inRange(toNum(row.relative_humidity), 0, 100),
    co2_reading: inRange(toNum(row.co2_reading), 0, 100),
    set_point: inRange(toNum(row.set_point), -40, 40),
    humidity_set_point: inRange(toNum(row.humidity_set_point), 0, 100),
    set_point_co2: inRange(toNum(row.set_point_co2), 0, 100),
  };
}

interface ParsedPoint {
  ts: number;
  s: ReturnType<typeof sanitizeGourmetRow>;
}

function parseAllRows(): ParsedPoint[] {
  const arr = gourmetRaw as RawRow[];
  const out: ParsedPoint[] = [];
  for (const row of arr) {
    const ts = parseFecha(row);
    if (ts == null) continue;
    out.push({ ts, s: sanitizeGourmetRow(row) });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpNull(a: number | null, b: number | null, t: number): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return lerp(a, b, t);
}

const SYNTH_START = {
  temp_supply_1: 18.2,
  return_air: 18.8,
  ambient_air: 26.0,
  relative_humidity: 72,
  co2_reading: 0.85,
  set_point: 22,
  humidity_set_point: 95,
  set_point_co2: 2.0,
};

/** Interpola telemetría en [tStart,tEnd]: datos reales filtrados + puente desde arranque simulado hasta el primer punto. */
export function buildGourmetHistoryPoints(): HistoryPoint[] {
  if (gourmetHistoryCache && historyCacheVersion === HISTORY_BUILD_VERSION) return gourmetHistoryCache;
  const tEnd = new Date(GOURMET_LAST_TS_ISO).getTime();
  const tStart = tEnd - WINDOW_MS;
  const parsed = parseAllRows().filter((p) => p.ts >= tStart && p.ts <= tEnd);
  if (parsed.length === 0) return [];

  const interpS = (a: ParsedPoint['s'], b: ParsedPoint['s'], u: number) => ({
    temp_supply_1: lerpNull(a.temp_supply_1, b.temp_supply_1, u),
    return_air: lerpNull(a.return_air, b.return_air, u),
    ambient_air: lerpNull(a.ambient_air, b.ambient_air, u),
    relative_humidity: lerpNull(a.relative_humidity, b.relative_humidity, u),
    co2_reading: lerpNull(a.co2_reading, b.co2_reading, u),
    set_point: lerpNull(a.set_point, b.set_point, u),
    humidity_set_point: lerpNull(a.humidity_set_point, b.humidity_set_point, u),
    set_point_co2: lerpNull(a.set_point_co2, b.set_point_co2, u),
  });

  function sampleAt(t: number): ParsedPoint['s'] {
    const first = parsed[0];
    const last = parsed[parsed.length - 1];
    if (t < first.ts) {
      const span = Math.max(1, first.ts - tStart);
      const u = (t - tStart) / span;
      return interpS(SYNTH_START, first.s, u);
    }
    if (t >= last.ts) return last.s;
    let i = 0;
    while (i < parsed.length - 1 && parsed[i + 1].ts < t) i++;
    const A = parsed[i];
    const B = parsed[i + 1];
    if (A.ts === B.ts) return A.s;
    const u = (t - A.ts) / (B.ts - A.ts);
    return interpS(A.s, B.s, u);
  }

  const gridStep = 5 * 60 * 1000;
  const points: HistoryPoint[] = [];
  let kwh = 31250;

  for (let t = tStart; t <= tEnd; t += gridStep) {
    const progress = (t - tStart) / (tEnd - tStart);
    const s = sampleAt(t);
    const ethylene = 72 + (ETHYLENE_LAST_PPM - 72) * progress + Math.sin(progress * 12) * 0.15;
    kwh += 0.12 + Math.sin(progress * Math.PI) * 0.02;

    const t1 = s.temp_supply_1 ?? 20;
    points.push({
      timestamp: new Date(t).toISOString(),
      temp_supply_1: s.temp_supply_1 ?? 0,
      return_air: s.return_air ?? 0,
      evaporation_coil: t1 - 1.5,
      condensation_coil: 34 + progress * 4,
      compress_coil_1: 52 + progress * 6,
      ambient_air: s.ambient_air ?? 26,
      cargo_1_temp: null,
      cargo_2_temp: null,
      cargo_3_temp: null,
      cargo_4_temp: null,
      relative_humidity: s.relative_humidity ?? 0,
      avl_pct: Math.min(100, Math.round(60 + progress * 35)),
      line_voltage: 440,
      line_frequency: 60,
      co2_reading: s.co2_reading,
      o2_reading: 20.9,
      set_point: s.set_point ?? 22,
      capacity_load: Math.round(40 + progress * 20),
      power_state: 1,
      humidity_set_point: s.humidity_set_point ?? 95,
      set_point_o2: null,
      set_point_co2: s.set_point_co2,
      sp_ethyleno: 100,
      ethylene,
      iCtrlRip: progress > 0.35 && progress < 0.85 ? 1 : 0,
      power_kwh: kwh,
    });
  }

  const last = points[points.length - 1];
  if (last) {
    last.ethylene = ETHYLENE_LAST_PPM;
    last.timestamp = GOURMET_LAST_TS_ISO;
  }
  gourmetHistoryCache = points;
  historyCacheVersion = HISTORY_BUILD_VERSION;
  return points;
}

export function buildGourmetDevice(): Device {
  const hist = buildGourmetHistoryPoints();
  const last = hist[hist.length - 1];
  if (!last) {
    return {
      id: GOURMET_DEVICE_ID,
      nombreApi: GOURMET_DEVICE_NAME,
      name: GOURMET_DEVICE_NAME,
      status: 'offline',
      estado_conexion: 'offline',
      last_seen: GOURMET_LAST_TS_ISO,
      telemetry: {
        temp_supply_1: 0,
        return_air: 0,
        relative_humidity: 0,
        ethylene: ETHYLENE_LAST_PPM,
        co2_reading: null,
        set_point: 22,
        stateProcess: 'None',
        power_state: 1,
        alarm_present: 0,
      },
      operational: {
        evaporation_coil: 0,
        condensation_coil: 36,
        ambient_air: 26,
        power_consumption: 0.45,
        power_kwh: 31280,
        battery_voltage: 41,
        defrost_interval: 6,
        fresh_air_ex_mode: 0,
      },
      process: undefined,
    };
  }

  return {
    id: GOURMET_DEVICE_ID,
    nombreApi: GOURMET_DEVICE_NAME,
    name: GOURMET_DEVICE_NAME,
    status: 'offline',
    estado_conexion: 'offline',
    last_seen: GOURMET_LAST_TS_ISO,
    telemetry: {
      temp_supply_1: last.temp_supply_1,
      return_air: last.return_air,
      relative_humidity: last.relative_humidity,
      ethylene: ETHYLENE_LAST_PPM,
      co2_reading: last.co2_reading,
      set_point: last.set_point,
      stateProcess: 'None',
      power_state: 1,
      alarm_present: 0,
    },
    operational: {
      evaporation_coil: last.temp_supply_1 - 2,
      condensation_coil: 36,
      ambient_air: last.ambient_air,
      power_consumption: 0.45,
      power_kwh: last.power_kwh ?? 31280,
      battery_voltage: 41,
      defrost_interval: 6,
      fresh_air_ex_mode: 0,
    },
    process: undefined,
  };
}
