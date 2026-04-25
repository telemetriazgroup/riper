import type { Device, TunnelTelemetryGroup, TunnelUnitTelemetry } from '@/app/data';
import { RIPENER_API_URL, VITE_TUNEL_GRUPO_URL_RAW } from '@/app/config';
import { authHeaders } from '@/app/lib/auth';

export const GOURMET_TUNEL_DEVICE_ID = 'tunel:TUNEL_GREAT';

/** Orden fijo de máquinas del túnel. */
export const TUNEL_UNIT_ORDER = ['UNIT111', 'UNIT222', 'UNIT333', 'UNIT444', 'UNIT555'] as const;

type ConjuntoRow = {
  unidad?: string;
  pregunta?: string | null;
  datos?: Record<string, string | number | null>;
};

type DispositivoBloque = Record<string, unknown> & {
  fecha?: string;
  imei?: string;
  conjunto?: ConjuntoRow[];
  set_point?: number | null;
  co2_reading?: number | null;
  relative_humidity?: number | null;
  return_air?: number | null;
  temp_supply_1?: number | null;
  evaporation_coil?: number | null;
  condensation_coil?: number | null;
  ambient_air?: number | null;
  power_consumption?: number | null;
  power_kwh?: number | null;
  battery_voltage?: number | null;
  defrost_interval?: number | null;
  fresh_air_ex_mode?: number | null;
  campo_1?: number | null;
  alarm_present?: number | null;
};

type TunelGrupoJson = {
  nombre?: string;
  fecha?: string;
  imei?: string | string[];
  dispositivos?: DispositivoBloque[];
};

let gourmetTunnelDeviceCache: Device | null = null;

export function getCachedGourmetTunnelDevice(): Device | null {
  return gourmetTunnelDeviceCache;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '' || /^E\d+/i.test(s)) return null;
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseFechaMs(s: string | undefined | null): number {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

function getPowerOn(datos: Record<string, string | number | null> | undefined): boolean {
  if (!datos) return false;
  const raw = datos.S_Power ?? datos.S_power;
  if (raw === 1 || raw === '1' || raw === true) return true;
  const n = toNum(raw);
  return n === 1;
}

function getSupplyTempFromDatos(
  datos: Record<string, string | number | null> | undefined
): number | null {
  if (!datos) return null;
  const raw =
    datos.T_Suministro ??
    datos.T_suministro ??
    datos['T_Suministro'] ??
    datos['T_suministro'];
  return toNum(raw);
}

function normalizeDatos(d: Record<string, string | number | null> | undefined): Record<string, string | number | null> {
  if (!d) return {};
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(d)) {
    out[k] = v as string | number | null;
  }
  return out;
}

function pickLatestDispositivo(dispositivos: DispositivoBloque[]): DispositivoBloque | null {
  if (!dispositivos.length) return null;
  let best: DispositivoBloque | null = null;
  let bestMs = -1;
  for (const b of dispositivos) {
    const ms = parseFechaMs(b.fecha);
    if (ms >= bestMs) {
      bestMs = ms;
      best = b;
    }
  }
  return best;
}

function buildTunnelGroupFromBloque(
  grupoNombre: string,
  imeiList: string[],
  bloque: DispositivoBloque
): TunnelTelemetryGroup {
  const conjunto = bloque.conjunto ?? [];
  const byUnidad = new Map<string, ConjuntoRow>();
  for (const row of conjunto) {
    const u = row.unidad;
    if (u) byUnidad.set(u, row);
  }

  const units: TunnelUnitTelemetry[] = TUNEL_UNIT_ORDER.map((unidad) => {
    const row = byUnidad.get(unidad);
    const datos = normalizeDatos(row?.datos);
    const powerOn = getPowerOn(datos);
    const supplyTemp = getSupplyTempFromDatos(datos);
    return {
      unidad,
      pregunta: row?.pregunta ?? null,
      powerOn,
      supplyTemp,
      datos,
    };
  });

  const onTemps = units.filter((u) => u.powerOn && u.supplyTemp != null).map((u) => u.supplyTemp!);
  const allTemps = units.filter((u) => u.supplyTemp != null).map((u) => u.supplyTemp!);
  const anyOn = units.some((u) => u.powerOn);

  let averageSupplyTemp: number | null = null;
  let averageMode: TunnelTelemetryGroup['averageMode'] = 'all_off';
  if (anyOn && onTemps.length > 0) {
    averageSupplyTemp = onTemps.reduce((a, b) => a + b, 0) / onTemps.length;
    averageMode = 'powered_on';
  } else if (allTemps.length > 0) {
    averageSupplyTemp = allTemps.reduce((a, b) => a + b, 0) / allTemps.length;
    averageMode = 'all_off';
  }

  const selectedImei = typeof bloque.imei === 'string' ? bloque.imei : null;

  return {
    grupo: grupoNombre,
    muestraFecha: bloque.fecha ?? null,
    imeiRedundancy: imeiList,
    selectedImei,
    averageSupplyTemp,
    averageMode,
    units,
  };
}

function connectionAndStatus(lastSeenIso: string | null): Pick<Device, 'status' | 'estado_conexion'> {
  if (!lastSeenIso) return { status: 'offline', estado_conexion: 'offline' };
  const last = new Date(lastSeenIso);
  const mins = (Date.now() - last.getTime()) / 60000;
  if (!Number.isFinite(mins) || mins > 720) return { status: 'offline', estado_conexion: 'offline' };
  if (mins > 30) return { status: 'warning', estado_conexion: 'wait' };
  return { status: 'active', estado_conexion: 'online' };
}

export function buildTunnelDeviceFromJson(json: unknown): Device {
  const j = json as TunelGrupoJson;
  const grupoNombre = j.nombre ?? 'TUNEL_GREAT';
  const imeiRaw = j.imei;
  const imeiList = Array.isArray(imeiRaw) ? imeiRaw.map(String) : imeiRaw ? [String(imeiRaw)] : [];

  const dispositivos = j.dispositivos ?? [];
  const bloque = pickLatestDispositivo(dispositivos);
  const tunnel = bloque
    ? buildTunnelGroupFromBloque(grupoNombre, imeiList, bloque)
    : ({
        grupo: grupoNombre,
        muestraFecha: j.fecha ?? null,
        imeiRedundancy: imeiList,
        selectedImei: null,
        averageSupplyTemp: null,
        averageMode: 'all_off',
        units: TUNEL_UNIT_ORDER.map((unidad) => ({
          unidad,
          pregunta: null,
          powerOn: false,
          supplyTemp: null,
          datos: {},
        })),
      } satisfies TunnelTelemetryGroup);

  const lastSeen = tunnel.muestraFecha ?? j.fecha ?? new Date().toISOString();
  const { status, estado_conexion } = connectionAndStatus(tunnel.muestraFecha ?? j.fecha ?? null);

  const b = bloque;
  const avgTemp = tunnel.averageSupplyTemp ?? 0;
  const anyOn = tunnel.units.some((u) => u.powerOn);
  const co2 = b && b.co2_reading != null ? toNum(b.co2_reading) : null;
  const eth = b && b.campo_1 != null ? toNum(b.campo_1) : null;
  const setPoint = b && b.set_point != null ? toNum(b.set_point) ?? 22 : 22;
  const rh = b && b.relative_humidity != null ? toNum(b.relative_humidity) ?? 0 : 0;

  const tLabel = `Túnel ${grupoNombre}`;
  const device: Device = {
    id: GOURMET_TUNEL_DEVICE_ID,
    nombreApi: tLabel,
    name: tLabel,
    status,
    estado_conexion,
    last_seen: lastSeen,
    telemetry: {
      temp_supply_1: avgTemp,
      return_air: b && b.return_air != null ? toNum(b.return_air) ?? avgTemp : avgTemp,
      relative_humidity: rh,
      ethylene: eth,
      co2_reading: co2,
      set_point: setPoint,
      stateProcess: 'None',
      power_state: anyOn ? 1 : 0,
      alarm_present: (b?.alarm_present === 1 ? 1 : 0) as 0 | 1,
    },
    operational: {
      evaporation_coil: b && b.evaporation_coil != null ? toNum(b.evaporation_coil) ?? 0 : 0,
      condensation_coil: b && b.condensation_coil != null ? toNum(b.condensation_coil) ?? 0 : 0,
      ambient_air: b && b.ambient_air != null ? toNum(b.ambient_air) ?? 0 : 0,
      power_consumption: b && b.power_consumption != null ? toNum(b.power_consumption) ?? 0 : 0,
      power_kwh: b && b.power_kwh != null ? toNum(b.power_kwh) ?? 0 : 0,
      battery_voltage: b && b.battery_voltage != null ? toNum(b.battery_voltage) ?? 0 : 0,
      defrost_interval: b && b.defrost_interval != null ? toNum(b.defrost_interval) ?? 6 : 6,
      fresh_air_ex_mode: b && b.fresh_air_ex_mode != null ? toNum(b.fresh_air_ex_mode) ?? 0 : 0,
    },
    tunnel,
  };

  gourmetTunnelDeviceCache = device;
  return device;
}

export function buildTunnelDeviceOffline(): Device {
  const tunnel: TunnelTelemetryGroup = {
    grupo: 'TUNEL_GREAT',
    muestraFecha: null,
    imeiRedundancy: [],
    selectedImei: null,
    averageSupplyTemp: null,
    averageMode: 'all_off',
    units: TUNEL_UNIT_ORDER.map((unidad) => ({
      unidad,
      pregunta: null,
      powerOn: false,
      supplyTemp: null,
      datos: {},
    })),
  };
  const tOffline = 'Túnel TUNEL_GREAT';
  const device: Device = {
    id: GOURMET_TUNEL_DEVICE_ID,
    nombreApi: tOffline,
    name: tOffline,
    status: 'offline',
    estado_conexion: 'offline',
    last_seen: new Date(0).toISOString(),
    telemetry: {
      temp_supply_1: 0,
      return_air: 0,
      relative_humidity: 0,
      ethylene: null,
      co2_reading: null,
      set_point: 22,
      stateProcess: 'None',
      power_state: 0,
      alarm_present: 0,
    },
    operational: {
      evaporation_coil: 0,
      condensation_coil: 0,
      ambient_air: 0,
      power_consumption: 0,
      power_kwh: 0,
      battery_voltage: 0,
      defrost_interval: 6,
      fresh_air_ex_mode: 0,
    },
    tunnel,
  };
  gourmetTunnelDeviceCache = device;
  return device;
}

function tunelGrupoRequestUrl(): string {
  const direct = VITE_TUNEL_GRUPO_URL_RAW?.trim();
  if (direct) return direct;
  const root = RIPENER_API_URL.replace(/\/$/, '');
  return `${root}/api/v1/tunel/grupo?grupo=TUNEL_GREAT`;
}

/** Sin URL directa en env: usa Ripener (Bearer) para proxy servidor → 161.132.53.51 (sin CORS). */
function tunelFetchUsesRipenerProxy(): boolean {
  return !VITE_TUNEL_GRUPO_URL_RAW?.trim();
}

export async function fetchTunelGrupoJson(): Promise<unknown> {
  const url = tunelGrupoRequestUrl();
  const res = await fetch(url, {
    method: 'GET',
    headers: tunelFetchUsesRipenerProxy() ? authHeaders() : { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`leer_grupo_tunel: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function refreshGourmetTunnelDevice(): Promise<Device> {
  try {
    const json = await fetchTunelGrupoJson();
    return buildTunnelDeviceFromJson(json);
  } catch (e) {
    console.warn('Túnel Gourmet: no se pudo obtener leer_grupo_tunel', e);
    return buildTunnelDeviceOffline();
  }
}
