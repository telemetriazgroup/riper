import { Device, MOCK_DEVICES, TermoKingEstadoGeneralResponse, TermoKingHistorialResponse, mapTermoKingDispositivoToDevice } from '@/app/data';
import { API_BASE_URL } from '@/app/config';

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

export async function fetchDevices(): Promise<Device[]> {
  try {
    return await fetchEstadoGeneral();
  } catch (e) {
    console.warn('TermoKing estado_general failed, using mock:', e);
    return new Promise((resolve) => setTimeout(() => resolve(MOCK_DEVICES), 300));
  }
}

export async function fetchDevice(id: string): Promise<Device> {
  try {
    const list = await fetchEstadoGeneral();
    const device = list.find((d) => d.id === id);
    if (device) return device;
  } catch (_) {}
  const mock = MOCK_DEVICES.find((d) => d.id === id) ?? MOCK_DEVICES[0];
  return new Promise((resolve) => setTimeout(() => resolve(mock), 200));
}

export interface FetchHistoryOptions {
  /** Por defecto: últimas 12 horas */
  fecha_inicio?: string;
  fecha_fin?: string;
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
  return sendControlCommand(id, 'manual_update', { name });
}

export async function sendControlCommand(id: string, action: string, params: any) {
  return new Promise((resolve) => {
    console.log(`[MOCK] Sending command to ${id}:`, action, params);
    setTimeout(() => resolve({ status: 'success', action, params }), 500);
  });
}
