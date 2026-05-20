import type { HistoryPoint } from '@/app/lib/api';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import seedsJson from '@/app/data/fleetSimulationSeeds.json';

type FleetUnitSeed = (typeof seedsJson.units)[number];

/** Tres equipos demo solo visibles para Super administrador (flota + seguimiento). */
export const SIM_INKAPACKING_DEVICE_IDS = ['INKA-SIM-01', 'INKA-SIM-02', 'INKA-SIM-03'] as const;

/** Ventilación simulada (CFM): límite superior coherente con visualización. */
export const SIM_FLEET_AVL_MAX_CFM = 220;

export type SimInkapackingDeviceId = (typeof SIM_INKAPACKING_DEVICE_IDS)[number];

/** Desactivado: el panel usa solo datos reales upstream (lista Madurador). Las rutas legacy sim pueden reactivarse con env futuro si hiciera falta. */
export function shouldShowSimulatedInkapackingFleet(): boolean {
  return false;
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
 * Oscilación tipo reefer (referencia tipo ZGRU / Inkapacking): suministro en sierra ~18–23 °C,
 * retorno más estable ~20–21.5 °C; varios ciclos por hora según `reeferCycleMinutes`.
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
  const b = seed.behavior as FleetUnitSeed['behavior'] & {
    supplySwingC?: number;
    returnSwingC?: number;
  };
  const cycleMin = b.reeferCycleMinutes ?? 22;
  const periodMs = cycleMin * 60 * 1000;
  const theta = (tMs / periodMs) * 2 * Math.PI;
  const phase01 = (tMs / periodMs) % 1;
  const tri = phase01 < 0.5 ? 4 * phase01 - 1 : 3 - 4 * phase01;
  const supplySwing = b.supplySwingC ?? 2.35;
  const returnSwing = b.returnSwingC ?? 0.72;
  const homogDamp = phase === 'homogenization' ? 0.68 : 1;

  const supplyCenter = idealCargo - 1.18;
  const retCenter = idealCargo - 0.9;
  const microSupply =
    0.24 * Math.sin(theta * 3.12 + unitIndex * 1.15) +
    0.14 * Math.sin((tMs / (7 * 60 * 1000)) * 2 * Math.PI + unitIndex * 0.9);
  const phaseLag = 0.48 + unitIndex * 0.06;

  let supply =
    supplyCenter +
    homogDamp *
      supplySwing *
      (0.78 * Math.sin(theta) + 0.22 * tri + 0.05 * Math.sin(theta * 5)) +
    microSupply * homogDamp;
  let ret =
    retCenter +
    returnSwing * homogDamp * Math.sin(theta + phaseLag) +
    0.08 * homogDamp * Math.sin(theta * 2.08);

  const chill = Math.max(0, Math.sin(theta));
  const cargo1 = (supply + ret) / 2 + 0.2 * Math.sin(theta * 0.88);

  const baseComp = 52 + unitIndex * 2.5;
  const comp = baseComp + 14 * chill + 4 * Math.sin(phaseElapsedH * 0.08);

  let evap = -17 - 4 * chill;
  if (phase === 'homogenization' && phaseElapsedH < 2) evap -= 1.2;

  /** Caídas aisladas a 0 °C en retorno (artefacto real) para probar omisión en gráficas. */
  const bucket5m = Math.floor(tMs / (5 * 60 * 1000));
  if (phase === 'ripening' && bucket5m % 241 === (43 + unitIndex * 67) % 241) {
    ret = 0;
  }

  return {
    cargo1: round1(cargo1),
    supply: round1(supply),
    ret: round1(ret),
    comp,
    evap,
    coolingIntensity: chill,
  };
}

/**
 * Etileno estilo reefer (referencia ZGRU / Inkapacking): meseta ~90% del objetivo (≈123–126 ppm si target ~138),
 * purgas breves (caída hacia ~0) + recargas con picos ~150+ ppm, decaimiento irregular entre eventos y cierre en
 * escalones hacia valores bajos. `tn` es el avance 0–1 dentro de la fase de maduración (`ripTotalH`).
 */
function computeEthyleneRipening(
  re: number,
  ethTarget: number,
  ripTotalH: number,
  nowMs: number,
  unitIndex: number
): { ppm: number; injecting: boolean } {
  const tn = Math.min(1, Math.max(0, re / Math.max(0.01, ripTotalH)));
  const o = unitIndex * 0.011;
  const plateau = ethTarget * 0.903;
  const peak1 = ethTarget * 1.095;
  const peak2 = ethTarget * 1.115;
  const afterFirst = ethTarget * 0.87;
  const preFinal = ethTarget * 0.78;
  const lateA = ethTarget * 0.36;
  const lateB = ethTarget * 0.29;
  const floor = Math.max(0.5, ethTarget * 0.014);

  const seg = (a: number, b: number) => Math.min(1, Math.max(0, (tn - a) / Math.max(1e-6, b - a)));

  let env = plateau;
  let injecting = false;

  if (tn < 0.18 + o) {
    env = plateau + 1.3 * Math.sin(re * 0.92 + unitIndex) + 0.38 * Math.sin(re * 2.05 + unitIndex * 0.4);
  } else if (tn < 0.189 + o) {
    const u = seg(0.18 + o, 0.189 + o);
    env = plateau * (1 - smoothstep(u));
    injecting = u > 0.15;
  } else if (tn < 0.206 + o) {
    const u = seg(0.189 + o, 0.206 + o);
    env = peak1 * smoothstep(u);
    injecting = true;
  } else if (tn < 0.465) {
    const u = seg(0.206 + o, 0.465);
    const v = smoothstep(u);
    env = peak1 + (afterFirst - peak1) * v;
    env += 5.5 * Math.sin(re * 1.12 + unitIndex * 0.9) * (1 - v * 0.9);
    env += (detNoise01(nowMs, 9 + unitIndex) - 0.5) * 5 * (1 - v * 0.75);
  } else if (tn < 0.482) {
    const u = seg(0.465, 0.482);
    env = afterFirst * (1 - smoothstep(u));
    injecting = u > 0.12;
  } else if (tn < 0.505) {
    const u = seg(0.482, 0.505);
    env = peak2 * smoothstep(u);
    injecting = true;
  } else if (tn < 0.565) {
    env = peak2 + 2.1 * Math.sin(re * 1.48 + unitIndex * 1.2) + (detNoise01(nowMs, 7 + unitIndex) - 0.5) * 3.2;
  } else if (tn < 0.775) {
    const u = seg(0.565, 0.775);
    const v = smoothstep(u);
    env = peak2 + (preFinal - peak2) * v;
    env += 5 * Math.sin(re * 1.02 + unitIndex * 0.8) * (1 - v * 0.88);
    env += (detNoise01(nowMs, 12 + unitIndex) - 0.5) * 4.5 * (1 - v * 0.72);
  } else if (tn < 0.835) {
    const u = seg(0.775, 0.835);
    const start = preFinal;
    env = start * (1 - smoothstep(u)) + lateA * smoothstep(u);
    env += 2.4 * Math.sin(re * 1.45);
  } else if (tn < 0.915) {
    const u = seg(0.835, 0.915);
    env = lateA * (1 - smoothstep(u)) + lateB * smoothstep(u);
  } else {
    const u = seg(0.915, 1);
    env = lateB * (1 - smoothstep(u)) + floor * smoothstep(u);
  }

  env = Math.max(0, Math.min(ethTarget * 1.22, env));
  const grain = (detNoise01(nowMs, unitIndex + 21) - 0.5) * 2.2;
  return { ppm: round1(env + grain), injecting };
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
  const lowBand = co2Target <= 0.35;
  if (lowBand) {
    /** CO₂ muy bajo y estable (~0,1–0,3 %) como en telemetría reefer de referencia; casi sin transitorios. */
    const center = Math.max(0.1, Math.min(0.26, co2Target + 0.02));
    const micro = 0.035 * Math.sin(re * 0.55 + unitIndex * 1.05) + 0.018 * Math.sin(re * 1.35 + unitIndex * 0.6);
    const nudge = Math.sin(unitIndex * 1.9 + re * 0.18) * 0.012;
    let v = center + micro + nudge;
    return Math.min(0.3, Math.max(0.09, v));
  }
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
    const cycleMin = seed.behavior.reeferCycleMinutes ?? 22;
    const periodMs = cycleMin * 60 * 1000;
    const thetaRh = (nowMs / periodMs) * 2 * Math.PI;
    const rhOsc = 2.6 * Math.sin(thetaRh + unitIndex * 0.2) + 0.45 * Math.sin(thetaRh * 2 + 0.5);
    rh =
      rhHom -
      1.2 +
      smoothstep(phaseElapsedH / homogH) * 1.4 +
      rhOsc +
      (detNoise01(nowMs, unitIndex) - 0.5) * 0.9;
    co2 = round1(Math.max(0.1, Math.min(0.22, co2Target * 0.92 + 0.04 * Math.sin(phaseElapsedH * 0.48 + unitIndex))));
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
    const cycleMin = seed.behavior.reeferCycleMinutes ?? 22;
    const periodMs = cycleMin * 60 * 1000;
    const thetaRh = (nowMs / periodMs) * 2 * Math.PI;
    const rhAmp = 3.85;
    rh =
      rhRip -
      0.35 +
      rhAmp * Math.sin(thetaRh + 0.22) +
      0.42 * Math.sin(thetaRh * 2.05 + unitIndex * 0.3) +
      Math.sin(re * 0.28) * 0.55 +
      (detNoise01(nowMs, 11 + unitIndex) - 0.5) * 0.65;
    co2 = round1(computeCo2Ripening(re, co2LagH, co2Target, unitIndex));
    const eth = computeEthyleneRipening(re, ethTarget, ripH, nowMs, unitIndex);
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

  const reeferCycleMin = seed.behavior.reeferCycleMinutes ?? 22;
  const amb = round1(
    21.2 +
      3.6 * Math.sin((nowMs / (48 * 60 * 1000)) * 2 * Math.PI + unitIndex * 1.1) +
      1.05 * Math.sin((nowMs / (reeferCycleMin * 60 * 1000)) * 2 * Math.PI + 0.35) +
      unitIndex * 0.2
  );

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

const SIM_RIPENING_SAMPLING_STORAGE_PREFIX = 'ztrack:sim-ripening-sampling:';

/** `rp-process-9100001` … alineados con `SIM_INKAPACKING_DEVICE_IDS`. */
export function isSimulatedRipeningProcessId(processId: string): boolean {
  const m = /^rp-process-(\d+)$/.exec(processId);
  if (!m) return false;
  const n = Number(m[1]);
  for (let i = 0; i < SIM_INKAPACKING_DEVICE_IDS.length; i++) {
    if (9100001 + i === n) return true;
  }
  return false;
}

export function simulatedDeviceIdFromRipeningProcessId(processId: string): SimInkapackingDeviceId | null {
  const m = /^rp-process-(\d+)$/.exec(processId);
  if (!m) return null;
  const idx = Number(m[1]) - 9100001;
  if (idx >= 0 && idx < SIM_INKAPACKING_DEVICE_IDS.length) return SIM_INKAPACKING_DEVICE_IDS[idx];
  return null;
}

function readStoredSamplingTimeline(processId: string): unknown[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SIM_RIPENING_SAMPLING_STORAGE_PREFIX + processId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredSamplingTimeline(processId: string, events: unknown[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SIM_RIPENING_SAMPLING_STORAGE_PREFIX + processId, JSON.stringify(events));
  } catch {
    /* quota / modo privado */
  }
}

function mergeSimulatedTimeline(baseTimeline: unknown[], processId: string): unknown[] {
  const stored = readStoredSamplingTimeline(processId);
  const merged = [...(Array.isArray(baseTimeline) ? baseTimeline : []), ...stored];
  merged.sort((a, b) => {
    const ta = new Date((a as { timestamp?: string }).timestamp ?? 0).getTime();
    const tb = new Date((b as { timestamp?: string }).timestamp ?? 0).getTime();
    return ta - tb;
  });
  return merged;
}

export type SimulatedSamplingPostBody = {
  samplingType: 'initial' | 'monitoring' | 'final';
  personaEscrita: string;
  parameters: { name: string; value: string; unit: string }[];
  notes?: string;
};

function samplingTitleForSimulated(samplingType: SimulatedSamplingPostBody['samplingType']): string {
  if (samplingType === 'initial') return 'Muestreo inicial / recepción';
  if (samplingType === 'final') return 'Muestreo final / liberación';
  return 'Muestreo de seguimiento';
}

/** Registra un muestreo demo en localStorage y devuelve el proceso simulado actualizado. */
export function applySimulatedRipeningSampling(
  processId: string,
  body: SimulatedSamplingPostBody,
  evidenceFiles: File[]
): RipeningProcessRow {
  const deviceId = simulatedDeviceIdFromRipeningProcessId(processId);
  if (!deviceId) throw new Error('Proceso simulado no reconocido');

  const event = {
    id: `sim-sampling-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type: 'sampling',
    title: samplingTitleForSimulated(body.samplingType),
    timestamp: new Date().toISOString(),
    persona_escrita: body.personaEscrita,
    description: body.notes?.trim() || undefined,
    data: body.parameters,
    ...(evidenceFiles.length > 0
      ? {
          images: [{ desc: `${evidenceFiles.length} imagen(es) — demo local (no se suben al servidor)` }],
        }
      : {}),
  };

  const prev = readStoredSamplingTimeline(processId);
  writeStoredSamplingTimeline(processId, [...prev, event]);

  return buildSimulatedRipeningProcessRow(deviceId);
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
  const processId = `rp-process-${9100001 + unitIndex}`;

  const clientLine = `${seed.client.name} — ${seed.client.location}`;

  return {
    id: processId,
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
    timeline: mergeSimulatedTimeline([], processId),
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