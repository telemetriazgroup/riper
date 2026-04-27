import express from 'express';
import { pool } from '../db.js';

export const maduradorRouter = express.Router();

const ULTRAORGANICS_EMAIL = 'ultraorganics@riper.local';
const ULTRAORGANICS_IMEI_ORDER = ['MEX1001', 'MEX2001', 'MEX3001'];

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

maduradorRouter.get('/dispositivos', async (req, res) => {
  try {
    const base = (process.env.MADURADOR_API_BASE || 'http://161.132.53.51:9051').replace(/\/$/, '');
    const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
    const email = String(req.user?.email || '').toLowerCase();

    if (email === ULTRAORGANICS_EMAIL) {
      const idents = ['1001', '2001', '3001'];
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
      const out = ULTRAORGANICS_IMEI_ORDER.map((id) => byImei.get(id)).filter(Boolean);
      return res.json({ data: out });
    }

    const { rows } = await pool.query(
      `SELECT identificador FROM app_users WHERE id = $1::uuid AND deleted_at IS NULL`,
      [req.user.id]
    );
    const ident = rows[0]?.identificador != null ? String(rows[0].identificador).trim() : '';
    if (!ident) {
      return res.json({ data: [] });
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
      return res.json({ data: [] });
    }

    res.json({ data: filterRowsByImeiIdentificadorSuffix(json, ident) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
