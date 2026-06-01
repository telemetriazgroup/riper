/** Corrige falso positivo: power_state=0 con consumo trifásico activo → encendido. */

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Las tres fases con corriente > 1 A indican compresor/motor activo aunque power_state diga 0. */
export function phasesIndicatePoweredOn(flat: Record<string, unknown>): boolean {
  const ph1 = toNum(flat.consumption_ph_1);
  const ph2 = toNum(flat.consumption_ph_2);
  const ph3 = toNum(flat.consumption_ph_3);
  return ph1 != null && ph1 > 1 && ph2 != null && ph2 > 1 && ph3 != null && ph3 > 1;
}

export function resolvePowerState(flat: Record<string, unknown>, rawPower: number | null): 0 | 1 {
  if (rawPower === 1) return 1;
  if (phasesIndicatePoweredOn(flat)) return 1;
  return 0;
}
