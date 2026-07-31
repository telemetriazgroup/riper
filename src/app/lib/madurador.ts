import type {
  Device,
  MaduradorHistorialTramo,
  MaduradorOperativoSummary,
  MaduradorReference,
  OperationalData,
  TelemetryData,
} from '@/app/data';
import type { HistoryPoint, FetchHistoryOptions } from '@/app/lib/api';
import { MADURADOR_DEMO_API_URL, RIPENER_API_URL } from '@/app/config';
import { authHeaders, getStoredUser } from '@/app/lib/auth';
import {
  isFleetDemoSession,
  isDemoMaduradorSession,
  isUltraorganicsSession,
  getUltraorganicsPanelImeis,
  getThermoKingPinnedImei,
  isThermoKingSession,
  isGreenyardSession,
  getGreenyardPinnedImeis,
} from '@/app/lib/fleetDemo';
import { holdCriticalTempsAgainstZeroGlitch } from '@/app/lib/telemetrySanity';
import { isGourmetSession, isGourmetMaduradorFleetSession } from '@/app/lib/gourmet';
import { getGourmetMaduradorFleetImeis } from '@/app/lib/gourmetTunnelFleet';
import { getMaduradorListCache, MADURADOR_LIST_TTL_MS, setMaduradorListCache } from '@/app/lib/maduradorCache';
import {
  SIM_FLEET_AVL_MAX_CFM,
  appendSimulatedInkapackingDevices,
  buildSimulatedHistoryPoints,
  buildSimulatedInkapackingDeviceList,
  isSimulatedInkapackingDevice,
  shouldShowSimulatedInkapackingFleet,
} from '@/app/lib/simulatedInkapackingFleet';
import { resolvePowerState } from '@/app/lib/powerState';
import { FLEET_ALARM_RED_MIN_COUNT } from '@/app/lib/fleetKpi';
import { formatUiDecimal } from '@/app/lib/formatUiNumber';
import {
  connectionStateFromAgeMinutes,
  maduradorServerTimestampToIso,
  maduradorServerTimestampToMs,
  minutesSinceUtcMs,
} from '@/app/lib/maduradorTimestamps';

export type MaduradorRangoFetchOptions = FetchHistoryOptions & {
  /** Incluye filas crudos `datos[]` para métricas (avl CFM, fresh_air_ex_mode). */
  includeRawDatos?: boolean;
};

/** Incluye superadmin: usa GET /madurador/dispositivos sin necesidad de `identificador` en perfil. */
export function isMaduradorSuperadminFullList(): boolean {
  return getStoredUser()?.role === 'superadmin';
}

export function hasMaduradorIdentificador(): boolean {
  if (isMaduradorSuperadminFullList()) return true;
  const id = getStoredUser()?.identificador?.trim();
  return Boolean(id);
}

/** Cuentas demo que cargan dispositivos vía GET /api/v1/madurador/dispositivos (aunque identificador falte en JWT). */
export function shouldUseMaduradorDispositivosApi(): boolean {
  return (
    hasMaduradorIdentificador() ||
    isUltraorganicsSession() ||
    isGreenyardSession() ||
    isFleetDemoSession() ||
    isDemoMaduradorSession() ||
    (isGourmetSession() && isGourmetMaduradorFleetSession())
  );
}

/**
 * La API puede devolver varios IMEI bajo un mismo identificador (p. ej. MEX1001 y MEX1002).
 * Se deja en pantalla el equipo cuyo IMEI termina con el identificador (1001 → …1001, 2001 → …2001).
 * Si ninguno coincide, se asume otro esquema de nombres (legacy) y no se descarta nada.
 */
export function filterDevicesToIdentificadorImeiSuffix(
  devices: Device[],
  identificador: string | null | undefined
): Device[] {
  const id = String(identificador ?? '').trim();
  if (!id || !devices.length) return devices;
  const kept = devices.filter((d) => String(d.id ?? '').trim().endsWith(id));
  if (kept.length === 0) return devices;
  return kept;
}

/** Panel ULTRAORGANICS: solo MEX1001, MEX2001, MEX3001 (orden fijo). */
export function filterDevicesToUltraorganicsPanel(devices: Device[]): Device[] {
  const byId = new Map(devices.map((d) => [String(d.id).trim(), d]));
  return getUltraorganicsPanelImeis()
    .map((id) => byId.get(id))
    .filter((d): d is Device => Boolean(d));
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

/** Fecha en API: ISO string o `{ $date: "..." }`. Para antigüedad/conexión usar `maduradorServerTimestampToMs`. */
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

/** Pestaña según tipo de sesión activa en panel (Homogenization, Ripening, …). */
export function controlPanelTabFromProcessType(processType: string | null | undefined): string {
  switch (String(processType ?? '').trim()) {
    case 'Homogenization':
      return 'homogenization';
    case 'Ripening':
      return 'ripening';
    case 'Ventilation':
      return 'ventilation';
    case 'Cooling':
      return 'cooling';
    default:
      return 'manual';
  }
}

/** Pestaña según `procesoApi` del madurador (proceso en curso en el equipo). */
export function controlPanelTabFromProcesoApi(procesoApi: string | null | undefined): string | null {
  const raw = String(procesoApi ?? '').trim();
  if (!raw || isManualProcesoLabel(raw)) return null;
  const p = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (p.includes('homogen') || p.includes('homog')) return 'homogenization';
  if (p.includes('ventil') || p.includes('ventilacion')) return 'ventilation';
  if (p.includes('madur') || p.includes('ripen') || p.includes('maturation')) return 'ripening';
  if (p.includes('enfri') || p.includes('cool') || p.includes('refrig') || p.includes('frio')) return 'cooling';
  if (p.includes('integral') || p.includes('automatic')) return 'manual';
  return null;
}

/** Prioridad: sesión panel activa → procesoApi → stateProcess telemetría. */
export function resolveControlPanelTab(opts: {
  activeSessionProcessType?: string | null;
  procesoApi?: string | null;
  stateProcess?: TelemetryData['stateProcess'];
}): string {
  if (opts.activeSessionProcessType) {
    const fromSession = controlPanelTabFromProcessType(opts.activeSessionProcessType);
    if (fromSession !== 'manual' || opts.activeSessionProcessType === 'StopPlan') {
      return fromSession;
    }
  }
  const fromApi = controlPanelTabFromProcesoApi(opts.procesoApi);
  if (fromApi) return fromApi;
  return controlPanelTabFromStateProcess(opts.stateProcess ?? 'Manual');
}

export function isManualProcesoLabel(raw: string | null | undefined): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'manual';
}

function computeMaduradorProcessProgress(row: Record<string, unknown>, isManual: boolean): number {
  if (isManual) return 0;
  const fi = maduradorServerTimestampToMs(row.fecha_inicio) ?? NaN;
  const h = maduradorServerTimestampToMs(row.hasta) ?? NaN;
  const now = Date.now();
  if (Number.isFinite(fi) && Number.isFinite(h) && h > fi) {
    const p = ((now - fi) / (h - fi)) * 100;
    return Math.max(0, Math.min(100, Math.round(p)));
  }
  return 50;
}

function formatProcessTimeLeft(row: Record<string, unknown>): string | undefined {
  const h = maduradorServerTimestampToMs(row.hasta) ?? NaN;
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
  const historialSpEtileno: MaduradorHistorialTramo[] =
    asTramos(row.historial_sp_etileno) ?? ([] as MaduradorHistorialTramo[]);

  return {
    historial_sp_etileno: historialSpEtileno,
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

function fanPctForSimFleetCfm(avlCfm: number | null): number {
  if (avlCfm == null || !Number.isFinite(avlCfm) || avlCfm <= 0) return 0;
  return Math.min(100, Math.round((avlCfm / SIM_FLEET_AVL_MAX_CFM) * 100));
}

export function mapMaduradorRowToDevice(row: Record<string, unknown>): Device {
  const flat = flatMaduradorRow(row);

  const imei = String(flat.imei ?? row.imei ?? 'unknown').trim() || 'unknown';
  const name = String(flat.device ?? row.device ?? imei);

  const lastSampleRaw =
    flat.fecha ??
    row.hasta ??
    row.fecha_procesada ??
    null;
  const lastSeenMs =
    maduradorServerTimestampToMs(flat.fecha) ??
    maduradorServerTimestampToMs(row.hasta) ??
    maduradorServerTimestampToMs(row.fecha_procesada) ??
    null;
  const lastSeen =
    lastSeenMs != null
      ? new Date(lastSeenMs).toISOString()
      : maduradorServerTimestampToIso(lastSampleRaw) ?? new Date().toISOString();

  const procesoRaw = row.proceso != null ? String(row.proceso).trim() : '';
  const isManualProceso = !procesoRaw || isManualProcesoLabel(procesoRaw);
  const stateProcess = procesoToStateProcess(procesoRaw || 'Manual');

  const mins = lastSeenMs != null ? minutesSinceUtcMs(lastSeenMs) : 9999;

  let status: Device['status'] = 'active';
  const connBase = connectionStateFromAgeMinutes(mins);
  status = connBase.status;

  const alarmas = row.alarmas as { numero_alarma?: unknown; activas?: unknown[] } | undefined;
  const nAct = Array.isArray(alarmas?.activas) ? alarmas!.activas!.length : 0;
  const numAl = toNum(alarmas?.numero_alarma ?? flat.numero_alarma);
  const alertCount = Math.max(nAct, Math.max(0, Math.round(numAl ?? 0)));
  if (alertCount >= FLEET_ALARM_RED_MIN_COUNT) status = 'alarm';

  const rawPs = toNum(flat.power_state ?? row.ultimo_power_state);
  const power_state = resolvePowerState(flat, rawPs);

  const setPointNested = nestedValor(row.set_point);
  const set_point_raw = inRange(
    toNum(flat.set_point) ?? setPointNested ?? nestedValor(flat.set_point),
    -40,
    40
  );
  const temp_supply_raw = inRange(
    toNum(flat.temp_supply_1) ?? nestedValor(flat.temp_supply_1) ?? nestedValor(row.temp_supply_1),
    -40,
    120
  );
  const return_air_raw = inRange(
    toNum(flat.return_air) ?? nestedValor(flat.return_air) ?? nestedValor(row.return_air),
    -40,
    120
  );
  const evap_raw = inRange(
    toNum(flat.evaporation_coil) ??
      nestedValor(flat.evaporation_coil) ??
      nestedValor(row.evaporation_coil),
    -60,
    80
  );

  const held = holdCriticalTempsAgainstZeroGlitch(imei, {
    set_point: set_point_raw,
    temp_supply_1: temp_supply_raw,
    return_air: return_air_raw,
    evaporation_coil: evap_raw,
  });

  // Glitch all-cero sin hold: NaN → la tarjeta muestra "—" (no 0 engañoso).
  const set_point = held.glitch && !held.usedHold ? 0 : (held.set_point ?? 18);
  const temp_supply_1 =
    held.glitch && !held.usedHold ? Number.NaN : (held.temp_supply_1 ?? 0);
  const return_air = held.glitch && !held.usedHold ? Number.NaN : (held.return_air ?? 0);
  const evap = held.glitch && !held.usedHold ? 0 : (held.evaporation_coil ?? 0);

  const humiditySpNested = nestedValor(row.humidity_set_point);
  const humidity_set_point = inRange(toNum(flat.humidity_set_point ?? humiditySpNested), 0, 100);

  const relHum = sanitizeHumidity(flat.relative_humidity);
  const humidityVal = relHum ?? 0;

  const ethylene = inRange(toNum(flat.campo_1), 0, 500);
  const co2 = inRange(toNum(flat.co2_reading), 0, 100);
  const o2 = inRange(toNum(flat.o2_reading), 0, 100);
  const cond = inRange(toNum(flat.condensation_coil), -20, 90) ?? 0;
  const amb = inRange(toNum(flat.ambient_air), -40, 60) ?? 0;

  const avlRaw = toNum(flat.avl);
  const fanRefPct = isSimulatedInkapackingDevice(imei) ? fanPctForSimFleetCfm(avlRaw) : fanPctFromAvl(avlRaw);

  const voltSane = inRange(toNum(flat.line_voltage), 90, 600);
  const batt = inRange(toNum(flat.battery_voltage), 0, 32);

  const capLoad = inRange(toNum(flat.capacity_load), 0, 100);

  const telemetry: TelemetryData = {
    temp_supply_1,
    return_air,
    relative_humidity: humidityVal,
    ethylene,
    co2_reading: co2,
    o2_reading: o2,
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
    maduradorServerTimestampToIso(flat.fecha) ??
    parseMaduradorMongoDate(flat.fecha) ??
    (flat.fecha != null && typeof flat.fecha !== 'object' ? String(flat.fecha) : null);

  const c1 = inRange(toNum(flat.cargo_1_temp), -40, 100);
  const c2 = inRange(toNum(flat.cargo_2_temp), -40, 100);
  const c3 = inRange(toNum(flat.cargo_3_temp), -40, 100);
  const c4 = inRange(toNum(flat.cargo_4_temp), -40, 100);
  const compTemp = inRange(toNum(flat.compress_coil_1), -60, 200);
  const spCo2Num = inRange(toNum(flat.set_point_co2), 0, 100);
  const hasSpEtilenoField =
    Object.prototype.hasOwnProperty.call(flat, 'sp_ethyleno') ||
    Object.prototype.hasOwnProperty.call(row, 'sp_ethyleno');
  const spEti = hasSpEtilenoField ? inRange(toNum(flat.sp_ethyleno ?? row.sp_ethyleno), 0, 1e4) : null;

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

  const procesoLabel = procesoRaw || 'Manual';
  const isManual = isManualProceso;
  const hasIdProcesoField =
    Object.prototype.hasOwnProperty.call(row, 'id_proceso') ||
    Object.prototype.hasOwnProperty.call(flat, 'id_proceso');
  const idProcesoVal = hasIdProcesoField ? toNum(flat.id_proceso !== undefined ? flat.id_proceso : row.id_proceso) : null;
  const numAlRounded = alertCount;

  const maduradorSummary = extractMaduradorOperativoSummary(row);

  const processStartIso =
    maduradorServerTimestampToIso(row.fecha_inicio) ??
    maduradorServerTimestampToIso(row.fecha_procesada) ??
    maduradorServerTimestampToIso(flat.fecha) ??
    lastSeen;
  const processEndIso = maduradorServerTimestampToIso(row.hasta) ?? lastSeen;

  const hasProcessInfo =
    isManual || row.fecha_inicio != null || Boolean(procesoRaw);

  return {
    id: imei,
    nombreApi: name,
    name,
    status,
    estado_conexion: connBase.estado_conexion,
    last_seen: lastSeen,
    telemetry,
    operational,
    procesoApi: procesoRaw || 'Manual',
    idProcesoApi: idProcesoVal,
    numeroAlarmaTotal: numAlRounded,
    process: hasProcessInfo
      ? {
          name: procesoLabel,
          progress: computeMaduradorProcessProgress(row, isManual),
          startTime: isManual ? lastSeen : processStartIso,
          endTime: isManual ? lastSeen : processEndIso,
          currentPhase: procesoLabel,
          timeLeft: isManual ? undefined : formatProcessTimeLeft(row),
          showProgressBar: row.fecha_inicio != null && !isManual,
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
  const list: Device[] = [];
  for (const r of raw) {
    try {
      list.push(mapMaduradorRowToDevice(r as Record<string, unknown>));
    } catch (e) {
      console.warn('[madurador] map row failed', e);
    }
  }
  const withSim = appendSimulatedInkapackingDevices(list, mapMaduradorRowToDevice);
  if (isUltraorganicsSession()) {
    return filterDevicesToUltraorganicsPanel(withSim);
  }
  if (isThermoKingSession()) {
    const pin = getThermoKingPinnedImei();
    return withSim.filter((d) => String(d.id ?? '').trim() === pin);
  }
  if (isGourmetSession()) {
    const allow = new Set(getGourmetMaduradorFleetImeis());
    return withSim.filter((d) => allow.has(String(d.id ?? '').trim()));
  }
  /** Greenyard: solo IMEI pin NEWY2001 / NEWY1001 (servidor ya filtra; refuerzo en cliente). */
  if (isGreenyardSession()) {
    const allow = new Set(getGreenyardPinnedImeis());
    return withSim.filter((d) => allow.has(String(d.id ?? '').trim()));
  }
  /** Demo Madurador / superadmin: lista ya fusionada en API (6001+7001, etc.) sin filtro por sufijo. */
  if (isDemoMaduradorSession() || isMaduradorSuperadminFullList()) {
    return withSim;
  }
  return filterDevicesToIdentificadorImeiSuffix(withSim, getStoredUser()?.identificador);
}

export async function getMaduradorDevicesCached(): Promise<Device[]> {
  const now = Date.now();
  const { list, at } = getMaduradorListCache();
  if (list && now - at < MADURADOR_LIST_TTL_MS) {
    return list;
  }
  try {
    const fresh = await fetchMaduradorDevicesFromApi();
    setMaduradorListCache(fresh, now);
    return fresh;
  } catch (e) {
    if (list?.length) {
      console.warn('[madurador] refresh failed, using stale cache', e);
      return list;
    }
    if (shouldShowSimulatedInkapackingFleet()) {
      const simOnly = buildSimulatedInkapackingDeviceList(mapMaduradorRowToDevice);
      if (simOnly.length) {
        console.warn('[madurador] refresh failed, using sim fleet only', e);
        setMaduradorListCache(simOnly, now);
        return simOnly;
      }
    }
    throw e;
  }
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
  const avlRawForSim = typeof md?.avl_raw === 'number' ? md.avl_raw : avlNum;
  const avl_pct = isSimulatedInkapackingDevice(device.id)
    ? fanPctForSimFleetCfm(avlRawForSim)
    : fanPctFromAvl(avlNum);
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
      avl_raw:
        avlRawForSim != null && Number.isFinite(avlRawForSim)
          ? avlRawForSim
          : avlNum != null && Number.isFinite(avlNum)
            ? avlNum
            : null,
      avl_pct,
      line_voltage: lineV,
      line_frequency: 60,
        co2_reading: tel.co2_reading,
        o2_reading: tel.o2_reading ?? null,
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

function maduradorDemoApiBase(): string {
  return MADURADOR_DEMO_API_URL.replace(/\/$/, '');
}

/**
 * Fechas en query de `buscar_datos_madurador_rango` (misma forma que en historial y URLs como
 * `...&fecha_inicio=2026-04-26T10:12:12&fecha_fin=...`).
 */
function formatMaduradorRangoParam(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Query Madurador: instante civil en America/Lima (GMT-5, ej. Perú). */
export function formatMaduradorRangoParamAmericaLima(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const y = map.year ?? '';
  const mo = pad(Number(map.month ?? 1));
  const da = pad(Number(map.day ?? 1));
  const h = pad(Number(map.hour ?? 0));
  const mi = pad(Number(map.minute ?? 0));
  const s = pad(Number(map.second ?? 0));
  return `${y}-${mo}-${da}T${h}:${mi}:${s}`;
}

function extractRangoDatos(row: Record<string, unknown>): { cantidad_datos: number; datos: Record<string, unknown>[] } {
  const rawList = row.datos;
  const datos = Array.isArray(rawList) ? (rawList as Record<string, unknown>[]) : [];
  const nRaw = toNum(row.cantidad_datos);
  const cantidad_datos =
    nRaw != null && Number.isFinite(nRaw)
      ? Math.max(0, Math.round(nRaw))
      : datos.length;
  return { cantidad_datos, datos };
}

function parseBuscarDatosRangoJson(json: unknown): { cantidad_datos: number; datos: Record<string, unknown>[] } {
  if (Array.isArray(json) && json.length > 0) {
    const first = json[0];
    if (first && typeof first === 'object' && !Array.isArray(first) && 'datos' in first) {
      return extractRangoDatos(first as Record<string, unknown>);
    }
    const asRows = json.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
    if (asRows.length && (Object.prototype.hasOwnProperty.call(asRows[0], 'fecha') || Object.prototype.hasOwnProperty.call(asRows[0], 'return_air'))) {
      return { cantidad_datos: asRows.length, datos: asRows };
    }
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return extractRangoDatos(first as Record<string, unknown>);
    }
  }
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    return extractRangoDatos(json as Record<string, unknown>);
  }
  return { cantidad_datos: 0, datos: [] };
}

/**
 * Convierte una muestra de `datos[]` (buscar_datos_madurador_rango) a `HistoryPoint`.
 * Temperatura de la serie: `return_air`; etileno: `campo_1` → `ethylene`.
 */
export function mapMaduradorDatoMuestraToHistoryPoint(row: Record<string, unknown>): HistoryPoint {
  const flat = flatMaduradorRow(row);
  const ts = maduradorServerTimestampToIso(flat.fecha) ?? new Date().toISOString();

  const return_air = inRange(toNum(flat.return_air), -40, 120) ?? 0;
  const temp_supply_1 = inRange(toNum(flat.temp_supply_1), -40, 120) ?? return_air;
  const rh = sanitizeHumidity(flat.relative_humidity) ?? 0;
  const eth = inRange(toNum(flat.campo_1 ?? flat.ethylene), 0, 500);
  const co2n = inRange(toNum(flat.co2_reading), 0, 100);

  const evap = inRange(toNum(flat.evaporation_coil), -60, 80) ?? 0;
  const cond = inRange(toNum(flat.condensation_coil), -20, 90) ?? 0;
  const amb = inRange(toNum(flat.ambient_air), -40, 60) ?? 0;
  const avlRaw = toNum(flat.avl);
  const avl_pct = fanPctFromAvl(avlRaw);
  const lineV = inRange(toNum(flat.line_voltage), 90, 600) ?? 0;
  const lf = inRange(toNum(flat.line_frequency), 0, 100) ?? 60;
  const cap = inRange(toNum(flat.capacity_load), 0, 100) ?? 0;
  const ps = toNum(flat.power_state);
  const power_state = resolvePowerState(flat, ps);
  const hsp = inRange(toNum(flat.humidity_set_point), 0, 100) ?? 0;
  const sp = inRange(toNum(flat.set_point), -40, 40) ?? 0;
  const spO2 = inRange(toNum(flat.set_point_o2), 0, 100);
  const spCo2 = inRange(toNum(flat.set_point_co2), 0, 100);
  const spEth = inRange(toNum(flat.sp_ethyleno), 0, 1e4) ?? 0;
  const o2 = inRange(toNum(flat.o2_reading), 0, 100);
  const inj = toNum(flat.iCtrlRip);

  return {
    timestamp: ts,
    temp_supply_1,
    return_air,
    evaporation_coil: evap,
    condensation_coil: cond,
    compress_coil_1: inRange(toNum(flat.compress_coil_1), -60, 200) ?? 0,
    ambient_air: amb,
    cargo_1_temp: inRange(toNum(flat.cargo_1_temp), -40, 100),
    cargo_2_temp: inRange(toNum(flat.cargo_2_temp), -40, 100),
    cargo_3_temp: inRange(toNum(flat.cargo_3_temp), -40, 100),
    cargo_4_temp: inRange(toNum(flat.cargo_4_temp), -40, 100),
    relative_humidity: rh,
    avl_raw: avlRaw != null && Number.isFinite(avlRaw) ? avlRaw : null,
    avl_pct,
    line_voltage: lineV,
    line_frequency: lf,
    co2_reading: co2n,
    o2_reading: o2,
    set_point: sp,
    capacity_load: cap,
    power_state,
    humidity_set_point: hsp,
    set_point_o2: spO2,
    set_point_co2: spCo2,
    sp_ethyleno: spEth,
    ethylene: eth,
    iCtrlRip: inj === 1 ? 1 : 0,
    power_kwh: inRange(toNum(flat.power_kwh), 0, 1e9) ?? 0,
  };
}

/**
 * GET `.../Madurador/buscar_datos_madurador_rango/?imei=…` (y opc. rango de fechas).
 * Si `cantidad_datos === 0` o `datos` vacío, devuelve `points: []` (vista: sin datos últimas 12h).
 */
export async function fetchMaduradorRangoHistoryForImei(
  imei: string,
  options: MaduradorRangoFetchOptions = {}
): Promise<{ cantidad_datos: number; points: HistoryPoint[]; rawDatos?: Record<string, unknown>[] }> {
  const imeiTrim = imei.trim();
  if (isSimulatedInkapackingDevice(imeiTrim) && shouldShowSimulatedInkapackingFleet()) {
    const now = Date.now();
    let fi = options.fecha_inicio;
    let ff = options.fecha_fin;
    if (!fi || !ff) {
      ff = new Date(now).toISOString();
      fi = new Date(now - 12 * 60 * 60 * 1000).toISOString();
    }
    const points = buildSimulatedHistoryPoints(imeiTrim, fi, ff);
    return {
      cantidad_datos: points.length,
      points,
      rawDatos: options.includeRawDatos ? [] : undefined,
    };
  }

  const base = maduradorDemoApiBase();
  const imeiQ = encodeURIComponent(imeiTrim);
  let url: string;
  const useLima = Boolean(options.maduradorAmericaLima);
  const fmt = useLima ? formatMaduradorRangoParamAmericaLima : formatMaduradorRangoParam;
  if (options.fecha_inicio && options.fecha_fin) {
    const a = new Date(options.fecha_inicio);
    const b = new Date(options.fecha_fin);
    if (Number.isFinite(a.getTime()) && Number.isFinite(b.getTime()) && b > a) {
      const params = new URLSearchParams();
      params.set('imei', imeiTrim);
      params.set('fecha_inicio', fmt(a));
      params.set('fecha_fin', fmt(b));
      url = `${base}/Madurador/buscar_datos_madurador_rango/?${params.toString()}`;
    } else {
      url = `${base}/Madurador/buscar_datos_madurador_rango/?imei=${imeiQ}`;
    }
  } else {
    /** Por defecto solo `imei` (misma URL que en documentación; el upstream suele servir ~últimas 12 h). */
    url = `${base}/Madurador/buscar_datos_madurador_rango/?imei=${imeiQ}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `madurador_rango: ${res.status}`);
  }
  const text = await res.text();
  if (!text.trim())
    return { cantidad_datos: 0, points: [], rawDatos: options.includeRawDatos ? [] : undefined };
  const json: unknown = JSON.parse(text);
  const { cantidad_datos, datos } = parseBuscarDatosRangoJson(json);
  if (cantidad_datos === 0 || !datos.length) {
    return { cantidad_datos, points: [], rawDatos: options.includeRawDatos ? [] : undefined };
  }
  const points = datos
    .map((row) => {
      try {
        return mapMaduradorDatoMuestraToHistoryPoint(row);
      } catch {
        return null;
      }
    })
    .filter((p): p is HistoryPoint => p != null);
  points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return {
    cantidad_datos,
    points,
    rawDatos: options.includeRawDatos ? datos : undefined,
  };
}

/** Úsese historial real por rango si aplica (flota demo, identificador Madurador, ULTRAORGANICS). */
export function shouldUseMaduradorRangoHistory(): boolean {
  return (
    isFleetDemoSession() ||
    isDemoMaduradorSession() ||
    hasMaduradorIdentificador() ||
    isUltraorganicsSession() ||
    isThermoKingSession() ||
    isGreenyardSession() ||
    isGourmetSession()
  );
}


export function formatMaduradorScalar(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && !Number.isFinite(value)) return '—';
  if (typeof value === 'number') return formatUiDecimal(value);
  return String(value);
}
