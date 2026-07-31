import express from 'express';
import { pool } from '../db.js';
import {
  greenyardEmpresaIdentificador,
  greenyardDeviceImeis,
  isGreenyardFleetEmail,
} from '../greenyardFleet.js';
import {
  gourmetTradingEmpresaIdentificador,
  gourmetTradingMaduradorFleetImeis,
  isGourmetTradingFleetEmail,
} from '../gourmetFleet.js';
import {
  isUltraorganicsFleetEmail,
  ultraorganicsPanelImeis,
  ultraorganicsUpstreamIdentificadores,
  ultraorganicsEthyleneImei,
  ultraorganicsHumidityImei,
  packageUltraorganicsFleetRow,
} from '../ultraorganicsFleet.js';
import {
  isDemoMaduradorFleetEmail,
  demoMaduradorEmpresaIdentificadores,
} from '../demoMaduradorFleet.js';
import { sanitizeMaduradorRowAgainstZeroGlitch } from '../telemetrySanity.js';

export const maduradorRouter = express.Router();

/** Sustituye tramas all-cero (set/supply/return/evap) por último bueno en memoria del API. */
function sanitizeDispositivosRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const imei = String(row.imei ?? row.ultimo_dato?.imei ?? '').trim();
    const { row: sanitized } = sanitizeMaduradorRowAgainstZeroGlitch(row, imei);
    return sanitized;
  });
}

function jsonDispositivos(res, rows) {
  return res.json({ data: sanitizeDispositivosRows(rows) });
}

/** Empresa “ancha” lista completa upstream (solo superadmin), p. ej. 2001. */
function superadminWideEmpresaIdentificador() {
  const s = String(process.env.SUPERUSER_MADURADOR_WIDE_EMPRESA_IDENTIFICADOR ?? '2001').trim();
  return s || '2001';
}

/** Segunda empresa: dispositivo concreto IMEI pin (solo superadmin), p. ej. 3001 + PRUEBA_CA000001. */
function superadminPinnedEmpresaIdentificador() {
  const s = String(
    process.env.SUPERUSER_MADURADOR_EMPRESA_IDENTIFICADOR ||
      process.env.MADURADOR_SUPERADMIN_IDENTIFICADOR ||
      '3001'
  ).trim();
  return s || '3001';
}

/**
 * Solo superadmin: IMEI exacto tras listar por empresa (PRUEBA_CA000001 por defecto).
 * `SUPERUSER_DEVICE_IMEI=` vacío o `*` → sin filtro, devolver todos los dispositivos del listado empresa.
 */
function superadminPinnedDeviceImei() {
  const raw = process.env.SUPERUSER_DEVICE_IMEI;
  if (raw === '' || raw === '*') return null;
  const s =
    raw != null && String(raw).trim() !== ''
      ? String(raw).trim()
      : 'PRUEBA_CA000001';
  return s || null;
}

/** Tercera empresa en fusión superadmin (p. ej. Greenyard 4001). `NONE` / `0` / vacío → no cargar. */
function superadminGreenyardEmpresaIdentificador() {
  const raw = process.env.SUPERUSER_MADURADOR_GREENYARD_IDENTIFICADOR;
  const s = raw != null ? String(raw).trim() : '4001';
  if (!s || s.toUpperCase() === 'NONE' || s === '0') return '';
  return s;
}

/** Cuarta empresa en fusión superadmin (p. ej. 5001). `NONE` / `0` / vacío → no cargar. */
function superadminEmpresa5001Identificador() {
  const raw = process.env.SUPERUSER_MADURADOR_5001_IDENTIFICADOR;
  const s = raw != null ? String(raw).trim() : '5001';
  if (!s || s.toUpperCase() === 'NONE' || s === '0') return '';
  return s;
}

/**
 * Empresas extra en fusión superadmin (default 6001,7001 — misma flota que demo-madurador).
 * `SUPERUSER_MADURADOR_EXTRA_EMPRESA_IDENTIFICADORES=NONE` → no cargar.
 */
function superadminExtraEmpresaIdentificadores() {
  const raw = process.env.SUPERUSER_MADURADOR_EXTRA_EMPRESA_IDENTIFICADORES;
  const s = raw != null ? String(raw).trim() : '6001,7001';
  if (!s || s.toUpperCase() === 'NONE') return [];
  return s
    .split(/[,;\s]+/)
    .map((x) => String(x || '').trim())
    .filter((x) => x && x.toUpperCase() !== 'NONE' && x !== '0');
}

/** Misma regla que el front (`fleetDemo`): recepción/operación/calidad/*.ultraorganics@riper.local */
// isUltraorganicsFleetEmail from ultraorganicsFleet.js

function thermoKingEmailLogin() {
  return String(process.env.THERMOKING_EMAIL || 'thermoking@riper.local').trim().toLowerCase();
}

function isThermoKingFleetEmail(email) {
  return String(email || '').trim().toLowerCase() === thermoKingEmailLogin();
}

function thermoKingEmpresaIdentificador() {
  const s = String(process.env.THERMOKING_EMPRESA_IDENTIFICADOR || '3001').trim();
  return s || '3001';
}

function thermoKingPinnedDeviceImei() {
  return String(process.env.THERMOKING_DEVICE_IMEI || 'PRUEBA_CA000001').trim();
}

const ULTRAORGANICS_IMEI_ORDER = ultraorganicsPanelImeis();

function rowImeiFromMaduradorRow(row) {
  if (!row || typeof row !== 'object') return '';
  const flat = { ...row };
  const ud = row.ultimo_dato;
  if (ud && typeof ud === 'object' && !Array.isArray(ud)) {
    Object.assign(flat, ud);
  }
  return String(flat.imei ?? row.imei ?? '').trim();
}

/** Misma regla que el front: solo IMEI cuyo sufijo = identificador (p. ej. MEX1001 para 1001). */
function filterRowsByImeiIdentificadorSuffix(rows, ident) {
  const id = String(ident || '').trim();
  if (!id || !Array.isArray(rows) || rows.length === 0) return rows;
  const kept = rows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    const flat = { ...row };
    const ud = row.ultimo_dato;
    if (ud && typeof ud === 'object' && !Array.isArray(ud)) {
      Object.assign(flat, ud);
    }
    const imei = String(flat.imei ?? row.imei ?? '').trim();
    return imei.endsWith(id);
  });
  if (kept.length === 0) return rows;
  return kept;
}

function filterRowsByImeiExact(rows, imeiExact) {
  const want = String(imeiExact || '').trim();
  if (!want || !Array.isArray(rows) || rows.length === 0) return rows;
  return rows.filter((row) => rowImeiFromMaduradorRow(row) === want);
}

/** Solo IMEI en `allowlist`, en el orden indicado (p. ej. Gourmet Trading). */
function filterRowsByImeiAllowlistOrdered(rows, allowlist) {
  const ids = Array.isArray(allowlist) ? allowlist.map((s) => String(s || '').trim()).filter(Boolean) : [];
  if (!ids.length || !Array.isArray(rows) || rows.length === 0) return [];
  const byImei = new Map();
  for (const row of rows) {
    const imei = rowImeiFromMaduradorRow(row);
    if (imei) byImei.set(imei, row);
  }
  return ids.map((id) => byImei.get(id)).filter(Boolean);
}

/** Compresor en `normal` y sin alarmas activas — solo si {@link greenyardFilterNormalOperationEnabled}. */
function filterMaduradorRowsNormalOperation(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    const cc = row.compress_coil_1;
    if (cc && typeof cc === 'object' && cc !== null && 'estado' in cc) {
      const st = String(cc.estado || '').trim().toLowerCase();
      if (st && st !== 'normal') return false;
    }
    const al = row.alarmas;
    if (
      al &&
      typeof al === 'object' &&
      al !== null &&
      Array.isArray(al.activas) &&
      al.activas.length > 0
    )
      return false;
    return true;
  });
}

/** `GREENYARD_FILTER_NORMAL_OPERATION=1`/`true` activa {@link filterMaduradorRowsNormalOperation}; por defecto off. */
function greenyardFilterNormalOperationEnabled() {
  const v = process.env.GREENYARD_FILTER_NORMAL_OPERATION;
  if (v == null || String(v).trim() === '') return false;
  return String(v).trim() === '1' || /^true$/i.test(String(v).trim());
}

async function fetchMaduradorDispositivosList(base, identificadorEmpresa, ctrl) {
  const url = `${base}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=${encodeURIComponent(identificadorEmpresa)}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl });
  if (!r.ok) return null;
  const text = await r.text();
  try {
    const json = text ? JSON.parse(text) : [];
    return Array.isArray(json) ? json : [];
  } catch (_) {
    return null;
  }
}

/** Índice por IMEI estable: primario gana; filas posteriores solo añaden IMEI nuevo. */
function mergeDispositivosRows(primary, secondary) {
  const map = new Map();
  const pushChunk = (arr, overwrite) => {
    if (!Array.isArray(arr)) return;
    for (const row of arr) {
      const imei = rowImeiFromMaduradorRow(row);
      if (!imei) continue;
      if (!map.has(imei)) map.set(imei, row);
      else if (overwrite) map.set(imei, row);
    }
  };
  pushChunk(primary, false);
  pushChunk(secondary, true);
  return [...map.values()];
}

maduradorRouter.get('/dispositivos', async (req, res) => {
  try {
    const base = (process.env.MADURADOR_API_BASE || 'http://161.132.53.51:9051').replace(/\/$/, '');
    const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
    const email = String(req.user?.email || '').toLowerCase();
    /** JWT superadmin: merge lista empresa “ancha” (2001 por defecto) + empresa pin (3001) con IMEI concreto. */
    const jwtSuperadmin = req.user?.role === 'superadmin';

    if (jwtSuperadmin) {
      const wideId = superadminWideEmpresaIdentificador();
      const pinEmpresaId = superadminPinnedEmpresaIdentificador();
      const pinImei = superadminPinnedDeviceImei();

    const listWide = await fetchMaduradorDispositivosList(base, wideId, ctrl);
    if (listWide === null) {
      console.error('[madurador] superadmin wide empresa upstream failed', wideId, '(continuing with partial merge)');
    }

    let listPinned = [];
    if (pinEmpresaId !== wideId) {
      const rawPin = await fetchMaduradorDispositivosList(base, pinEmpresaId, ctrl);
      if (rawPin === null) {
        console.error('[madurador] superadmin pinned empresa upstream failed', pinEmpresaId, '(continuing with partial merge)');
      } else {
        listPinned = pinImei ? filterRowsByImeiExact(rawPin, pinImei) : rawPin;
      }
    } else if (pinImei && listWide) {
      listPinned = filterRowsByImeiExact(listWide, pinImei);
    }

    const mergedBase = mergeDispositivosRows(listWide ?? [], listPinned);

      const gySuperId = superadminGreenyardEmpresaIdentificador();
      let merged = mergedBase;
      const superadminExtraIds = new Set([wideId, pinEmpresaId].filter(Boolean));
      if (gySuperId) {
        const listGy = await fetchMaduradorDispositivosList(base, gySuperId, ctrl);
        if (listGy === null) {
          console.error('[madurador] superadmin greenyard empresa upstream failed', gySuperId);
        } else {
          merged = mergeDispositivosRows(mergedBase, listGy);
          superadminExtraIds.add(gySuperId);
        }
      }

      const id5001 = superadminEmpresa5001Identificador();
      if (id5001 && !superadminExtraIds.has(id5001)) {
        const list5001 = await fetchMaduradorDispositivosList(base, id5001, ctrl);
        if (list5001 === null) {
          console.error('[madurador] superadmin empresa 5001 upstream failed', id5001);
        } else {
          merged = mergeDispositivosRows(merged, list5001);
          superadminExtraIds.add(id5001);
        }
      }

      for (const extraId of superadminExtraEmpresaIdentificadores()) {
        if (superadminExtraIds.has(extraId)) continue;
        const listExtra = await fetchMaduradorDispositivosList(base, extraId, ctrl);
        if (listExtra === null) {
          console.error('[madurador] superadmin empresa extra upstream failed', extraId);
        } else {
          merged = mergeDispositivosRows(merged, listExtra);
          superadminExtraIds.add(extraId);
        }
      }

      return jsonDispositivos(res, merged);
    }

    if (isDemoMaduradorFleetEmail(email)) {
      const idents = demoMaduradorEmpresaIdentificadores();
      if (!idents.length) {
        return jsonDispositivos(res, []);
      }
      let merged = [];
      for (const id of idents) {
        const list = await fetchMaduradorDispositivosList(base, id, ctrl);
        if (list === null) {
          console.error('[madurador] demo-madurador upstream failed', id);
          continue;
        }
        merged = mergeDispositivosRows(merged, list);
      }
      return jsonDispositivos(res, merged);
    }

    if (isUltraorganicsFleetEmail(email)) {
      const idents = ultraorganicsUpstreamIdentificadores();
      const fetches = idents.map((id) => {
        const url = `${base}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=${encodeURIComponent(id)}`;
        return fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl }).then(async (r) => {
          if (!r.ok) {
            console.error('[madurador] ultraorganics upstream', r.status, url);
            return [];
          }
          const text = await r.text();
          try {
            const json = text ? JSON.parse(text) : [];
            return Array.isArray(json) ? json : [];
          } catch (e) {
            console.error('[madurador] ultraorganics json', e);
            return [];
          }
        });
      });
      const arrs = await Promise.all(fetches);
      const merged = arrs.flat();
      const byImei = new Map();
      for (const row of merged) {
        const imei = rowImeiFromMaduradorRow(row);
        if (imei) {
          byImei.set(imei, row);
        }
      }
      const out = ULTRAORGANICS_IMEI_ORDER.map((panelId) => {
        const primary = byImei.get(ultraorganicsEthyleneImei(panelId)) ?? byImei.get(panelId);
        if (!primary) return null;
        const humidity = byImei.get(ultraorganicsHumidityImei(panelId));
        return packageUltraorganicsFleetRow(primary, humidity, panelId);
      }).filter(Boolean);
      return jsonDispositivos(res, out);
    }

    if (isThermoKingFleetEmail(email)) {
      const tkIdent = thermoKingEmpresaIdentificador();
      const pinImei = thermoKingPinnedDeviceImei();
      const listTk = await fetchMaduradorDispositivosList(base, tkIdent, ctrl);
      if (listTk === null) {
        console.error('[madurador] thermoking upstream failed', tkIdent);
        return res.status(502).json({ error: 'madurador_upstream', message: `upstream thermoking ${tkIdent}` });
      }
      const filtered = filterRowsByImeiExact(listTk, pinImei);
      return jsonDispositivos(res, filtered);
    }

    if (isGreenyardFleetEmail(email)) {
      const gyIdent = greenyardEmpresaIdentificador();
      const listGy = await fetchMaduradorDispositivosList(base, gyIdent, ctrl);
      if (listGy === null) {
        console.error('[madurador] greenyard upstream failed', gyIdent);
        return res.status(502).json({ error: 'madurador_upstream', message: `upstream greenyard ${gyIdent}` });
      }
      const allow = greenyardDeviceImeis();
      const data = greenyardFilterNormalOperationEnabled()
        ? filterMaduradorRowsNormalOperation(filterRowsByImeiAllowlistOrdered(listGy, allow))
        : filterRowsByImeiAllowlistOrdered(listGy, allow);
      return jsonDispositivos(res, data);
    }

    if (isGourmetTradingFleetEmail(email)) {
      const gtIdent = gourmetTradingEmpresaIdentificador();
      const listGt = await fetchMaduradorDispositivosList(base, gtIdent, ctrl);
      if (listGt === null) {
        console.error('[madurador] gourmet trading upstream failed', gtIdent);
        return res.status(502).json({ error: 'madurador_upstream', message: `upstream gourmet ${gtIdent}` });
      }
      const allow = gourmetTradingMaduradorFleetImeis();
      const data = filterRowsByImeiAllowlistOrdered(listGt, allow);
      return jsonDispositivos(res, data);
    }

    const { rows } = await pool.query(
      `SELECT identificador FROM app_users WHERE id = $1::uuid AND deleted_at IS NULL`,
      [req.user.id]
    );
    const ident = rows[0]?.identificador != null ? String(rows[0].identificador).trim() : '';
    if (!ident) {
      return jsonDispositivos(res, []);
    }

    const url = `${base}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=${encodeURIComponent(ident)}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl });

    if (!r.ok) {
      console.error('[madurador] upstream', r.status, url);
      return res.status(502).json({ error: 'madurador_upstream', message: `upstream ${r.status}` });
    }

    const text = await r.text();
    let json;
    try {
      json = text ? JSON.parse(text) : [];
    } catch (e) {
      console.error('[madurador] json', e);
      return res.status(502).json({ error: 'madurador_parse', message: 'invalid json' });
    }

    if (!Array.isArray(json)) {
      return jsonDispositivos(res, []);
    }

    return jsonDispositivos(res, filterRowsByImeiIdentificadorSuffix(json, ident));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
