import type {
  Device,
  MaduradorHistorialTramo,
  MaduradorOperativoSummary,
  MaduradorReference,
  OperationalData,
  TelemetryData,
} from '@/app/data';
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

/** Fecha en API: ISO string o `{ $date: "..." }`. */
export function parseMaduradorMongoDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'object' && v !== null && '$date' in v) {
    const d = (v as { $date?: unknown }).$date;
    if (typeof d === 'string' && d.trim()) return d.trim();
  }
  return null;
}

/** Pestaña del Panel de control según `telemetry.stateProcess`. */
export function controlPanelTabFromStateProcess(sp: TelemetryData['stateProcess']): string {
  switch (sp) {
    case 'Homogenization':
      return 'homogenization';
    case 'Ripening':
      return 'ripening';
    case 'Ventilation':
      return 'ventilation';
    case 'Cooling':
      return 'cooling';
    case 'Integral':
      return 'manual';
    default:
      return 'manual';
  }
}

export function isManualProcesoLabel(raw: string | null | undefined): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'manual';
}

function computeMaduradorProcessProgress(row: Record<string, unknown>, isManual: boolean): number {
  if (isManual) return 0;
  const fi = row.fecha_inicio ? new Date(String(row.fecha_inicio)).getTime() : NaN;
  const h = row.hasta ? new Date(String(row.hasta)).getTime() : NaN;
  const now = Date.now();
  if (Number.isFinite(fi) && Number.isFinite(h) && h > fi) {
    const p = ((now - fi) / (h - fi)) * 100;
    return Math.max(0, Math.min(100, Math.round(p)));
  }
  return 50;
}

function formatProcessTimeLeft(row: Record<string, unknown>): string | undefined {
  const h = row.hasta ? new Date(String(row.hasta)).getTime() : NaN;
  if (!Number.isFinite(h)) return undefined;
  const ms = h - Date.now();
  if (ms <= 0) return '0 min';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 72) return `${Math.floor(hours / 24)} d`;
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${mins} min`;
}

function procesoToStateProcess(procesoRaw: unknown): TelemetryData['stateProcess'] {
  const p = String(procesoRaw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (p.includes('homogen')) return 'Homogenization';
  if (p.includes('madur')) return 'Ripening';
  if (p.includes('ventil')) return 'Ventilation';
  if (p.includes('cool')) return 'Cooling';
  if (p.includes('automatic')) return 'Integral';
  return 'None';
}

export function extractMaduradorOperativoSummary(row: Record<string, unknown>): MaduradorOperativoSummary {
  const fam = row.fresh_air_ex_mode;
  let modo = 0;
  if (fam != null && typeof fam === 'object' && !Array.isArray(fam) && 'modo_actual' in fam) {
    modo = Number((fam as { modo_actual?: unknown }).modo_actual) || 0;
  } else {
    modo = Number(fam) || 0;
  }
  const modoVentilacionLabel =
    modo === 0 ? 'Desactivado' : modo === 1 ? 'Manual' : modo === 2 ? 'Automático' : `Código ${modo}`;

  const cc = row.compress_coil_1;
  const compressCoilHealth =
    cc != null && typeof cc === 'object' && !Array.isArray(cc) && ('estado' in cc || 'valor_actual' in cc)
      ? (cc as Record<string, unknown>)
      : null;

  const asTramos = (x: unknown): MaduradorHistorialTramo[] | undefined =>
    Array.isArray(x) ? (x as MaduradorHistorialTramo[]) : undefined;

  return {
    historial_sp_etileno: asTramos(row.historial_sp_etileno),
    ultima_fecha_apagado: row.ultima_fecha_apagado != null ? String(row.ultima_fecha_apagado) : null,
    modoVentilacion: modo,
    modoVentilacionLabel,
    alarmas: row.alarmas,
    compressCoilHealth,
    historico_set_point: asTramos(row.historico_set_point),
    historial_humidity_set_point: asTramos(row.historial_humidity_set_point),
    historial_set_point_co2: asTramos(row.historial_set_point_co2),
    historial_power_state: asTramos(row.historial_power_state),
  };
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

  const imei = String(flat.imei ?? row.imei ?? 'unknown').trim() || 'unknown';
  const name = String(flat.device ?? row.device ?? imei);

  const lastSample =
    parseMaduradorMongoDate(flat.fecha) ??
    (flat.fecha != null && typeof flat.fecha === 'string' ? String(flat.fecha) : null) ??
    (row.hasta != null ? String(row.hasta) : null) ??
    (row.fecha_procesada != null ? String(row.fecha_procesada) : null) ??
    new Date().toISOString();
  const lastSeen = lastSample;

  const stateProcess = procesoToStateProcess(row.proceso);

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
    stateProcess,
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

  const lastSampleDisplay =
    parseMaduradorMongoDate(flat.fecha) ??
    (flat.fecha != null && typeof flat.fecha !== 'object' ? String(flat.fecha) : null);

  const c1 = inRange(toNum(flat.cargo_1_temp), -40, 100);
  const c2 = inRange(toNum(flat.cargo_2_temp), -40, 100);
  const c3 = inRange(toNum(flat.cargo_3_temp), -40, 100);
  const c4 = inRange(toNum(flat.cargo_4_temp), -40, 100);
  const compTemp = inRange(toNum(flat.compress_coil_1), -60, 200);
  const spCo2Num = inRange(toNum(flat.set_point_co2), 0, 100);
  const spEti = inRange(toNum(flat.sp_ethyleno), 0, 1e4);

  const madurador: MaduradorReference = {
    identificador_empresa: iden,
    fecha_inicio: row.fecha_inicio != null ? String(row.fecha_inicio) : null,
    fecha_procesada: row.fecha_procesada != null ? String(row.fecha_procesada) : null,
    hasta: row.hasta != null ? String(row.hasta) : null,
    ultima_fecha_encendido: row.ultima_fecha_encendido != null ? String(row.ultima_fecha_encendido) : null,
    last_sample_fecha: lastSampleDisplay,
    power_state_label: power_state === 1 ? 'Encendido' : 'Apagado',
    set_point_co2_display: displayScalar(flat.set_point_co2),
    line_voltage_display: voltSane != null ? voltSane : displayScalar(flat.line_voltage),
    avl_display: displayScalar(flat.avl),
    compress_coil_1_display: coilCompressDisplay(row, flat),
    ventilation_fan_reference_pct: fanRefPct,
    humidity_set_point,
    capacity_load: capLoad,
    cargo_1_temp: c1,
    cargo_2_temp: c2,
    cargo_3_temp: c3,
    cargo_4_temp: c4,
    line_frequency: inRange(toNum(flat.line_frequency), 0, 100),
    consumption_ph_1: toNum(flat.consumption_ph_1),
    consumption_ph_2: toNum(flat.consumption_ph_2),
    consumption_ph_3: toNum(flat.consumption_ph_3),
    set_point_co2_value: spCo2Num,
    sp_ethyleno: spEti,
    avl_raw: avlRaw,
    compress_coil_1_temp: compTemp,
  };

  const procesoRaw = row.proceso != null ? String(row.proceso) : '';
  const procesoLabel = procesoRaw || 'Proceso';
  const isManual = isManualProcesoLabel(procesoRaw);
  const idProcesoVal = toNum(row.id_proceso);
  const numAlRounded = Math.max(0, Math.round(numAl ?? 0));

  const maduradorSummary = extractMaduradorOperativoSummary(row);

  const endProcess = row.hasta != null ? String(row.hasta) : lastSeen;

  return {
    id: imei,
    nombreApi: name,
    name,
    status,
    estado_conexion: status === 'offline' ? 'offline' : mins > 30 ? 'wait' : 'online',
    last_seen: lastSeen,
    telemetry,
    operational,
    procesoApi: procesoRaw || null,
    idProcesoApi: idProcesoVal,
    numeroAlarmaTotal: numAlRounded,
    process:
      row.fecha_inicio != null
        ? {
            name: procesoLabel,
            progress: computeMaduradorProcessProgress(row, isManual),
            startTime: String(row.fecha_inicio),
            endTime: endProcess,
            currentPhase: procesoLabel,
            timeLeft: formatProcessTimeLeft(row),
            showProgressBar: !isManual,
          }
        : undefined,
    madurador,
    maduradorSummary,
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
