import { gourmetTradingEmpresaIdentificador } from './gourmetFleet.js';
import { maduradorApiBase } from './tunelControlClient.js';

function flatMaduradorRow(row) {
  if (!row || typeof row !== 'object') return {};
  const flat = { ...row };
  const ud = row.ultimo_dato;
  if (ud && typeof ud === 'object' && !Array.isArray(ud)) {
    Object.assign(flat, ud);
  }
  return flat;
}

export function rowImeiFromMaduradorRow(row) {
  const flat = flatMaduradorRow(row);
  return String(flat.imei ?? row?.imei ?? '').trim();
}

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
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return nestedValor(v);
}

async function fetchDispositivosList(identificador) {
  const base = maduradorApiBase();
  const url = `${base}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=${encodeURIComponent(identificador)}`;
  const ctrl =
    typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl });
  if (!r.ok) return null;
  const text = await r.text();
  try {
    const json = text ? JSON.parse(text) : [];
    return Array.isArray(json) ? json : [];
  } catch {
    return null;
  }
}

/** Última telemetría del dispositivo por IMEI (empresa Gourmet 5001 por defecto). */
export async function fetchDeviceRowByImei(imei, identificador = gourmetTradingEmpresaIdentificador()) {
  const want = String(imei || '').trim();
  if (!want) return null;
  const list = await fetchDispositivosList(identificador);
  if (!Array.isArray(list)) return null;
  return list.find((row) => rowImeiFromMaduradorRow(row) === want) ?? null;
}

export function fanPctFromAvl(avlRaw) {
  if (avlRaw == null || !Number.isFinite(avlRaw)) return null;
  if (avlRaw >= 0 && avlRaw <= 100) return Math.round(avlRaw);
  return Math.min(100, Math.round((avlRaw / 5000) * 100));
}

/**
 * @param {Record<string, unknown>} row
 * @param {'set_point'|'humidity_set_point'|'campo_1'|'avl'} field
 */
export function readTelemetryField(row, field) {
  if (!row) return null;
  const flat = flatMaduradorRow(row);
  if (field === 'set_point') {
    return toNum(flat.set_point ?? nestedValor(row.set_point));
  }
  if (field === 'humidity_set_point') {
    return toNum(flat.humidity_set_point ?? nestedValor(row.humidity_set_point));
  }
  if (field === 'campo_1') {
    return toNum(flat.campo_1);
  }
  if (field === 'avl') {
    const raw = toNum(flat.avl);
    return fanPctFromAvl(raw);
  }
  return toNum(flat[field]);
}
