/**
 * Lecturas basura: set_point, temp_supply_1, return_air y evaporation_coil en 0 a la vez.
 * Se ignoran y se mantiene el último valor bueno por IMEI (procesos + flota servidor).
 */

export const TELEMETRY_GLITCH_ZERO_FIELDS = [
  'set_point',
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
];

const lastGoodByImei = new Map();

function nestedValor(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object' && v !== null) {
    if ('valor' in v) return nestedValor(v.valor);
    if ('value' in v) return nestedValor(v.value);
  }
  return null;
}

function toNum(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return nestedValor(v);
}

function flatMaduradorRow(row) {
  if (!row || typeof row !== 'object') return {};
  const flat = { ...row };
  const ud = row.ultimo_dato;
  if (ud && typeof ud === 'object' && !Array.isArray(ud)) {
    for (const [k, v] of Object.entries(ud)) {
      if (v != null) flat[k] = v;
    }
  }
  return flat;
}

function readFieldRaw(flat, row, field) {
  if (field === 'set_point') return toNum(flat.set_point ?? nestedValor(row?.set_point));
  if (field === 'evaporation_coil') return toNum(flat.evaporation_coil ?? nestedValor(row?.evaporation_coil));
  return toNum(flat[field]);
}

/** True si los cuatro campos críticos son exactamente 0 (mala trama simultánea). */
export function isSimultaneousZeroGlitch(readings) {
  if (!readings || typeof readings !== 'object') return false;
  return TELEMETRY_GLITCH_ZERO_FIELDS.every((f) => {
    const n = readings[f];
    return n != null && Number.isFinite(n) && n === 0;
  });
}

export function extractCriticalTempReadings(row) {
  const flat = flatMaduradorRow(row);
  const out = {};
  for (const f of TELEMETRY_GLITCH_ZERO_FIELDS) {
    out[f] = readFieldRaw(flat, row, f);
  }
  return out;
}

/**
 * Si la fila es glitch all-zero, sustituye los cuatro campos por el último bueno del IMEI.
 * Si es válida, actualiza el cache. Devuelve { row, glitch, usedHold }.
 */
export function sanitizeMaduradorRowAgainstZeroGlitch(row, imei) {
  if (!row || typeof row !== 'object') return { row, glitch: false, usedHold: false };
  const id = String(imei || '').trim();
  const readings = extractCriticalTempReadings(row);
  const glitch = isSimultaneousZeroGlitch(readings);

  if (!glitch) {
    const allPresent = TELEMETRY_GLITCH_ZERO_FIELDS.every(
      (f) => readings[f] != null && Number.isFinite(readings[f])
    );
    if (id && allPresent) {
      lastGoodByImei.set(id, { ...readings, at: Date.now() });
    }
    return { row, glitch: false, usedHold: false };
  }

  const held = id ? lastGoodByImei.get(id) : null;
  if (!held) {
    return { row, glitch: true, usedHold: false };
  }

  const patched = {
    ...row,
    set_point: held.set_point,
    temp_supply_1: held.temp_supply_1,
    return_air: held.return_air,
    evaporation_coil: held.evaporation_coil,
  };
  if (patched.ultimo_dato && typeof patched.ultimo_dato === 'object') {
    patched.ultimo_dato = {
      ...patched.ultimo_dato,
      set_point: held.set_point,
      temp_supply_1: held.temp_supply_1,
      return_air: held.return_air,
      evaporation_coil: held.evaporation_coil,
    };
  }
  return { row: patched, glitch: true, usedHold: true };
}

export function getLastGoodCriticalTelemetry(imei) {
  const id = String(imei || '').trim();
  if (!id) return null;
  return lastGoodByImei.get(id) ?? null;
}

/** Promedio cargo válido (−20…40). Si avg > returnAir → se usa returnAir. Fallback returnAir. */
export function resolveInternalTempAverageC(cargoTemps, returnAirC) {
  const valid = (Array.isArray(cargoTemps) ? cargoTemps : [])
    .map((v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null))
    .filter((v) => v != null && v >= -20 && v <= 40);
  let avg = null;
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
