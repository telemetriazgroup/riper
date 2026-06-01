/** Corrige falso positivo: power_state=0 con consumo trifásico activo → encendido. */

function toNum(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function phasesIndicatePoweredOn(flat) {
  if (!flat || typeof flat !== 'object') return false;
  const ph1 = toNum(flat.consumption_ph_1);
  const ph2 = toNum(flat.consumption_ph_2);
  const ph3 = toNum(flat.consumption_ph_3);
  return ph1 != null && ph1 > 1 && ph2 != null && ph2 > 1 && ph3 != null && ph3 > 1;
}

export function resolvePowerState(flat, rawPower) {
  if (rawPower === 1) return 1;
  if (phasesIndicatePoweredOn(flat)) return 1;
  return 0;
}
