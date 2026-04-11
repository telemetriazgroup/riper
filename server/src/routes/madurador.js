import express from 'express';
import { pool } from '../db.js';

export const maduradorRouter = express.Router();

maduradorRouter.get('/dispositivos', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT identificador FROM app_users WHERE id = $1::uuid AND deleted_at IS NULL`,
      [req.user.id]
    );
    const ident = rows[0]?.identificador != null ? String(rows[0].identificador).trim() : '';
    if (!ident) {
      return res.json({ data: [] });
    }

    const base = (process.env.MADURADOR_API_BASE || 'http://161.132.53.51:9051').replace(/\/$/, '');
    const url = `${base}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=${encodeURIComponent(ident)}`;

    const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
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

    res.json({ data: json });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
