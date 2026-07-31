/**
 * Lecturas basura: set_point, temp_supply_1, return_air y evaporation_coil en 0 a la vez.
 * En flota se mantiene el último valor bueno por IMEI.
 */

export const TELEMETRY_GLITCH_ZERO_FIELDS = [
  'set_point',
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
] as const;

type CriticalTemps = {
  set_point: number | null;
  temp_supply_1: number | null;
  return_air: number | null;
  evaporation_coil: number | null;
};

const lastGoodByImei = new Map<string, CriticalTemps>();

export function isSimultaneousZeroGlitch(readings: CriticalTemps): boolean {
  return TELEMETRY_GLITCH_ZERO_FIELDS.every((f) => {
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
    const allPresent = TELEMETRY_GLITCH_ZERO_FIELDS.every(
      (f) => readings[f] != null && Number.isFinite(readings[f] as number)
    );
    if (id && allPresent) {
      lastGoodByImei.set(id, { ...readings });
    }
    return { ...readings, glitch: false, usedHold: false };
  }
  const held = id ? lastGoodByImei.get(id) : undefined;
  if (!held) {
    return { ...readings, glitch: true, usedHold: false };
  }
  return { ...held, glitch: true, usedHold: true };
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
