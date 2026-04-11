import type { Device, MaduradorReference, OperationalData, TelemetryData } from '@/app/data';
import type { HistoryPoint } from '@/app/lib/api';
import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, getStoredUser } from '@/app/lib/auth';
import { getMaduradorListCache, MADURADOR_LIST_TTL_MS, setMaduradorListCache } from '@/app/lib/maduradorCache';

export function hasMaduradorIdentificador(): boolean {
  const id = getStoredUser()?.identificador?.trim();
  return Boolean(id);
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

function displayScalar(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') return v;
  return null;
}

function nestedValor(obj: unknown): number | null {
  if (obj && typeof obj === 'object' && obj !== null && 'valor' in obj) {
    return toNum((obj as { valor: unknown }).valor);
  }
  return null;
}

function flatMaduradorRow(row: Record<string, unknown>): Record<string, unknown> {
  const ud = row.ultimo_dato;
  const out: Record<string, unknown> = { ...row };
  if (ud && typeof ud === 'object' && !Array.isArray(ud)) {
    Object.assign(out, ud as Record<string, unknown>);
  }
  return out;
}

function coilCompressDisplay(row: Record<string, unknown>, flat: Record<string, unknown>): string | number | null {
  const v = flat.compress_coil_1;
  if (v != null && typeof v === 'object' && 'valor_actual' in v) {
    const n = toNum((v as { valor_actual?: unknown }).valor_actual);
    return n != null ? n : displayScalar((v as { valor_actual?: unknown }).valor_actual);
  }
  const top = row.compress_coil_1;
  if (top != null && typeof top === 'object' && 'valor_actual' in top) {
    const n = toNum((top as { valor_actual?: unknown }).valor_actual);
    return n != null ? n : displayScalar((top as { valor_actual?: unknown }).valor_actual);
  }
  return displayScalar(v);
}

function sanitizeHumidity(raw: unknown): number | null {
  const n = toNum(raw);
  if (n == null) return null;
  if (n >= 0 && n <= 100) return n;
  return null;
}

function fanPctFromAvl(avlRaw: number | null): number {
  if (avlRaw == null || !Number.isFinite(avlRaw)) return 100;
  if (avlRaw >= 0 && avlRaw <= 100) return Math.round(avlRaw);
  return Math.min(100, Math.round((avlRaw / 5000) * 100));
}

export function mapMaduradorRowToDevice(row: Record<string, unknown>): Device {
  const flat = flatMaduradorRow(row);

  const imei = String(flat.imei ?? row.imei ?? 'unknown');
  const name = String(flat.device ?? row.device ?? imei);

  const lastSample =
    (flat.fecha != null ? String(flat.fecha) : null) ??
    (row.hasta != null ? String(row.hasta) : null) ??
    (row.fecha_procesada != null ? String(row.fecha_procesada) : null) ??
    new Date().toISOString();
  const lastSeen = lastSample;

  const lastMs = new Date(lastSeen).getTime();
  const mins = Number.isFinite(lastMs) ? (Date.now() - lastMs) / 60000 : 9999;

  let status: Device['status'] = 'active';
  if (!Number.isFinite(mins) || mins > 720) status = 'offline';
  else if (mins > 30) status = 'warning';

  const alarmas = row.alarmas as { numero_alarma?: unknown; activas?: unknown[] } | undefined;
  const nAct = Array.isArray(alarmas?.activas) ? alarmas!.activas!.length : 0;
  const numAl = toNum(alarmas?.numero_alarma ?? flat.numero_alarma);
  if (nAct > 0 || (numAl != null && numAl > 0)) status = 'alarm';

  const rawPs = toNum(flat.power_state ?? row.ultimo_power_state);
  const power_state: 0 | 1 = rawPs === 1 ? 1 : 0;

  const setPointNested = nestedValor(row.set_point);
  const set_point =
    inRange(toNum(flat.set_point ?? setPointNested), -40, 40) ?? 18;

  const humiditySpNested = nestedValor(row.humidity_set_point);
  const humidity_set_point = inRange(toNum(flat.humidity_set_point ?? humiditySpNested), 0, 100);

  const temp_supply_1 = inRange(toNum(flat.temp_supply_1), -40, 120) ?? 0;
  const return_air = inRange(toNum(flat.return_air), -40, 120) ?? 0;
  const relHum = sanitizeHumidity(flat.relative_humidity);
  const humidityVal = relHum ?? 0;

  const ethylene = inRange(toNum(flat.campo_1), 0, 500);
  const co2 = inRange(toNum(flat.co2_reading), 0, 100);

  const evap = inRange(toNum(flat.evaporation_coil), -60, 80) ?? 0;
  const cond = inRange(toNum(flat.condensation_coil), -20, 90) ?? 0;
  const amb = inRange(toNum(flat.ambient_air), -40, 60) ?? 0;

  const avlRaw = toNum(flat.avl);
  const fanRefPct = fanPctFromAvl(avlRaw);

  const voltSane = inRange(toNum(flat.line_voltage), 90, 600);
  const batt = inRange(toNum(flat.battery_voltage), 0, 32);

  const capLoad = inRange(toNum(flat.capacity_load), 0, 100);

  const telemetry: TelemetryData = {
    temp_supply_1,
    return_air,
    relative_humidity: humidityVal,
    ethylene,
    co2_reading: co2,
    set_point,
    stateProcess: 'Ripening',
    power_state,
    alarm_present: toNum(flat.alarm_present) === 1 ? 1 : 0,
  };

  const operational: OperationalData = {
    evaporation_coil: evap,
    condensation_coil: cond,
    ambient_air: amb,
    power_consumption: inRange(toNum(flat.power_consumption), -500, 500) ?? 0,
    power_kwh: inRange(toNum(flat.power_kwh), 0, 1e9) ?? 0,
    battery_voltage: batt ?? 0,
    defrost_interval: Math.round(toNum(flat.defrost_interval) ?? 6),
    fresh_air_ex_mode: Number(toNum(flat.fresh_air_ex_mode) ?? 0),
  };

  const iden =
    row.identificador != null
      ? String(row.identificador)
      : flat.identificador != null
        ? String(flat.identificador)
        : null;

  const madurador: MaduradorReference = {
    identificador_empresa: iden,
    fecha_inicio: row.fecha_inicio != null ? String(row.fecha_inicio) : null,
    fecha_procesada: row.fecha_procesada != null ? String(row.fecha_procesada) : null,
    hasta: row.hasta != null ? String(row.hasta) : null,
    ultima_fecha_encendido: row.ultima_fecha_encendido != null ? String(row.ultima_fecha_encendido) : null,
    last_sample_fecha: flat.fecha != null ? String(flat.fecha) : null,
    power_state_label: power_state === 1 ? 'Encendido' : 'Apagado',
    set_point_co2_display: displayScalar(flat.set_point_co2),
    line_voltage_display: voltSane != null ? voltSane : displayScalar(flat.line_voltage),
    avl_display: displayScalar(flat.avl),
    compress_coil_1_display: coilCompressDisplay(row, flat),
    ventilation_fan_reference_pct: fanRefPct,
    humidity_set_point,
    capacity_load: capLoad,
  };

  return {
    id: imei,
    name,
    status,
    estado_conexion: status === 'offline' ? 'offline' : mins > 30 ? 'wait' : 'online',
    last_seen: lastSeen,
    telemetry,
    operational,
    process:
      row.fecha_inicio != null
        ? {
            name: 'Proceso madurador',
            progress: 50,
            startTime: String(row.fecha_inicio),
            endTime: lastSeen,
            currentPhase: 'Maduración',
          }
        : undefined,
    madurador,
  };
}

export async function fetchMaduradorDevicesFromApi(): Promise<Device[]> {
  const root = RIPENER_API_URL.replace(/\/$/, '');
  const res = await fetch(`${root}/api/v1/madurador/dispositivos`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`madurador: ${res.status}`);
  const body = (await res.json()) as { data?: unknown };
  const raw = Array.isArray(body.data) ? body.data : [];
  return raw.map((r) => mapMaduradorRowToDevice(r as Record<string, unknown>));
}

export async function getMaduradorDevicesCached(): Promise<Device[]> {
  const now = Date.now();
  const { list, at } = getMaduradorListCache();
  if (list && now - at < MADURADOR_LIST_TTL_MS) {
    return list;
  }
  const fresh = await fetchMaduradorDevicesFromApi();
  setMaduradorListCache(fresh, now);
  return fresh;
}

export function buildMaduradorHistoryFromDevice(
  device: Device,
  options: { fecha_inicio?: string; fecha_fin?: string }
): HistoryPoint[] {
  const now = Date.now();
  const end = options.fecha_fin ? new Date(options.fecha_fin).getTime() : now;
  const start = options.fecha_inicio ? new Date(options.fecha_inicio).getTime() : end - 12 * 60 * 60 * 1000;
  const tel = device.telemetry;
  const op = device.operational;
  const md = device.madurador;
  const step = Math.max((end - start) / 36, 60_000);
  const pts: HistoryPoint[] = [];

  const avlNum = typeof md?.avl_display === 'number' ? md.avl_display : toNum(md?.avl_display);
  const avl_pct = fanPctFromAvl(avlNum);
  const spCo2 = typeof md?.set_point_co2_display === 'number' ? md.set_point_co2_display : toNum(md?.set_point_co2_display);
  const compress =
    typeof md?.compress_coil_1_display === 'number'
      ? md.compress_coil_1_display
      : toNum(md?.compress_coil_1_display) ?? 0;
  const lineV =
    typeof md?.line_voltage_display === 'number'
      ? md.line_voltage_display
      : toNum(md?.line_voltage_display) ?? 0;
  const cap = md?.capacity_load ?? 0;

  for (let t = start; t <= end; t += step) {
    pts.push({
      timestamp: new Date(t).toISOString(),
      temp_supply_1: tel.temp_supply_1,
      return_air: tel.return_air,
      evaporation_coil: op.evaporation_coil,
      condensation_coil: op.condensation_coil,
      compress_coil_1: compress,
      ambient_air: op.ambient_air,
      cargo_1_temp: null,
      cargo_2_temp: null,
      cargo_3_temp: null,
      cargo_4_temp: null,
      relative_humidity: tel.relative_humidity,
      avl_pct,
      line_voltage: lineV,
      line_frequency: 60,
      co2_reading: tel.co2_reading,
      o2_reading: null,
      set_point: tel.set_point,
      capacity_load: cap,
      power_state: tel.power_state,
      humidity_set_point: md?.humidity_set_point ?? 0,
      set_point_o2: null,
      set_point_co2: spCo2,
      sp_ethyleno: 0,
      ethylene: tel.ethylene,
      iCtrlRip: 0,
      power_kwh: op.power_kwh,
    });
  }
  return pts;
}

export function formatMaduradorScalar(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && !Number.isFinite(value)) return '—';
  return String(value);
}
