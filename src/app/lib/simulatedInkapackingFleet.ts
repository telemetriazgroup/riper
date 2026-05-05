import type { HistoryPoint } from '@/app/lib/api';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import { getStoredUser } from '@/app/lib/auth';
import seedsJson from '@/app/data/fleetSimulationSeeds.json';

type FleetUnitSeed = (typeof seedsJson.units)[number];

/** Tres equipos demo solo visibles para Super administrador (flota + seguimiento). */
export const SIM_INKAPACKING_DEVICE_IDS = ['INKA-SIM-01', 'INKA-SIM-02', 'INKA-SIM-03'] as const;

/** Ventilación simulada (CFM): límite superior coherente con visualización. */
export const SIM_FLEET_AVL_MAX_CFM = 220;

export type SimInkapackingDeviceId = (typeof SIM_INKAPACKING_DEVICE_IDS)[number];

export function shouldShowSimulatedInkapackingFleet(): boolean {
  return getStoredUser()?.role === 'superadmin';
}

export function isSimulatedInkapackingDevice(id: string): boolean {
  return SIM_INKAPACKING_DEVICE_IDS.includes(id as SimInkapackingDeviceId);
}

function unitIndexFromImei(imei: string): number {
  const i = SIM_INKAPACKING_DEVICE_IDS.indexOf(imei as SimInkapackingDeviceId);
  return i >= 0 ? i : 0;
}

function seedForUnit(unitIndex: number): FleetUnitSeed {
  return seedsJson.units[unitIndex] ?? seedsJson.units[0];
}

/** Horas desde el inicio: equilibrio para ver etileno en rampa (u0), meseta temprana (u1), avanzada (u2). */
function startedHoursAgo(unitIndex: number, seed: FleetUnitSeed): number {
  const total = seed.homogenization.hours + seed.ripening.hours;
  const fracs = [0.352, 0.5, 0.78];
  return Math.min(total * 0.92, total * (fracs[unitIndex] ?? 0.35));
}

function round1(n: number): number {
  return Number(n.toFixed(1));
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function detNoise01(tMs: number, salt: number): number {
  const a = Math.sin(tMs * 1.73e-5 + salt * 1.7);
  const b = Math.cos(tMs * 2.19e-5 + salt * 0.83);
  return (a * b + 1) / 2;
}

export type SimProcessPhase = 'homogenization' | 'ripening';

export interface SimPhysics {
  phase: SimProcessPhase;
  phaseElapsedH: number;
  totalElapsedH: number;
  setPoint: number;
  humiditySp: number;
  setCo2: number;
  spEthylene: number;
  supply: number;
  ret: number;
  cargo1: number;
  cargo2: number;
  cargo3: number;
  cargo4: number;
  rh: number;
  co2: number;
  ethPpm: number;
  evap: number;
  cond: number;
  comp: number;
  amb: number;
  avl: number;
  powerState: 0 | 1;
  iCtrlRip: 0 | 1;
  procesoLabel: string;
}

/**
 * Carga térmica objetivo (sin ciclo compresor): acercamiento al set por fase.
 */
function smoothCargoTarget(
  phase: SimProcessPhase,
  phaseElapsedH: number,
  homogH: number,
  entry: number,
  tHom: number,
  tRip: number,
  ripElapsedH: number
): number {
  if (phase === 'homogenization') {
    const p = smoothstep(phaseElapsedH / Math.max(0.01, homogH));
    return entry + (tHom - entry) * p;
  }
  const blend = smoothstep(Math.min(1, ripElapsedH / 3));
  return tHom + (tRip - tHom) * blend;
}

/**
 * Oscilación tipo reefer: enfriar (seno > 0) y descansar alrededor del punto de consigna.
 */
function applyReeferThermalCycle(
  tMs: number,
  idealCargo: number,
  seed: FleetUnitSeed,
  unitIndex: number,
  phase: SimProcessPhase,
  phaseElapsedH: number
): {
  cargo1: number;
  supply: number;
  ret: number;
  comp: number;
  evap: number;
  coolingIntensity: number;
} {
  const cycleMin = seed.behavior.reeferCycleMinutes ?? 25;
  const periodMs = cycleMin * 60 * 1000;
  const theta = (tMs / periodMs) * 2 * Math.PI;
  const cooling = Math.sin(theta);
  const swing = (seed.behavior.temperatureSwingC ?? 0.5) * 1.45;
  const micro =
    swing *
    0.15 *
    Math.sin(theta * 2.3 + unitIndex + detNoise01(tMs, unitIndex + 3) * 0.8);
  const amp = swing + micro;
  const fastRipple =
    0.34 * Math.sin((tMs / (8.2 * 60 * 1000)) * 2 * Math.PI + unitIndex * 1.1) +
    0.22 * Math.sin((tMs / (15 * 60 * 1000)) * 2 * Math.PI + unitIndex * 0.4);
  const cargo1 = idealCargo + amp * cooling + fastRipple;

  const chill = Math.max(0, cooling);
  const supplyDelta = 0.75 + 0.55 * chill + 0.15 * Math.sin(theta + 1.1);
  const retDelta = 1.05 + 0.22 * Math.sin(theta + 0.65);

  const supply = cargo1 - supplyDelta;
  const ret = cargo1 + retDelta;

  const baseComp = 52 + unitIndex * 2.5;
  const comp = baseComp + 14 * chill + 4 * Math.sin(phaseElapsedH * 0.08);

  let evap = -17 - 4 * chill;
  if (phase === 'homogenization' && phaseElapsedH < 2) evap -= 1.2;

  return { cargo1, supply, ret, comp, evap, coolingIntensity: chill };
}

function computeEthyleneRipening(
  re: number,
  ethTarget: number,
  nowMs: number,
  unitIndex: number
): { ppm: number; injecting: boolean } {
  const rampH = 3.5 + unitIndex * 0.45;
  const t = Math.min(1, re / rampH);
  const ramp = smoothstep(t);
  if (t < 0.998) {
    const ppm = ethTarget * ramp;
    return { ppm: round1(Math.max(0, ppm)), injecting: re > 0.12 && ramp < 0.96 };
  }

  const plateau = ethTarget;
  const slowRipple = 3.5 * Math.sin(re * 1.05 + unitIndex * 0.9);
  const pulseEveryH = 1.35 + unitIndex * 0.08;
  const u = (re % pulseEveryH) / pulseEveryH;
  const pulseW = 0.11;
  let pulse = 0;
  if (u < pulseW) {
    const v = u / pulseW;
    pulse = Math.sin(v * Math.PI) * (11 + unitIndex * 1.5);
  }
  const grain = (detNoise01(nowMs, unitIndex + 9) - 0.5) * 5;
  let ppm = plateau + slowRipple + pulse + grain;
  ppm = Math.max(0, Math.min(ethTarget * 1.07, ppm));
  const injecting = pulse > 3 || slowRipple > 1.8;
  return { ppm: round1(ppm), injecting };
}

function ventilationCfm(
  phase: SimProcessPhase,
  phaseElapsedH: number,
  re: number,
  co2: number,
  co2Target: number,
  co2LagH: number,
  nowMs: number,
  unitIndex: number,
  coolingIntensity: number
): number {
  if (phase === 'homogenization') {
    const w =
      35 +
      Math.sin(phaseElapsedH * 0.55) * 48 +
      detNoise01(nowMs, 40 + unitIndex) * 38 +
      coolingIntensity * 28;
    return Math.max(0, Math.min(SIM_FLEET_AVL_MAX_CFM, Math.round(w)));
  }
  let w = 22 + Math.sin(re * 0.48) * 44 + detNoise01(nowMs, 55 + unitIndex) * 42 + coolingIntensity * 52;
  if (co2 > co2Target * 0.78 && re > co2LagH + 0.3) {
    w = Math.max(w, 95 + coolingIntensity * 72 + Math.sin(re * 0.41) * 58);
  }
  return Math.max(0, Math.min(SIM_FLEET_AVL_MAX_CFM, Math.round(w)));
}

function doorOpenDelta(
  phase: SimProcessPhase,
  homogH: number,
  ripElapsedH: number,
  nowMs: number,
  startMs: number,
  unitIndex: number
): { cargoAdd: number; rhAdd: number; avlBoost: number; co2Add: number } {
  if (phase !== 'ripening') {
    return { cargoAdd: 0, rhAdd: 0, avlBoost: 0, co2Add: 0 };
  }
  const ripStartMs = startMs + homogH * 3600_000;
  const doorStartMin = 265 + unitIndex * 48;
  const doorDurMin = 22 + unitIndex * 5;
  const elapsedMinRip = (nowMs - ripStartMs) / 60_000;
  if (elapsedMinRip < doorStartMin || elapsedMinRip >= doorStartMin + doorDurMin) {
    return { cargoAdd: 0, rhAdd: 0, avlBoost: 0, co2Add: 0 };
  }
  const u = (elapsedMinRip - doorStartMin) / doorDurMin;
  const bell = Math.sin(Math.PI * u);
  return {
    cargoAdd: bell * (4.5 + unitIndex * 0.35),
    rhAdd: -bell * 9,
    avlBoost: bell * (SIM_FLEET_AVL_MAX_CFM * 0.92),
    co2Add: -bell * 0.18,
  };
}

function computeCo2Ripening(re: number, co2LagH: number, co2Target: number, unitIndex: number): number {
  if (re < co2LagH) {
    return Math.max(0.03, 0.06 + 0.04 * Math.sin(re * 0.65 + unitIndex));
  }
  const t2 = re - co2LagH;
  const tau = 4.5 + unitIndex * 0.7;
  const rise = 1 - Math.exp(-t2 / tau);
  let co2 = co2Target * rise;
  if (rise > 0.94) {
    co2 = co2Target * (1 + 0.018 * Math.sin(t2 * 0.42 + unitIndex));
  }
  return Math.min(co2Target * 1.03, Math.max(0, co2));
}

export function computeSimInkapackingPhysics(nowMs: number, unitIndex: number): SimPhysics {
  const seed = seedForUnit(unitIndex);
  const homogH = seed.homogenization.hours;
  const ripH = seed.ripening.hours;
  const totalH = homogH + ripH;
  const co2LagH = seed.behavior.co2ResponseHoursAfterRipeningStart;

  const startMs = nowMs - startedHoursAgo(unitIndex, seed) * 3600_000;
  const totalElapsedH = Math.max(0, (nowMs - startMs) / 3600_000);
  const cappedTotal = Math.min(totalH, totalElapsedH);

  let phase: SimProcessPhase;
  let phaseElapsedH: number;
  let ripElapsedH = 0;
  if (cappedTotal < homogH) {
    phase = 'homogenization';
    phaseElapsedH = cappedTotal;
  } else {
    phase = 'ripening';
    phaseElapsedH = cappedTotal - homogH;
    ripElapsedH = phaseElapsedH;
  }

  const entry = seed.behavior.entryCargoTempC;
  const tHom = seed.homogenization.tempC;
  const tRip = seed.ripening.tempC;
  const rhHom = seed.homogenization.humidityPct;
  const rhRip = seed.ripening.humidityPct;
  const co2Target = seed.ripening.co2Pct;
  const ethTarget = seed.ripening.ethylenePpm;

  let setPoint: number;
  let humiditySp: number;
  let rh: number;
  let co2: number;
  let ethPpm: number;
  let avl: number;
  let iCtrlRip: 0 | 1;
  let procesoLabel: string;

  const idealCargo = smoothCargoTarget(phase, phaseElapsedH, homogH, entry, tHom, tRip, ripElapsedH);
  const therm = applyReeferThermalCycle(nowMs, idealCargo, seed, unitIndex, phase, phaseElapsedH);

  let cargo1 = therm.cargo1;
  let supply = therm.supply;
  let ret = therm.ret;
  let comp = therm.comp;
  let evap = therm.evap;

  if (phase === 'homogenization') {
    setPoint = tHom;
    humiditySp = rhHom;
    const rhOsc = 1.35 * Math.sin((nowMs / (38 * 60 * 1000)) * 2 * Math.PI + unitIndex);
    rh =
      rhHom - 1.4 + smoothstep(phaseElapsedH / homogH) * 1.6 + rhOsc + (detNoise01(nowMs, unitIndex) - 0.5) * 1.1;
    co2 = round1(Math.max(0.08, 0.2 + 0.14 * Math.sin(phaseElapsedH * 0.55)));
    ethPpm = round1(Math.max(0, 0.45 * Math.sin(phaseElapsedH * 0.65) ** 2));
    avl = ventilationCfm(
      phase,
      phaseElapsedH,
      0,
      co2,
      co2Target,
      co2LagH,
      nowMs,
      unitIndex,
      therm.coolingIntensity
    );
    iCtrlRip = 0;
    procesoLabel = 'homogenizacion';
  } else {
    const re = ripElapsedH;
    setPoint = tRip;
    humiditySp = rhRip;
    const rhOsc = 1.45 * Math.sin((nowMs / (33 * 60 * 1000)) * 2 * Math.PI);
    rh = rhRip - 1.1 + Math.sin(re * 0.31) * 1.05 + rhOsc + (detNoise01(nowMs, 11 + unitIndex) - 0.5) * 0.8;
    co2 = round1(computeCo2Ripening(re, co2LagH, co2Target, unitIndex));
    const eth = computeEthyleneRipening(re, ethTarget, nowMs, unitIndex);
    ethPpm = eth.ppm;
    iCtrlRip = eth.injecting ? 1 : 0;
    avl = ventilationCfm(
      phase,
      phaseElapsedH,
      re,
      co2,
      co2Target,
      co2LagH,
      nowMs,
      unitIndex,
      therm.coolingIntensity
    );
    procesoLabel = 'maduracion';
  }

  const door = doorOpenDelta(phase, homogH, ripElapsedH, nowMs, startMs, unitIndex);
  cargo1 = round1(cargo1 + door.cargoAdd);
  supply = round1(supply + door.cargoAdd * 0.87);
  ret = round1(ret + door.cargoAdd * 0.94);
  rh = round1(Math.min(99, Math.max(35, rh + door.rhAdd)));
  co2 = round1(Math.max(0, co2 + door.co2Add));
  avl = Math.max(0, Math.min(SIM_FLEET_AVL_MAX_CFM, Math.round(avl + door.avlBoost)));

  const cargo2 = round1(cargo1 + 0.32 + 0.05 * Math.sin(nowMs * 1.15e-5));
  const cargo3 = round1(cargo2 + 0.22);
  const cargo4 = round1(cargo3 + 0.28);

  const cond = round1(35 + unitIndex + Math.cos(totalElapsedH * 0.14) * 2.2 + therm.coolingIntensity * 2.4);
  evap = round1(evap + Math.sin((nowMs / (21 * 60 * 1000)) * 2 * Math.PI) * 1.05);

  const amb = round1(23 + Math.sin((nowMs / 3_600_000) * 0.06) * 1.35 + unitIndex * 0.18);

  return {
    phase,
    phaseElapsedH,
    totalElapsedH: cappedTotal,
    setPoint: round1(setPoint),
    humiditySp: round1(humiditySp),
    setCo2: co2Target,
    spEthylene: ethTarget,
    supply,
    ret,
    cargo1,
    cargo2,
    cargo3,
    cargo4,
    rh,
    co2,
    ethPpm,
    evap,
    cond,
    comp: round1(comp),
    amb,
    avl,
    powerState: 1,
    iCtrlRip,
    procesoLabel,
  };
}

function iso(d: Date): string {
  return d.toISOString();
}

export function buildSimulatedMaduradorListRow(unitIndex: number, now: Date = new Date()): Record<string, unknown> {
  const seed = seedForUnit(unitIndex);
  const imei = SIM_INKAPACKING_DEVICE_IDS[unitIndex];
  const nowMs = now.getTime();
  const phy = computeSimInkapackingPhysics(nowMs, unitIndex);
  const startMs = nowMs - startedHoursAgo(unitIndex, seed) * 3600_000;
  const endMs = startMs + (seed.homogenization.hours + seed.ripening.hours) * 3600_000;
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const fechaUlt = new Date(nowMs).toISOString();

  const lineV = 440 + unitIndex * 3;
  const kwh = 2850 + unitIndex * 120 + (nowMs % 100_000) / 5000;

  const ultimo_dato: Record<string, unknown> = {
    imei,
    temp_supply_1: Number(phy.supply.toFixed(1)),
    temp_supply_2: null,
    return_air: Number(phy.ret.toFixed(1)),
    evaporation_coil: Number(phy.evap.toFixed(1)),
    condensation_coil: Number(phy.cond.toFixed(1)),
    compress_coil_1: Number(phy.comp.toFixed(1)),
    compress_coil_2: null,
    ambient_air: Number(phy.amb.toFixed(1)),
    cargo_1_temp: Number(phy.cargo1.toFixed(1)),
    cargo_2_temp: Number(phy.cargo2.toFixed(1)),
    cargo_3_temp: Number(phy.cargo3.toFixed(1)),
    cargo_4_temp: Number(phy.cargo4.toFixed(1)),
    relative_humidity: round1(phy.rh),
    avl: phy.avl,
    line_voltage: lineV,
    line_frequency: 60,
    co2_reading: round1(phy.co2),
    o2_reading: round1(18.1 + unitIndex * 0.15),
    set_point: phy.setPoint,
    capacity_load: 42 + unitIndex * 4,
    power_state: phy.powerState,
    controlling_mode: 0,
    humidity_control: 1,
    humidity_set_point: phy.humiditySp,
    fresh_air_ex_mode: 2,
    fresh_air_ex_rate: 0,
    fresh_air_ex_delay: 0,
    set_point_o2: 5,
    set_point_co2: phy.setCo2,
    sp_ethyleno: phy.spEthylene,
    defrost_term_temp: 18,
    defrost_interval: 6,
    alarm_present: 0,
    numero_alarma: 0,
    battery_voltage: 24 + unitIndex * 0.1,
    power_kwh: kwh,
    power_consumption: 8 + unitIndex * 0.3,
    consumption_ph_1: 4.2,
    consumption_ph_2: 4.1,
    consumption_ph_3: 4.2,
    campo_1: Number(phy.ethPpm.toFixed(1)),
    campo_2: 0,
    campo_3: 0,
    campo_4: 0,
    campo_5: 0,
    campo_6: 0,
    campo_7: phy.iCtrlRip,
    campo_8: 0,
    iCtrlRip: phy.iCtrlRip,
    ethylene: null,
    device: seed.deviceHost,
    fecha: fechaUlt,
    ip: `10.99.${10 + unitIndex}.${seed.ipSuffix}`,
  };

  const homogEnd = iso(new Date(startMs + seed.homogenization.hours * 3600_000));

  return {
    imei,
    estado: 1,
    identificador: String(7001 + unitIndex),
    proceso: phy.procesoLabel,
    id_proceso: 9100001 + unitIndex,
    fecha_inicio: startIso,
    hasta: endIso,
    fecha_procesada: fechaUlt,
    ultima_fecha_encendido: new Date(startMs + 30 * 60_000).toISOString(),
    ultima_fecha_apagado: null,
    ultimo_power_state: 1,
    sp_etileno: phy.spEthylene,
    historial_sp_etileno: [{ valor: phy.spEthylene, desde: startIso, hasta: endIso, estado: 'activo' }],
    ultimo_dato,
    fresh_air_ex_mode: {
      modo_actual: 2,
      fecha_modo_actual: fechaUlt,
    },
    alarmas: { numero_alarma: 0, activas: [] },
    compress_coil_1: {
      estado: 'normal',
      valor_actual: phy.comp,
      fecha_inicio_estado: startIso,
      fecha_ultimo_critico: null,
      fecha_ultimo_normal: fechaUlt,
    },
    historico_set_point: [
      { valor: seed.homogenization.tempC, desde: startIso, hasta: homogEnd },
      { valor: seed.ripening.tempC, desde: homogEnd, hasta: endIso },
    ],
    historial_humidity_set_point: [
      { valor: seed.homogenization.humidityPct, desde: startIso, hasta: homogEnd },
      { valor: seed.ripening.humidityPct, desde: homogEnd, hasta: endIso },
    ],
    historial_set_point_co2: [{ valor: seed.ripening.co2Pct, desde: homogEnd, hasta: endIso }],
    historial_power_state: [{ valor: 1, estado: 'encendido', desde: startIso, hasta: endIso }],
  };
}

/** Puntos de historial (intervalo ~5 min) con forma ESTRUCTURA_TELEMETRIA. */
export function buildSimulatedHistoryPoints(imei: string, fechaInicio: string, fechaFin: string): HistoryPoint[] {
  const unitIndex = unitIndexFromImei(imei);
  const start = new Date(fechaInicio).getTime();
  const end = new Date(fechaFin).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  const stepMs = 5 * 60 * 1000;
  const pts: HistoryPoint[] = [];
  for (let t = start; t <= end; t += stepMs) {
    const phy = computeSimInkapackingPhysics(t, unitIndex);
    const avl_pct = Math.min(100, Math.round((phy.avl / SIM_FLEET_AVL_MAX_CFM) * 100));
    pts.push({
      timestamp: new Date(t).toISOString(),
      temp_supply_1: round1(phy.supply),
      return_air: round1(phy.ret),
      evaporation_coil: round1(phy.evap),
      condensation_coil: round1(phy.cond),
      compress_coil_1: round1(phy.comp),
      ambient_air: round1(phy.amb),
      cargo_1_temp: round1(phy.cargo1),
      cargo_2_temp: round1(phy.cargo2),
      cargo_3_temp: round1(phy.cargo3),
      cargo_4_temp: round1(phy.cargo4),
      relative_humidity: round1(phy.rh),
      avl_raw: round1(phy.avl),
      avl_pct,
      line_voltage: 440 + unitIndex * 3,
      line_frequency: 60,
      co2_reading: round1(phy.co2),
      o2_reading: round1(18.1 + unitIndex * 0.15),
      set_point: round1(phy.setPoint),
      capacity_load: 42 + unitIndex * 4,
      power_state: phy.powerState,
      humidity_set_point: round1(phy.humiditySp),
      set_point_o2: 5,
      set_point_co2: phy.setCo2,
      sp_ethyleno: phy.spEthylene,
      ethylene: round1(phy.ethPpm),
      iCtrlRip: phy.iCtrlRip,
      power_kwh: round1(2850 + unitIndex * 100 + (t - start) / 1_800_000),
    });
  }
  return pts;
}

export function buildSimulatedRipeningProcessRow(deviceId: SimInkapackingDeviceId): RipeningProcessRow {
  const unitIndex = unitIndexFromImei(deviceId);
  const seed = seedForUnit(unitIndex);
  const now = new Date();
  const startMs = now.getTime() - startedHoursAgo(unitIndex, seed) * 3600_000;
  const totalH = seed.homogenization.hours + seed.ripening.hours;
  const endMs = startMs + totalH * 3600_000;
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();

  const clientLine = `${seed.client.name} — ${seed.client.location}`;

  return {
    id: `rp-process-${9100001 + unitIndex}`,
    user_id: `usr-fleet-700${unitIndex + 1}`,
    status: 'active',
    display_name: `${seed.recipeName} — ${seed.client.location}`,
    payload: {
      deviceId,
      client: { name: clientLine },
      batch: {
        product: seed.batch.product,
        variety: seed.batch.variety,
        brixMeasured: seed.batch.brix,
        colorScore: seed.batch.color,
        brixRange: { min: seed.batch.brixMin, max: seed.batch.brixMax },
      },
      scheduleSummary: {
        totalDurationHours: totalH,
        startedAt: startIso,
        estimatedEndAt: endIso,
      },
      recipe: {
        name: seed.recipeName,
        targets: {
          brix: `${seed.batch.brixMin}–${seed.batch.brixMax} °Bx`,
          color: String(seed.batch.color),
        },
        phases: [
          {
            type: 'homogenization',
            enabled: true,
            duration: seed.homogenization.hours,
            temperature: seed.homogenization.tempC,
            humidity: seed.homogenization.humidityPct,
          },
          {
            type: 'ripening',
            enabled: true,
            duration: seed.ripening.hours,
            temperature: seed.ripening.tempC,
            humidity: seed.ripening.humidityPct,
            co2: seed.ripening.co2Pct,
            ethylene_ppm: seed.ripening.ethylenePpm,
          },
        ],
      },
      objectives: [
        { name: 'Brix', value: String(seed.batch.brix), unit: '°Bx' },
        { name: 'Color', value: String(seed.batch.color), unit: '' },
        { name: 'Brix obj.', value: `${seed.batch.brixMin}–${seed.batch.brixMax}`, unit: '°Bx' },
      ],
    },
    timeline: [],
    created_at: startIso,
    updated_at: now.toISOString(),
  };
}

export function appendSimulatedInkapackingDevices<T extends { id: string }>(devices: T[], mapRow: (r: Record<string, unknown>) => T): T[] {
  if (!shouldShowSimulatedInkapackingFleet()) return devices;
  const existing = new Set(devices.map((d) => d.id));
  const now = new Date();
  const extra: T[] = [];
  for (let i = 0; i < SIM_INKAPACKING_DEVICE_IDS.length; i++) {
    const id = SIM_INKAPACKING_DEVICE_IDS[i];
    if (existing.has(id)) continue;
    extra.push(mapRow(buildSimulatedMaduradorListRow(i, now)));
  }
  return [...devices, ...extra];
}