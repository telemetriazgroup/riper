/**
 * Lecturas basura: return_air, temp_supply_1 y evaporation_coil en 0 a la vez
 * (set_point puede ser distinto de 0). En flota se mantiene el último valor bueno
 * por IMEI (aire + cargos) en memoria + sessionStorage.
 */

export const TELEMETRY_GLITCH_AIR_FIELDS = [
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
] as const;

export const TELEMETRY_HOLD_FIELDS = [
  'set_point',
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
  'cargo_1_temp',
  'cargo_2_temp',
  'cargo_3_temp',
  'cargo_4_temp',
] as const;

/** @deprecated prefer TELEMETRY_GLITCH_AIR_FIELDS */
export const TELEMETRY_GLITCH_ZERO_FIELDS = [
  'set_point',
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
] as const;

export type CriticalTemps = {
  set_point: number | null;
  temp_supply_1: number | null;
  return_air: number | null;
  evaporation_coil: number | null;
  cargo_1_temp?: number | null;
  cargo_2_temp?: number | null;
  cargo_3_temp?: number | null;
  cargo_4_temp?: number | null;
};

const STORAGE_KEY = 'riper.telemetry.lastGoodCritical.v2';
const lastGoodByImei = new Map<string, CriticalTemps>();

function canUseSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function hasAirHold(held: CriticalTemps): boolean {
  return TELEMETRY_GLITCH_AIR_FIELDS.every(
    (f) => held[f] != null && Number.isFinite(Number(held[f]))
  );
}

function readPersisted(imei: string): CriticalTemps | undefined {
  if (!canUseSessionStorage()) return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const all = JSON.parse(raw) as Record<string, CriticalTemps>;
    const held = all?.[imei];
    if (!held || typeof held !== 'object') return undefined;
    return hasAirHold(held) ? held : undefined;
  } catch {
    return undefined;
  }
}

function writePersisted(imei: string, readings: CriticalTemps): void {
  if (!canUseSessionStorage()) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as Record<string, CriticalTemps>;
    const next: CriticalTemps = {
      set_point: readings.set_point,
      temp_supply_1: readings.temp_supply_1,
      return_air: readings.return_air,
      evaporation_coil: readings.evaporation_coil,
    };
    for (const f of [
      'cargo_1_temp',
      'cargo_2_temp',
      'cargo_3_temp',
      'cargo_4_temp',
    ] as const) {
      if (readings[f] != null && Number.isFinite(Number(readings[f]))) {
        next[f] = readings[f];
      }
    }
    all[imei] = next;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* quota / private mode */
  }
}

/**
 * True si retorno, suministro y evaporador son exactamente 0.
 * set_point puede ser distinto de 0. Los cargos en 0 se sostienen en hold.
 */
export function isSimultaneousZeroGlitch(readings: CriticalTemps): boolean {
  return TELEMETRY_GLITCH_AIR_FIELDS.every((f) => {
    const n = readings[f];
    return n != null && Number.isFinite(n) && n === 0;
  });
}

/**
 * Si es glitch all-zero, devuelve valores del hold; si no, actualiza cache y devuelve los actuales.
 */
export function holdCriticalTempsAgainstZeroGlitch(
  imei: string,
  readings: CriticalTemps
): CriticalTemps & { glitch: boolean; usedHold: boolean } {
  const id = String(imei || '').trim();
  const glitch = isSimultaneousZeroGlitch(readings);
  if (!glitch) {
    const airPresent = TELEMETRY_GLITCH_AIR_FIELDS.every(
      (f) => readings[f] != null && Number.isFinite(readings[f] as number)
    );
    if (id && airPresent) {
      const prev = lastGoodByImei.get(id) || ({} as CriticalTemps);
      const next: CriticalTemps = {
        set_point: readings.set_point ?? prev.set_point ?? null,
        temp_supply_1: readings.temp_supply_1,
        return_air: readings.return_air,
        evaporation_coil: readings.evaporation_coil,
        cargo_1_temp: readings.cargo_1_temp ?? prev.cargo_1_temp ?? null,
        cargo_2_temp: readings.cargo_2_temp ?? prev.cargo_2_temp ?? null,
        cargo_3_temp: readings.cargo_3_temp ?? prev.cargo_3_temp ?? null,
        cargo_4_temp: readings.cargo_4_temp ?? prev.cargo_4_temp ?? null,
      };
      lastGoodByImei.set(id, next);
      writePersisted(id, next);
    }
    return { ...readings, glitch: false, usedHold: false };
  }
  const held = (id ? lastGoodByImei.get(id) : undefined) ?? (id ? readPersisted(id) : undefined);
  if (!held) {
    return { ...readings, glitch: true, usedHold: false };
  }
  if (id) lastGoodByImei.set(id, { ...held });
  // set_point no forma parte del glitch: conservar el vivo si es válido ≠ 0.
  const keepLiveSet =
    readings.set_point != null &&
    Number.isFinite(readings.set_point) &&
    readings.set_point !== 0;
  return {
    set_point: keepLiveSet ? readings.set_point : held.set_point,
    temp_supply_1: held.temp_supply_1,
    return_air: held.return_air,
    evaporation_coil: held.evaporation_coil,
    cargo_1_temp: held.cargo_1_temp ?? null,
    cargo_2_temp: held.cargo_2_temp ?? null,
    cargo_3_temp: held.cargo_3_temp ?? null,
    cargo_4_temp: held.cargo_4_temp ?? null,
    glitch: true,
    usedHold: true,
  };
}

/** Promedio cargo (−20…40). Si avg > returnAir → returnAir. */
export function resolveInternalTempAverageC(
  cargoTemps: (number | null | undefined)[],
  returnAirC: number | null | undefined
): number | null {
  const valid = cargoTemps
    .map((v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null))
    .filter((v): v is number => v != null && v >= -20 && v <= 40);
  let avg: number | null = null;
  if (valid.length === 1) avg = Number(valid[0].toFixed(1));
  else if (valid.length > 1) {
    avg = Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
  }
  const ret =
    returnAirC != null && Number.isFinite(Number(returnAirC)) ? Number(returnAirC) : null;
  if (avg == null) return ret;
  if (ret != null && avg > ret) return Number(ret.toFixed(1));
  return avg;
}
