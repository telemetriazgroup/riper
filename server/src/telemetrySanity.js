/**
 * Lecturas basura: return_air, temp_supply_1 y evaporation_coil en 0 a la vez
 * (set_point puede ser distinto de 0). Se ignoran y se mantiene el último valor
 * bueno por IMEI (aire + cargos). No se evalúa Cooling con esa trama.
 */

export const TELEMETRY_GLITCH_AIR_FIELDS = [
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
];

/** Campos que se sostienen en hold (aire + set + cargos). */
export const TELEMETRY_HOLD_FIELDS = [
  'set_point',
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
  'cargo_1_temp',
  'cargo_2_temp',
  'cargo_3_temp',
  'cargo_4_temp',
];

/** @deprecated use TELEMETRY_GLITCH_AIR_FIELDS — kept for callers that imported the old name */
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
  return toNum(flat[field] ?? nestedValor(row?.[field]));
}

/**
 * True si retorno, suministro y evaporador son exactamente 0 (mala trama).
 * set_point puede ser distinto de 0 (p. ej. set=1 con sensores en 0).
 * Los cargos en 0 suelen venir en la misma trama y también se sostienen en hold.
 */
export function isSimultaneousZeroGlitch(readings) {
  if (!readings || typeof readings !== 'object') return false;
  return TELEMETRY_GLITCH_AIR_FIELDS.every((f) => {
    const n = readings[f];
    return n != null && Number.isFinite(n) && n === 0;
  });
}

export function extractCriticalTempReadings(row) {
  const flat = flatMaduradorRow(row);
  const out = {};
  for (const f of TELEMETRY_HOLD_FIELDS) {
    out[f] = readFieldRaw(flat, row, f);
  }
  return out;
}

function patchHeldFields(row, held, liveReadings) {
  // set_point no forma parte del glitch de ceros: conservar el vivo si es válido ≠ 0.
  const keepLiveSet =
    liveReadings?.set_point != null &&
    Number.isFinite(Number(liveReadings.set_point)) &&
    Number(liveReadings.set_point) !== 0;

  const patched = { ...row };
  for (const f of TELEMETRY_HOLD_FIELDS) {
    if (f === 'set_point' && keepLiveSet) continue;
    if (held[f] != null && Number.isFinite(Number(held[f]))) {
      patched[f] = held[f];
    }
  }
  if (patched.ultimo_dato && typeof patched.ultimo_dato === 'object') {
    const ud = { ...patched.ultimo_dato };
    for (const f of TELEMETRY_HOLD_FIELDS) {
      if (f === 'set_point' && keepLiveSet) continue;
      if (held[f] != null && Number.isFinite(Number(held[f]))) {
        ud[f] = held[f];
      }
    }
    patched.ultimo_dato = ud;
  }
  return patched;
}

/**
 * Si la fila es glitch all-zero en aire (+ cargos), sustituye por el último bueno del IMEI.
 * Si es válida, actualiza el cache. Devuelve { row, glitch, usedHold }.
 */
export function sanitizeMaduradorRowAgainstZeroGlitch(row, imei) {
  if (!row || typeof row !== 'object') return { row, glitch: false, usedHold: false };
  const id = String(imei || '').trim();
  const readings = extractCriticalTempReadings(row);
  const glitch = isSimultaneousZeroGlitch(readings);

  if (!glitch) {
    const airPresent = TELEMETRY_GLITCH_AIR_FIELDS.every(
      (f) => readings[f] != null && Number.isFinite(readings[f])
    );
    if (id && airPresent) {
      const prev = lastGoodByImei.get(id) || {};
      const next = { ...prev, at: Date.now() };
      for (const f of TELEMETRY_HOLD_FIELDS) {
        if (readings[f] != null && Number.isFinite(readings[f])) {
          next[f] = readings[f];
        }
      }
      lastGoodByImei.set(id, next);
    }
    return { row, glitch: false, usedHold: false };
  }

  const held = id ? lastGoodByImei.get(id) : null;
  if (!held) {
    return { row, glitch: true, usedHold: false };
  }

  return { row: patchHeldFields(row, held, readings), glitch: true, usedHold: true };
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
