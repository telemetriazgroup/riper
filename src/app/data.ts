// Interface matching the RAW JSON provided by the API
export interface RawApiData {
  id: number;
  set_point: number;
  temp_supply_1: number;
  temp_supply_2: number | null;
  return_air: number;
  evaporation_coil: number;
  condensation_coil: number;
  compress_coil_1: number | null;
  compress_coil_2: number | null;
  ambient_air: number;
  cargo_1_temp: number | null;
  cargo_2_temp: number | null;
  cargo_3_temp: number | null;
  cargo_4_temp: number | null;
  relative_humidity: number;
  avl: number;
  suction_pressure: number;
  discharge_pressure: number;
  line_voltage: number;
  line_frequency: number;
  consumption_ph_1: number;
  consumption_ph_2: number;
  consumption_ph_3: number;
  co2_reading: number;
  o2_reading: number;
  evaporator_speed: number;
  condenser_speed: number;
  power_kwh: number;
  power_trip_reading: number;
  suction_temp: number;
  discharge_temp: number;
  supply_air_temp: number;
  return_air_temp: number;
  dl_battery_temp: number;
  dl_battery_charge: number;
  power_consumption: number;
  power_consumption_avg: number;
  alarm_present: number;
  capacity_load: number;
  power_state: number;
  controlling_mode: string;
  humidity_control: number;
  humidity_set_point: number;
  fresh_air_ex_mode: number;
  fresh_air_ex_rate: number;
  fresh_air_ex_delay: number;
  set_point_o2: number;
  set_point_co2: number;
  defrost_term_temp: number;
  defrost_interval: number;
  water_cooled_conde: number;
  usda_trip: number;
  evaporator_exp_valve: number;
  suction_mod_valve: number;
  hot_gas_valve: number;
  economizer_valve: number;
  ethylene: number;
  stateProcess: number;
  stateInyection: string;
  timerOfProcess: number;
  battery_voltage: number;
  power_trip_duration: number;
  modelo: string;
  latitud: number;
  longitud: number;
  created_at: {
    $date: string;
  };
  telemetria_id: number;
  inyeccion_etileno: number;
  defrost_prueba: number;
  ripener_prueba: number;
  sp_ethyleno: number;
  inyeccion_hora: number;
  inyeccion_pwm: number;
  extra_1: number;
  extra_2: number;
  extra_3: number;
  extra_4: number;
  extra_5: number;
  imei: string;
  tiempo_paso: string;
  device: string;
}

// Existing Interfaces adapted
export interface TelemetryData {
  temp_supply_1: number;
  return_air: number;
  relative_humidity: number;
  ethylene: number | null;
  co2_reading: number | null;
  set_point: number;
  stateProcess: 'None' | 'Homogenization' | 'Ripening' | 'Ventilation' | 'Cooling' | 'Integral';
  power_state: 0 | 1;
  alarm_present: 0 | 1;
}

export interface OperationalData {
  evaporation_coil: number;
  condensation_coil: number;
  ambient_air: number;
  power_consumption: number;
  power_kwh: number;
  battery_voltage: number;
  defrost_interval: number;
  fresh_air_ex_mode: number;
}

export interface Device {
  id: string;
  name: string;
  status: 'active' | 'warning' | 'alarm' | 'offline';
  /** Estado de conexión de la API: online | wait | offline */
  estado_conexion?: string;
  last_seen: string;
  telemetry: TelemetryData;
  operational: OperationalData;
  process?: {
    name: string;
    progress: number;
    startTime: string;
    endTime: string;
    currentPhase?: string;
    timeLeft?: string;
  };
}

// --- TermoKing API (estado_general) ---
export interface TermoKingUltimoValor {
  valor: number;
  fecha: string | null;
  batch_id: string | null;
}

export interface TermoKingDispositivo {
  imei: string;
  descripcion: string;
  estado_conexion: string;
  ultimo_dato_recibido: string | null;
  minutos_desde_ultimo_dato?: number | null;
  proceso_activo?: boolean;
  power_state_texto?: string;
  en_rango?: boolean;
  ultimo_set_point?: TermoKingUltimoValor | null;
  ultimo_temp_supply?: TermoKingUltimoValor | null;
  ultimo_return_air?: TermoKingUltimoValor | null;
  ultimo_relative_humidity?: TermoKingUltimoValor | null;
  ultimo_co2_reading?: TermoKingUltimoValor | null;
  ultimo_ethylene?: TermoKingUltimoValor | null;
  ultimo_encendido?: { fecha: string | null; batch_id: string | null };
  ultimo_apagado?: { fecha: string | null; batch_id: string | null };
  ultimo_batch_id?: string | null;
}

export interface TermoKingEstadoGeneralResponse {
  data?: {
    resumen?: Record<string, unknown>;
    dispositivos: TermoKingDispositivo[];
  };
  code?: number;
  message?: string;
}

// --- TermoKing API (historial) ---
export interface TermoKingTrama {
  fecha: string;
  temp_supply_1?: number | null;
  return_air?: number | null;
  relative_humidity?: number | null;
  co2_reading?: number | null;
  o2_reading?: number | null;
  ethylene?: number | null;
  sp_ethyleno?: number | null;
  supply_air_temp?: number | null;
  return_air_temp?: number | null;
  set_point?: number | null;
  evaporation_coil?: number | null;
  condensation_coil?: number | null;
  compress_coil_1?: number | null;
  ambient_air?: number | null;
  cargo_1_temp?: number | null;
  cargo_2_temp?: number | null;
  cargo_3_temp?: number | null;
  cargo_4_temp?: number | null;
  avl?: number | null;
  line_voltage?: number | null;
  line_frequency?: number | null;
  capacity_load?: number | null;
  power_state?: number | null;
  humidity_set_point?: number | null;
  set_point_o2?: number | null;
  set_point_co2?: number | null;
  iCtrlRip?: number | null;
  power_consumption?: number | null;
  power_kwh?: number | null;
}

export interface TermoKingHistorialResponse {
  data?: {
    imei: string;
    descripcion: string;
    fecha_inicio: string;
    fecha_fin: string;
    total_tramas: number;
    tramas: TermoKingTrama[];
  };
  code?: number;
  message?: string;
}

/** Mapea un dispositivo de estado_general a Device, con valores por defecto para campos faltantes. */
export function mapTermoKingDispositivoToDevice(d: TermoKingDispositivo): Device {
  const lastSeen = d.ultimo_dato_recibido ?? new Date().toISOString();
  const mins = d.minutos_desde_ultimo_dato ?? 999;
  let status: Device['status'] = 'active';
  if (d.estado_conexion === 'offline' || mins > 720) status = 'offline';
  else if (mins > 30 || d.estado_conexion === 'wait') status = 'warning';
  else if (d.en_rango === false) status = 'alarm';

  const powerState: 0 | 1 = (d.power_state_texto?.toLowerCase() === 'on') ? 1 : 0;
  const v = (x: TermoKingUltimoValor | null | undefined, def: number) =>
    x?.valor != null ? Number(x.valor) : def;

  return {
    id: d.imei,
    name: d.descripcion || d.imei || 'Dispositivo',
    status,
    estado_conexion: d.estado_conexion ?? (status === 'offline' ? 'offline' : status === 'warning' ? 'wait' : 'online'),
    last_seen: lastSeen,
    telemetry: {
      temp_supply_1: v(d.ultimo_temp_supply, 0),
      return_air: v(d.ultimo_return_air, 0),
      relative_humidity: v(d.ultimo_relative_humidity, 0),
      ethylene: v(d.ultimo_ethylene, 0) || null,
      co2_reading: v(d.ultimo_co2_reading, 0) || null,
      set_point: v(d.ultimo_set_point, 18),
      stateProcess: d.proceso_activo ? 'Ripening' : 'None',
      power_state: powerState,
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
    process: d.proceso_activo
      ? {
          name: 'Proceso activo',
          progress: 50,
          startTime: d.ultimo_encendido?.fecha ?? lastSeen,
          endTime: lastSeen,
          currentPhase: 'Maduración',
          timeLeft: '--',
        }
      : undefined,
  };
}

// Generator Helper
const generateRawHistory = (hours: number): RawApiData[] => {
  const data: RawApiData[] = [];
  const now = new Date();

  const devices = [
    { id: 'ZGRU5140001', mode: 'Homogenization', stateProcess: 1, name: 'Madurador 01' },
    { id: 'ZGRU5140002', mode: 'Ripening', stateProcess: 2, name: 'Madurador 02' },
    { id: 'ZGRU5140003', mode: 'Manual', stateProcess: 0, name: 'Madurador 03' },
    { id: 'ZGRU5140004', mode: 'Standby', stateProcess: 0, name: 'Madurador 04' },
    { id: 'ZGRU5140005', mode: 'Offline', stateProcess: 0, name: 'Madurador 05' },
  ];

  for (let h = 0; h < hours; h++) {
    const time = new Date(now.getTime() - (hours - 1 - h) * 3600000);
    
    devices.forEach((dev, idx) => {
      // Simulate specialized data based on device role
      let temp = 18;
      let humidity = 90;
      let ethylene = 0;
      let co2 = 0.5;
      let lastSeenTime = time;
      let powerState = 1;

      // Customize per device
      if (dev.mode === 'Homogenization') {
        temp = 18 + Math.sin(h/5) * 2; // Varying temp
        humidity = 95;
        ethylene = 10;
        co2 = 1.2;
      } else if (dev.mode === 'Ripening') {
        temp = 20;
        humidity = 98;
        ethylene = 150 + Math.random() * 10;
        co2 = 4.5;
      } else if (dev.mode === 'Standby') {
        temp = 10;
        humidity = 85;
        // Last seen logic is handled in "current state" extraction, but for history 
        // we can simulate gaps if needed. For now, continuous history.
      } else if (dev.mode === 'Offline') {
         // Offline device might have old data
         powerState = 0;
         temp = 0;
      }

      const entry: RawApiData = {
        id: 300000000 + idx * 1000 + h,
        device: dev.id,
        set_point: dev.mode === 'Ripening' ? 22 : 18,
        temp_supply_1: temp,
        temp_supply_2: null,
        return_air: temp + 0.5,
        evaporation_coil: temp - 0.2,
        condensation_coil: temp + 5,
        compress_coil_1: null,
        compress_coil_2: null,
        ambient_air: 20 + Math.random(),
        cargo_1_temp: temp,
        cargo_2_temp: temp,
        cargo_3_temp: temp,
        cargo_4_temp: temp,
        relative_humidity: humidity,
        avl: 0,
        suction_pressure: 401,
        discharge_pressure: 401,
        line_voltage: 460,
        line_frequency: 60,
        consumption_ph_1: 1.2,
        consumption_ph_2: 1.2,
        consumption_ph_3: 1.2,
        co2_reading: co2,
        o2_reading: 20.9,
        evaporator_speed: 0,
        condenser_speed: 0,
        power_kwh: 10000 + idx * 500 + h * 5,
        power_trip_reading: 0,
        suction_temp: 401,
        discharge_temp: 401,
        supply_air_temp: temp,
        return_air_temp: temp + 0.5,
        dl_battery_temp: 25,
        dl_battery_charge: 0,
        power_consumption: 0.5,
        power_consumption_avg: 0.5,
        alarm_present: 0,
        capacity_load: 0,
        power_state: powerState,
        controlling_mode: "0",
        humidity_control: 1,
        humidity_set_point: 90,
        fresh_air_ex_mode: 0,
        fresh_air_ex_rate: 0,
        fresh_air_ex_delay: 0,
        set_point_o2: 0,
        set_point_co2: 0,
        defrost_term_temp: 18,
        defrost_interval: 6,
        water_cooled_conde: 0,
        usda_trip: 0,
        evaporator_exp_valve: 255,
        suction_mod_valve: 255,
        hot_gas_valve: 255,
        economizer_valve: 255,
        ethylene: ethylene,
        stateProcess: dev.stateProcess,
        stateInyection: "0",
        timerOfProcess: 0,
        battery_voltage: 41,
        power_trip_duration: 0,
        modelo: "THERMOKING",
        latitud: -12.0,
        longitud: -77.0,
        created_at: { $date: lastSeenTime.toISOString() },
        telemetria_id: 1000 + idx,
        inyeccion_etileno: 0,
        defrost_prueba: 0,
        ripener_prueba: 0,
        sp_ethyleno: 0,
        inyeccion_hora: 0,
        inyeccion_pwm: 0,
        extra_1: 0,
        extra_2: 0,
        extra_3: 0,
        extra_4: 0,
        extra_5: 0,
        imei: "IMEI" + idx,
        tiempo_paso: "0",
      };
      
      data.push(entry);
    });
  }
  return data;
};

// Generate 26 hours of data for 5 devices
export const API_RESPONSE_MOCK = generateRawHistory(26);

// Mapper function
const mapRawToDevice = (raw: RawApiData, name: string, statusOverride?: string, processOverride?: any): Device => {
  const stateMap: Record<number, TelemetryData['stateProcess']> = {
    0: 'None', 1: 'Homogenization', 2: 'Ripening', 3: 'Ventilation', 4: 'Cooling'
  };

  // Determine status based on last seen if not overridden
  const lastSeen = new Date(raw.created_at.$date);
  const minsDiff = (new Date().getTime() - lastSeen.getTime()) / 60000;
  let status: Device['status'] = 'active';
  
  if (minsDiff > 720) status = 'offline';
  else if (minsDiff > 30) status = 'warning'; // Standby treated as warning visually often
  else if (raw.alarm_present) status = 'alarm';

  if (statusOverride) status = statusOverride as any;
  const estado_conexion = status === 'offline' ? 'offline' : status === 'warning' ? 'wait' : 'online';

  return {
    id: raw.device,
    name: name,
    status: status,
    estado_conexion,
    last_seen: raw.created_at.$date,
    telemetry: {
      temp_supply_1: raw.temp_supply_1,
      return_air: raw.return_air,
      relative_humidity: raw.relative_humidity === 401 ? 0 : raw.relative_humidity, // Fix 401
      ethylene: raw.ethylene,
      co2_reading: raw.co2_reading === 401 ? null : raw.co2_reading, // Fix 401
      set_point: raw.set_point,
      stateProcess: stateMap[raw.stateProcess] || 'None',
      power_state: raw.power_state as 0 | 1,
      alarm_present: raw.alarm_present as 0 | 1
    },
    operational: {
      evaporation_coil: raw.evaporation_coil,
      condensation_coil: raw.condensation_coil,
      ambient_air: raw.ambient_air,
      power_consumption: raw.power_consumption,
      power_kwh: raw.power_kwh,
      battery_voltage: raw.battery_voltage,
      defrost_interval: raw.defrost_interval,
      fresh_air_ex_mode: raw.fresh_air_ex_mode
    },
    process: processOverride
  };
};

// Create MOCK_DEVICES from the latest data points of API_RESPONSE_MOCK
const getLatest = (id: string) => API_RESPONSE_MOCK.filter(d => d.device === id).pop()!;
const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

export const MOCK_DEVICES: Device[] = [
  mapRawToDevice(getLatest('ZGRU5140001'), 'Madurador 01 (Homog)', 'active', {
    name: 'Mango Kent - Inicio',
    progress: 15,
    startTime: hoursAgo(4),
    endTime: hoursAgo(-20),
    currentPhase: 'Homogenización',
    timeLeft: '20h 00min'
  }),
  mapRawToDevice(getLatest('ZGRU5140002'), 'Madurador 02 (Maduración)', 'active', {
    name: 'Banana - Fase Gas',
    progress: 60,
    startTime: hoursAgo(48),
    endTime: hoursAgo(-24),
    currentPhase: 'Maduración',
    timeLeft: '24h 00min'
  }),
  mapRawToDevice(getLatest('ZGRU5140003'), 'Madurador 03 (Manual)', 'active'),
  mapRawToDevice({ ...getLatest('ZGRU5140004'), created_at: { $date: hoursAgo(2) } }, 'Madurador 04 (Standby)', 'warning'),
  mapRawToDevice({ ...getLatest('ZGRU5140005'), created_at: { $date: hoursAgo(25) }, power_state: 0 }, 'Madurador 05 (Offline)', 'offline')
];

export const RECIPES = [
  { id: 1, name: 'Mango Kent - Maduración Estándar', fruit: 'Mango', duration: '84h', uses: 23, color: 'bg-yellow-500' },
  { id: 2, name: 'Palta Hass - Suave', fruit: 'Palta', duration: '48h', uses: 12, color: 'bg-green-700' },
  { id: 3, name: 'Banana Cavendish - 4 Días', fruit: 'Banana', duration: '96h', uses: 156, color: 'bg-yellow-300' },
  { id: 4, name: 'Papaya - Exportación', fruit: 'Papaya', duration: '72h', uses: 5, color: 'bg-orange-400' },
];

export const CHART_DATA = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  temp: 18 + Math.random() * 2 - 1,
  humidity: 90 + Math.random() * 5 - 2.5,
  ethylene: i > 10 ? 100 + Math.random() * 20 : 10,
  co2: i > 15 ? 2 + Math.random() : 0.5,
}));
