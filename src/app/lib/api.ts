import { Device, MOCK_DEVICES, TermoKingEstadoGeneralResponse, TermoKingHistorialResponse, mapTermoKingDispositivoToDevice } from '@/app/data';
import { API_BASE_URL } from '@/app/config';
import { buildGourmetDevice, buildGourmetHistoryPoints, isGourmetSession, isGourmetMaduradorFleetSession } from '@/app/lib/gourmet';
import {
  GOURMET_TUNNEL_ETHYLENE_IMEI,
  packageGourmetFleetDevices,
} from '@/app/lib/gourmetTunnelFleet';
import { isFleetDemoSession } from '@/app/lib/fleetDemo';
import { fetchFleetDemoMaduradorDetail, fetchFleetDemoMaduradorList } from '@/app/lib/maduradorFleetDirect';
import {
  fetchMaduradorRangoHistoryForImei,
  getMaduradorDevicesCached,
  hasMaduradorIdentificador,
  shouldUseMaduradorDispositivosApi,
  shouldUseMaduradorRangoHistory,
} from '@/app/lib/madurador';
import {
  GOURMET_TUNEL_DEVICE_ID,
  getCachedGourmetTunnelDevice,
  refreshGourmetTunnelDevice,
  setCachedGourmetTunnelDevice,
} from '@/app/lib/tunelUnido';
import {
  applySobrenombresToDevice,
  fetchDeviceNameMap,
  mergeDevicesWithSobrenombres,
  putDeviceDisplayName,
} from '@/app/lib/deviceNamesApi';
import { deviceNameStorageKey } from '@/app/lib/deviceLocalNames';
import { applyTelemetryDisplayPolicyToDevice } from '@/app/lib/telemetryDisplayPolicy';
import { listControlSessions } from '@/app/lib/deviceControlProcessApi';

async function finalizeClientFleetEthylene(list: Device[]): Promise<Device[]> {
  let sessions = null;
  try {
    sessions = await listControlSessions();
  } catch {
    sessions = null;
  }
  return list.map((d) => {
    const withRaw = {
      ...d,
      telemetry: {
        ...d.telemetry,
        ethylene_raw: d.telemetry.ethylene_raw ?? d.telemetry.ethylene,
      },
    };
    return applyTelemetryDisplayPolicyToDevice(withRaw, { sessions });
  });
}

async function finalizeGourmetClientFleet(list: Device[]): Promise<Device[]> {
  const named = await mergeSavedDisplayNames(list);
  return finalizeClientFleetEthylene(named);
}

async function finalizeGourmetClientDevice(device: Device): Promise<Device> {
  const named = await mergeSavedDisplayNameOne(device);
  let sessions = null;
  try {
    sessions = await listControlSessions();
  } catch {
    sessions = null;
  }
  const withRaw = {
    ...named,
    telemetry: {
      ...named.telemetry,
      ethylene_raw: named.telemetry.ethylene_raw ?? named.telemetry.ethylene,
    },
  };
  return applyTelemetryDisplayPolicyToDevice(withRaw, { sessions });
}

async function mergeSavedDisplayNames(list: Device[]): Promise<Device[]> {
  if (list.length === 0) return list;
  try {
    const sobrenombres = await fetchDeviceNameMap();
    return mergeDevicesWithSobrenombres(list, sobrenombres);
  } catch {
    return list.map((d) => {
      const api = d.nombreApi?.trim() || d.name?.trim() || d.id;
      return { ...d, nombreApi: d.nombreApi ?? api, sobrenombre: null, name: api };
    });
  }
}

async function mergeSavedDisplayNameOne(device: Device): Promise<Device> {
  try {
    const sobrenombres = await fetchDeviceNameMap();
    return applySobrenombresToDevice(device, sobrenombres);
  } catch {
    const api = device.nombreApi?.trim() || device.name?.trim() || device.id;
    return { ...device, nombreApi: device.nombreApi ?? api, sobrenombre: null, name: api };
  }
}

/** GET TermoKing estado_general → lista de dispositivos */
async function fetchEstadoGeneral(): Promise<Device[]> {
  const res = await fetch(`${API_BASE_URL}/TermoKing/estado_general/`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`estado_general: ${res.status} ${res.statusText}`);
  const json: TermoKingEstadoGeneralResponse = await res.json();
  const list = json.data?.dispositivos ?? [];
  return list.map(mapTermoKingDispositivoToDevice);
}

function appendGourmetTunnelIfNeeded(list: Device[]): Promise<Device[]> {
  if (!isGourmetSession() || isGourmetMaduradorFleetSession()) return Promise.resolve(list);
  return refreshGourmetTunnelDevice().then((tun) => {
    if (list.some((d) => d.id === tun.id)) return list;
    setCachedGourmetTunnelDevice(tun);
    return [...list, tun];
  });
}

async function fetchGourmetMaduradorFleet(): Promise<Device[]> {
  const raw = await getMaduradorDevicesCached();
  return packageGourmetFleetDevices(raw);
}

export async function fetchDevices(): Promise<Device[]> {
  if (isFleetDemoSession()) {
    try {
      const list = await fetchFleetDemoMaduradorList();
      return finalizeClientFleetEthylene(await mergeSavedDisplayNames(list));
    } catch (e) {
      console.warn('Fleet demo Madurador list failed:', e);
      return [];
    }
  }
  if (shouldUseMaduradorDispositivosApi()) {
    try {
      if (isGourmetSession() && isGourmetMaduradorFleetSession()) {
        const list = await fetchGourmetMaduradorFleet();
        return finalizeGourmetClientFleet(list);
      }
      const list = await getMaduradorDevicesCached();
      const withTunnel = await appendGourmetTunnelIfNeeded(list);
      return finalizeGourmetClientFleet(withTunnel);
    } catch (e) {
      console.warn('Madurador dispositivos failed:', e);
      if (isGourmetSession() && !isGourmetMaduradorFleetSession()) {
        const tun = await refreshGourmetTunnelDevice();
        return finalizeGourmetClientFleet([tun]);
      }
      return [];
    }
  }
  if (isGourmetSession() && !isGourmetMaduradorFleetSession()) {
    const mad = buildGourmetDevice();
    const tun = await refreshGourmetTunnelDevice();
    return finalizeGourmetClientFleet([mad, tun]);
  }
  try {
    const list = await fetchEstadoGeneral();
    return mergeSavedDisplayNames(list);
  } catch (e) {
    console.warn('TermoKing estado_general failed, using mock:', e);
    return new Promise((resolve) =>
      setTimeout(async () => resolve(await mergeSavedDisplayNames([...MOCK_DEVICES])), 300)
    );
  }
}

export async function fetchDevice(id: string): Promise<Device> {
  if (isGourmetSession() && isGourmetMaduradorFleetSession() && id === GOURMET_TUNEL_DEVICE_ID) {
    const list = await fetchGourmetMaduradorFleet();
    const d = list.find((x) => x.id === id);
    if (d) return finalizeGourmetClientDevice(d);
  }
  if (isGourmetSession() && !isGourmetMaduradorFleetSession() && id === GOURMET_TUNEL_DEVICE_ID) {
    const d = getCachedGourmetTunnelDevice() ?? (await refreshGourmetTunnelDevice());
    return finalizeGourmetClientDevice(d);
  }
  if (isFleetDemoSession()) {
    try {
      const d = await fetchFleetDemoMaduradorDetail(id);
      return mergeSavedDisplayNameOne(d);
    } catch (e) {
      console.warn('Fleet demo Madurador detail failed, using list row:', e);
      const list = await fetchFleetDemoMaduradorList();
      const d = list.find((x) => x.id === id);
      if (d) return mergeSavedDisplayNameOne(d);
      if (list[0]) return mergeSavedDisplayNameOne(list[0]);
      throw e;
    }
  }
  if (shouldUseMaduradorDispositivosApi()) {
    let list: Device[] = [];
    if (isGourmetSession() && isGourmetMaduradorFleetSession()) {
      list = await fetchGourmetMaduradorFleet();
    } else {
      list = await getMaduradorDevicesCached();
    }
    const device = list.find((d) => d.id === id);
    if (device) return finalizeGourmetClientDevice(device);
    if (list.length) return finalizeGourmetClientDevice(list[0]);
    return new Promise((resolve) =>
      setTimeout(async () => resolve(await mergeSavedDisplayNameOne(MOCK_DEVICES[0])), 200)
    );
  }
  if (isGourmetSession() && !isGourmetMaduradorFleetSession()) {
    return finalizeGourmetClientDevice(buildGourmetDevice());
  }
  try {
    const list = await fetchEstadoGeneral();
    const device = list.find((d) => d.id === id);
    if (device) return mergeSavedDisplayNameOne(device);
  } catch (_) {
    /* fall through */
  }
  const mock = MOCK_DEVICES.find((d) => d.id === id) ?? MOCK_DEVICES[0];
  return new Promise((resolve) =>
    setTimeout(async () => resolve(await mergeSavedDisplayNameOne(mock)), 200)
  );
}

export interface FetchHistoryOptions {
  /** Por defecto: últimas 12 horas */
  fecha_inicio?: string;
  fecha_fin?: string;
  /**
   * Formato fechas en query `buscar_datos_madurador_rango` como hora local America/Lima (GMT-5),
   * en lugar de la zona horaria del navegador.
   */
  maduradorAmericaLima?: boolean;
}

/** Formato ISO para API: YYYY-MM-DDTHH:mm:ss */
function toISOLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface HistoryPoint {
  timestamp: string;
  temp_supply_1: number;
  return_air: number;
  evaporation_coil: number;
  condensation_coil: number;
  compress_coil_1: number;
  ambient_air: number;
  cargo_1_temp: number | null;
  cargo_2_temp: number | null;
  cargo_3_temp: number | null;
  cargo_4_temp: number | null;
  relative_humidity: number;
  /** CFM bruto del ventilador (Madurador `flat.avl`); para filtrar gráficas si > 200. */
  avl_raw?: number | null;
  avl_pct: number;
  line_voltage: number;
  line_frequency: number;
  co2_reading: number | null;
  o2_reading: number | null;
  set_point: number;
  capacity_load: number;
  power_state: number;
  humidity_set_point: number;
  set_point_o2: number | null;
  set_point_co2: number | null;
  sp_ethyleno: number;
  ethylene: number | null;
  iCtrlRip: number;
  power_kwh?: number | null;
}

/** GET TermoKing historial/{mac}/ — últimas 12h por defecto; máx 7 días. */
export async function fetchDeviceHistory(
  id: string,
  options: FetchHistoryOptions = {}
): Promise<HistoryPoint[]> {
  if (shouldUseMaduradorRangoHistory()) {
    const historyImei =
      isGourmetSession() && id === GOURMET_TUNEL_DEVICE_ID ? GOURMET_TUNNEL_ETHYLENE_IMEI : id;
    const { points } = await fetchMaduradorRangoHistoryForImei(historyImei, options ?? {});
    return Array.isArray(points) ? points : [];
  }
  if (isGourmetSession() && !isGourmetMaduradorFleetSession() && id === GOURMET_TUNEL_DEVICE_ID) {
    const dev = getCachedGourmetTunnelDevice() ?? (await refreshGourmetTunnelDevice());
    const ts = dev.last_seen;
    const tel = dev.telemetry;
    const op = dev.operational;
    return [
      {
        timestamp: new Date(ts).toISOString(),
        temp_supply_1: tel.temp_supply_1,
        return_air: tel.return_air,
        evaporation_coil: op.evaporation_coil,
        condensation_coil: op.condensation_coil,
        compress_coil_1: 0,
        ambient_air: op.ambient_air,
        cargo_1_temp: null,
        cargo_2_temp: null,
        cargo_3_temp: null,
        cargo_4_temp: null,
        relative_humidity: tel.relative_humidity,
        avl_pct: 0,
        line_voltage: 0,
        line_frequency: 0,
        co2_reading: tel.co2_reading,
        o2_reading: null,
        set_point: tel.set_point,
        capacity_load: 0,
        power_state: tel.power_state,
        humidity_set_point: 0,
        set_point_o2: null,
        set_point_co2: null,
        sp_ethyleno: 0,
        ethylene: tel.ethylene,
        iCtrlRip: 0,
        power_kwh: op.power_kwh,
      },
    ];
  }
  if (isGourmetSession() && !isGourmetMaduradorFleetSession()) {
    const pts = buildGourmetHistoryPoints();
    const fi = options.fecha_inicio;
    const ff = options.fecha_fin;
    if (fi && ff) {
      const a = new Date(fi).getTime();
      const b = new Date(ff).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
        return pts.filter((p) => {
          const t = new Date(p.timestamp).getTime();
          return t >= a && t <= b;
        });
      }
    }
    return pts;
  }
  const now = new Date();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const fecha_inicio = options.fecha_inicio ?? toISOLocal(twelveHoursAgo);
  const fecha_fin = options.fecha_fin ?? toISOLocal(now);

  const macEncoded = encodeURIComponent(id);
  const url = `${API_BASE_URL}/TermoKing/historial/${macEncoded}/?fecha_inicio=${encodeURIComponent(fecha_inicio)}&fecha_fin=${encodeURIComponent(fecha_fin)}`;

  try {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`historial: ${res.status}`);
    const json: TermoKingHistorialResponse = await res.json();
    const tramas = json.data?.tramas ?? [];
    return tramas.map((t) => {
      const avl = t.avl != null ? Number(t.avl) : 0;
      return {
        timestamp: t.fecha,
        temp_supply_1: Number(t.temp_supply_1 ?? t.supply_air_temp ?? 0),
        return_air: Number(t.return_air ?? t.return_air_temp ?? 0),
        evaporation_coil: Number(t.evaporation_coil ?? 0),
        condensation_coil: Number(t.condensation_coil ?? 0),
        compress_coil_1: Number(t.compress_coil_1 ?? 0),
        ambient_air: Number(t.ambient_air ?? 0),
        cargo_1_temp: t.cargo_1_temp != null ? Number(t.cargo_1_temp) : null,
        cargo_2_temp: t.cargo_2_temp != null ? Number(t.cargo_2_temp) : null,
        cargo_3_temp: t.cargo_3_temp != null ? Number(t.cargo_3_temp) : null,
        cargo_4_temp: t.cargo_4_temp != null ? Number(t.cargo_4_temp) : null,
        relative_humidity: Number(t.relative_humidity ?? 0),
        avl_raw: Number.isFinite(avl) && avl > 0 ? avl : null,
        avl_pct: Math.min(100, Math.round((avl / 225) * 100)),
        line_voltage: Number(t.line_voltage ?? 0),
        line_frequency: Number(t.line_frequency ?? 0),
        co2_reading: t.co2_reading != null ? Number(t.co2_reading) : null,
        o2_reading: t.o2_reading != null ? Number(t.o2_reading) : null,
        set_point: Number(t.set_point ?? 0),
        capacity_load: Number(t.capacity_load ?? 0),
        power_state: Number(t.power_state ?? 0),
        humidity_set_point: Number(t.humidity_set_point ?? 0),
        set_point_o2: t.set_point_o2 != null ? Number(t.set_point_o2) : null,
        set_point_co2: t.set_point_co2 != null ? Number(t.set_point_co2) : null,
        sp_ethyleno: Number(t.sp_ethyleno ?? 0),
        ethylene: t.ethylene != null ? Number(t.ethylene) : null,
        iCtrlRip: Number(t.iCtrlRip ?? 0),
        power_kwh: t.power_kwh != null ? Number(t.power_kwh) : null,
      };
    });
  } catch (e) {
    console.warn('TermoKing historial failed, using mock:', e);
    return getMockHistory(id, fecha_inicio, fecha_fin);
  }
}

function getMockHistory(_id: string, start: string, end: string): Promise<HistoryPoint[]> {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const step = Math.max((endMs - startMs) / 40, 60000);
  const points: HistoryPoint[] = [];
  let kwh = 2900;
  for (let t = startMs; t <= endMs; t += step) {
    kwh += 0.5 + Math.random();
    points.push({
      timestamp: new Date(t).toISOString(),
      temp_supply_1: 18 + Math.random() * 2 - 1,
      return_air: 18.5 + Math.random() * 2 - 1,
      evaporation_coil: 17 + Math.random() * 2,
      condensation_coil: 35 + Math.random() * 5,
      compress_coil_1: 55 + Math.random() * 10,
      ambient_air: 20 + Math.random() * 3,
      cargo_1_temp: null,
      cargo_2_temp: null,
      cargo_3_temp: null,
      cargo_4_temp: null,
      relative_humidity: 90 + Math.random() * 5 - 2.5,
      avl_raw: 80 + Math.random() * 40,
      avl_pct: Math.round(Math.random() * 100),
      line_voltage: 440 + Math.random() * 20,
      line_frequency: 60,
      co2_reading: 1 + Math.random(),
      o2_reading: 18 + Math.random(),
      set_point: 18,
      capacity_load: 5 + Math.round(Math.random() * 5),
      power_state: Math.random() > 0.3 ? 1 : 0,
      humidity_set_point: 95,
      set_point_o2: null,
      set_point_co2: 2,
      sp_ethyleno: 150,
      ethylene: 50 + Math.random() * 20,
      iCtrlRip: Math.random() > 0.5 ? 1 : 0,
      power_kwh: kwh,
    });
  }
  return Promise.resolve(points);
}

export async function updateDeviceName(id: string, name: string) {
  await putDeviceDisplayName(deviceNameStorageKey(id) || id, name);
}

export async function sendControlCommand(id: string, action: string, params: any) {
  return new Promise((resolve) => {
    console.log(`[MOCK] Sending command to ${id}:`, action, params);
    setTimeout(() => resolve({ status: 'success', action, params }), 500);
  });
}
