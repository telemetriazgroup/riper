import { gourmetTradingEmpresaIdentificador } from './gourmetFleet.js';
import { greenyardEmpresaIdentificador, isGreenyardDeviceId } from './greenyardFleet.js';
import {
  identificadorForUltraorganicsImei,
  ultraorganicsDeviceGroupsMap,
  ultraorganicsPanelDeviceIdForImei,
  ultraorganicsUpstreamIdentificadores,
} from './ultraorganicsFleet.js';
import { maduradorApiBase } from './tunelControlClient.js';

const dispositivosListCache = new Map();
const DISPOSITIVOS_LIST_CACHE_MS = 20_000;

async function fetchDispositivosList(identificador) {
  const ident = String(identificador || '').trim();
  if (!ident) return null;
  const cached = dispositivosListCache.get(ident);
  if (cached && Date.now() - cached.at < DISPOSITIVOS_LIST_CACHE_MS) {
    return cached.rows;
  }
  const base = maduradorApiBase();
  const url = `${base}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=${encodeURIComponent(ident)}`;
  const ctrl =
    typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl });
  if (!r.ok) return null;
  const text = await r.text();
  try {
    const json = text ? JSON.parse(text) : [];
    const rows = Array.isArray(json) ? json : [];
    dispositivosListCache.set(ident, { at: Date.now(), rows });
    return rows;
  } catch {
    return null;
  }
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

export function rowImeiFromMaduradorRow(row) {
  const flat = flatMaduradorRow(row);
  return String(flat.imei ?? flat.device ?? row?.imei ?? row?.device ?? '').trim();
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

/** Última telemetría del dispositivo por IMEI (empresa Gourmet 5001 por defecto). */
export async function fetchDeviceRowByImei(imei, identificador = gourmetTradingEmpresaIdentificador()) {
  const want = String(imei || '').trim();
  if (!want) return null;

  const tryImeis = [want];
  if (want.startsWith('MEX')) {
    const panel = ultraorganicsPanelDeviceIdForImei(want);
    const group = ultraorganicsDeviceGroupsMap()[panel];
    if (Array.isArray(group)) {
      for (const g of group) {
        if (!tryImeis.includes(g)) tryImeis.push(g);
      }
    }
  }

  const idents = new Set([String(identificador || '').trim()].filter(Boolean));
  if (want.startsWith('MEX')) {
    idents.add(identificadorForUltraorganicsImei(want));
    for (const id of ultraorganicsUpstreamIdentificadores()) idents.add(id);
  }
  if (isGreenyardDeviceId(want) || want.startsWith('NEWY')) {
    idents.add(greenyardEmpresaIdentificador());
  }

  for (const ident of idents) {
    const list = await fetchDispositivosList(ident);
    if (!Array.isArray(list)) continue;
    for (const tryWant of tryImeis) {
      const wantLower = tryWant.toLowerCase();
      const row =
        list.find((r) => rowImeiFromMaduradorRow(r) === tryWant) ??
        list.find((r) => rowImeiFromMaduradorRow(r).toLowerCase() === wantLower);
      if (row) return row;
    }
  }
  return null;
}

export function fanPctFromAvl(avlRaw) {
  if (avlRaw == null || !Number.isFinite(avlRaw)) return null;
  if (avlRaw >= 0 && avlRaw <= 100) return Math.round(avlRaw);
  return Math.min(100, Math.round((avlRaw / 5000) * 100));
}

/**
 * @param {Record<string, unknown>} row
 * @param {'set_point'|'humidity_set_point'|'campo_1'|'avl'|'set_point_co2'} field
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
  if (field === 'avl_raw') {
    return toNum(flat.avl);
  }
  if (field === 'co2_reading') {
    return toNum(flat.co2_reading);
  }
  if (field === 'set_point_co2') {
    return toNum(
      flat.set_point_co2 ?? flat.set_point_co2_value ?? nestedValor(row.set_point_co2)
    );
  }
  return toNum(flat[field]);
}
