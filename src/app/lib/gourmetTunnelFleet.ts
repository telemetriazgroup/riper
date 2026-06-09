import type { Device, MaduradorReference, TunnelTelemetryGroup, TunnelUnitTelemetry } from '@/app/data';
import { GOURMET_TUNEL_DEVICE_ID, TUNEL_UNIT_ORDER } from '@/app/lib/tunelUnido';
import { setCachedGourmetTunnelDevice } from '@/app/lib/tunelUnido';
import {
  connectionStateFromAgeMinutes,
  maduradorServerTimestampToMs,
  minutesSinceUtcMs,
} from '@/app/lib/maduradorTimestamps';
import { roundUiNumber } from '@/app/lib/formatUiNumber';

/** IMEI del dispositivo Gourmet fuera del túnel (5 máquinas). */
export const GOURMET_STANDALONE_IMEI = '866262036100104';

/** IMEI con sensor de etileno (UNIT333); historial 12 h del túnel. */
export const GOURMET_TUNNEL_ETHYLENE_IMEI = '867856038562796';

/** Mapeo fijo unidad → IMEI (empresa 5001). */
export const GOURMET_TUNNEL_UNIT_IMEIS: Readonly<Record<(typeof TUNEL_UNIT_ORDER)[number], string>> = {
  UNIT555: '868428040551750',
  UNIT222: '860389052988223',
  UNIT444: '868428047365683',
  UNIT333: '867856038562796',
  UNIT111: '866782049840560',
};

export const GOURMET_TUNNEL_GROUP_IMEIS: readonly string[] = TUNEL_UNIT_ORDER.map(
  (u) => GOURMET_TUNNEL_UNIT_IMEIS[u]
);

const IMEI_TO_UNIT = Object.fromEntries(
  TUNEL_UNIT_ORDER.map((u) => [GOURMET_TUNNEL_UNIT_IMEIS[u], u])
) as Record<string, (typeof TUNEL_UNIT_ORDER)[number]>;

export function isGourmetTunnelGroupImei(imei: string | null | undefined): boolean {
  const id = String(imei ?? '').trim();
  return id.length > 0 && GOURMET_TUNNEL_GROUP_IMEIS.includes(id);
}

export function isGourmetStandaloneImei(imei: string | null | undefined): boolean {
  return String(imei ?? '').trim() === GOURMET_STANDALONE_IMEI;
}

export function gourmetUnitIdForImei(imei: string): string | null {
  return IMEI_TO_UNIT[String(imei).trim()] ?? null;
}

export function gourmetImeiForUnit(unitId: string): string | null {
  const key = unitId as (typeof TUNEL_UNIT_ORDER)[number];
  return GOURMET_TUNNEL_UNIT_IMEIS[key] ?? null;
}

/** IMEI devueltos por Madurador para armar la flota Gourmet (5 túnel + standalone). */
export function getGourmetMaduradorFleetImeis(): string[] {
  return [...GOURMET_TUNNEL_GROUP_IMEIS, GOURMET_STANDALONE_IMEI];
}

function avgFinite(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return roundUiNumber(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function maxIso(dates: (string | null | undefined)[]): string {
  let bestMs = 0;
  let best = new Date(0).toISOString();
  for (const raw of dates) {
    if (!raw) continue;
    const ms = maduradorServerTimestampToMs(raw) ?? new Date(raw).getTime();
    if (Number.isFinite(ms) && ms >= bestMs) {
      bestMs = ms;
      best = new Date(ms).toISOString();
    }
  }
  return best;
}

function worstConnection(devices: Device[]): Pick<Device, 'status' | 'estado_conexion'> {
  const rank = (d: Device) =>
    d.estado_conexion === 'online' ? 0 : d.estado_conexion === 'wait' ? 1 : 2;
  const sorted = [...devices].sort((a, b) => rank(a) - rank(b));
  const pick = sorted[0] ?? devices[0];
  return pick
    ? { status: pick.status, estado_conexion: pick.estado_conexion }
    : { status: 'offline', estado_conexion: 'offline' };
}

function sumAlarms(devices: Device[]): number | undefined {
  const vals = devices
    .map((d) => d.numeroAlarmaTotal)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0);
}

function mergeMaduradorRef(devices: Device[]): MaduradorReference | undefined {
  const refs = devices.map((d) => d.madurador).filter(Boolean) as MaduradorReference[];
  if (refs.length === 0) return undefined;
  const eth = devices.find((d) => d.id === GOURMET_TUNNEL_ETHYLENE_IMEI)?.madurador;
  const base = eth ?? refs[0];
  return {
    ...base,
    cargo_1_temp: avgFinite(devices.map((d) => d.madurador?.cargo_1_temp)),
    cargo_2_temp: avgFinite(devices.map((d) => d.madurador?.cargo_2_temp)),
    cargo_3_temp: null,
    cargo_4_temp: null,
    capacity_load: avgFinite(devices.map((d) => d.madurador?.capacity_load)),
    humidity_set_point: avgFinite(devices.map((d) => d.madurador?.humidity_set_point)),
    line_frequency: avgFinite(devices.map((d) => d.madurador?.line_frequency)),
    consumption_ph_1: avgFinite(devices.map((d) => d.madurador?.consumption_ph_1)),
    consumption_ph_2: avgFinite(devices.map((d) => d.madurador?.consumption_ph_2)),
    consumption_ph_3: avgFinite(devices.map((d) => d.madurador?.consumption_ph_3)),
    set_point_co2_value: eth?.set_point_co2_value ?? base.set_point_co2_value,
    sp_ethyleno: eth?.sp_ethyleno ?? base.sp_ethyleno,
    avl_raw: avgFinite(devices.map((d) => d.madurador?.avl_raw)),
    compress_coil_1_temp: avgFinite(devices.map((d) => d.madurador?.compress_coil_1_temp)),
  };
}

function buildUnitRows(unitDevices: Map<string, Device>): TunnelUnitTelemetry[] {
  return TUNEL_UNIT_ORDER.map((unidad) => {
    const imei = GOURMET_TUNNEL_UNIT_IMEIS[unidad];
    const src = unitDevices.get(imei);
    const tel = src?.telemetry;
    return {
      unidad,
      imei,
      pregunta: imei,
      powerOn: tel?.power_state === 1,
      supplyTemp: tel?.temp_supply_1 ?? null,
      sourceDevice: src,
      datos: {},
    };
  });
}

/**
 * Agrega telemetría de las unidades seleccionadas sobre el dispositivo túnel base.
 */
export function aggregateGourmetTunnelDevice(
  base: Device,
  selectedUnitIds: readonly string[]
): Device {
  const tunnel = base.tunnel;
  if (!tunnel) return base;

  const selected = new Set(selectedUnitIds);
  const units = tunnel.units.filter((u) => selected.has(u.unidad));
  const sources = units
    .map((u) => u.sourceDevice)
    .filter((d): d is Device => d != null);

  if (sources.length === 0) return base;

  const ethDevice = sources.find((d) => d.id === GOURMET_TUNNEL_ETHYLENE_IMEI) ??
    unitDevicesFromTunnel(tunnel).get(GOURMET_TUNNEL_ETHYLENE_IMEI);

  const avgReturn = avgFinite(sources.map((d) => d.telemetry.return_air));
  const avgSet = avgFinite(sources.map((d) => d.telemetry.set_point));
  const avgRh = avgFinite(sources.map((d) => d.telemetry.relative_humidity));
  const avgCo2 = ethDevice?.telemetry.co2_reading ?? null;
  const avgSupply = avgFinite(sources.map((d) => d.telemetry.temp_supply_1));
  const ethylene = ethDevice?.telemetry.ethylene ?? null;

  const conn = worstConnection(sources);
  const lastSeen = maxIso(sources.map((d) => d.last_seen));

  const operational = {
    evaporation_coil: avgFinite(sources.map((d) => d.operational.evaporation_coil)) ?? 0,
    condensation_coil: avgFinite(sources.map((d) => d.operational.condensation_coil)) ?? 0,
    ambient_air: avgFinite(sources.map((d) => d.operational.ambient_air)) ?? 0,
    power_consumption: avgFinite(sources.map((d) => d.operational.power_consumption)) ?? 0,
    power_kwh: avgFinite(sources.map((d) => d.operational.power_kwh)) ?? 0,
    battery_voltage: avgFinite(sources.map((d) => d.operational.battery_voltage)) ?? 0,
    defrost_interval: sources[0]?.operational.defrost_interval ?? 6,
    fresh_air_ex_mode: sources[0]?.operational.fresh_air_ex_mode ?? 0,
  };

  const processSource =
    ethDevice?.process ?? sources.find((d) => d.process)?.process ?? base.process;

  return {
    ...base,
    ...conn,
    last_seen: lastSeen,
    numeroAlarmaTotal: sumAlarms(sources),
    procesoApi: ethDevice?.procesoApi ?? sources.find((d) => d.procesoApi)?.procesoApi,
    idProcesoApi: ethDevice?.idProcesoApi ?? sources.find((d) => d.idProcesoApi)?.idProcesoApi,
    process: processSource,
    maduradorSummary: ethDevice?.maduradorSummary ?? base.maduradorSummary,
    telemetry: {
      ...base.telemetry,
      temp_supply_1: avgSupply ?? avgReturn ?? base.telemetry.temp_supply_1,
      return_air: avgReturn ?? base.telemetry.return_air,
      set_point: avgSet ?? base.telemetry.set_point,
      relative_humidity: avgRh ?? base.telemetry.relative_humidity,
      co2_reading: avgCo2 ?? base.telemetry.co2_reading,
      ethylene,
      power_state: sources.some((d) => d.telemetry.power_state === 1) ? 1 : 0,
      alarm_present: sources.some((d) => d.telemetry.alarm_present === 1) ? 1 : 0,
    },
    operational,
    madurador: ethDevice?.madurador ?? mergeMaduradorRef(sources),
    tunnel: {
      ...tunnel,
      units: tunnel.units,
    },
  };
}

function unitDevicesFromTunnel(tunnel: TunnelTelemetryGroup): Map<string, Device> {
  const map = new Map<string, Device>();
  for (const u of tunnel.units) {
    if (u.imei && u.sourceDevice) map.set(u.imei, u.sourceDevice);
  }
  return map;
}

/**
 * Construye el dispositivo virtual del túnel a partir de filas Madurador (5 IMEI).
 */
export function buildGourmetTunnelDeviceFromUnitRows(unitRows: Device[]): Device {
  const byImei = new Map(unitRows.map((d) => [String(d.id).trim(), d]));
  const ordered = GOURMET_TUNNEL_GROUP_IMEIS.map((imei) => byImei.get(imei)).filter(
    (d): d is Device => d != null
  );

  const unitMap = new Map<string, Device>();
  for (const d of ordered) unitMap.set(d.id, d);

  const allSelected = [...TUNEL_UNIT_ORDER];
  const units = buildUnitRows(unitMap);

  const lastRaw = maxIso(ordered.map((d) => d.last_seen));
  const lastMs = maduradorServerTimestampToMs(lastRaw) ?? new Date(lastRaw).getTime();
  const mins = minutesSinceUtcMs(lastMs);
  const conn = connectionStateFromAgeMinutes(mins);

  const base: Device = {
    id: GOURMET_TUNEL_DEVICE_ID,
    nombreApi: 'Túnel TUNEL_GREAT',
    name: 'Túnel TUNEL_GREAT',
    status: conn.status,
    estado_conexion: conn.estado_conexion,
    last_seen: lastRaw,
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
    tunnel: {
      grupo: 'TUNEL_GREAT',
      muestraFecha: lastRaw,
      imeiRedundancy: [...GOURMET_TUNNEL_GROUP_IMEIS],
      selectedImei: GOURMET_TUNNEL_ETHYLENE_IMEI,
      averageSupplyTemp: avgFinite(ordered.map((d) => d.telemetry.temp_supply_1)),
      averageMode: ordered.some((d) => d.telemetry.power_state === 1) ? 'powered_on' : 'all_off',
      units,
    },
  };

  return aggregateGourmetTunnelDevice(base, allSelected);
}

function cacheTunnelIfBuilt(device: Device): Device {
  if (device.id === GOURMET_TUNEL_DEVICE_ID) setCachedGourmetTunnelDevice(device);
  return device;
}

/**
 * Flota Gourmet: standalone + túnel agregado (no las 5 máquinas por separado).
 */
export function packageGourmetFleetDevices(allDevices: Device[]): Device[] {
  const byId = new Map(allDevices.map((d) => [String(d.id).trim(), d]));
  const tunnelRows = GOURMET_TUNNEL_GROUP_IMEIS.map((imei) => byId.get(imei)).filter(
    (d): d is Device => d != null
  );
  const standalone = byId.get(GOURMET_STANDALONE_IMEI);

  const out: Device[] = [];
  if (standalone) out.push(standalone);
  if (tunnelRows.length > 0) out.push(cacheTunnelIfBuilt(buildGourmetTunnelDeviceFromUnitRows(tunnelRows)));
  return out;
}

/** Superadmin / listas amplias: conserva todos los equipos y añade el túnel agregado si hay unidades. */
export function appendGourmetTunnelAggregate(allDevices: Device[]): Device[] {
  if (allDevices.some((d) => d.id === GOURMET_TUNEL_DEVICE_ID)) return allDevices;
  const byId = new Map(allDevices.map((d) => [String(d.id).trim(), d]));
  const tunnelRows = GOURMET_TUNEL_GROUP_IMEIS.map((imei) => byId.get(imei)).filter(
    (d): d is Device => d != null
  );
  if (tunnelRows.length === 0) return allDevices;
  return [...allDevices, cacheTunnelIfBuilt(buildGourmetTunnelDeviceFromUnitRows(tunnelRows))];
}

export function listContainsGourmetTunnelUnits(devices: Device[]): boolean {
  const ids = new Set(devices.map((d) => String(d.id).trim()));
  return GOURMET_TUNNEL_GROUP_IMEIS.some((imei) => ids.has(imei));
}

export function defaultGourmetTunnelSelectedUnits(): string[] {
  return [...TUNEL_UNIT_ORDER];
}
