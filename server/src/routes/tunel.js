import express from 'express';

export const tunelRouter = express.Router();

const GOURMET_TUNEL_EMAIL = (process.env.GOURMET_TRADING_EMAIL || process.env.GOURMET_TUNEL_USER_EMAIL || 'gourmettrading@ztrack.app')
  .trim()
  .toLowerCase();

/**
 * Proxy servidor → API Unidos (evita CORS en el navegador).
 * GET /api/v1/tunel/grupo?grupo=TUNEL_GREAT
 */
tunelRouter.get('/grupo', async (req, res) => {
  try {
    const email = (req.user?.email || '').trim().toLowerCase();
    if (email !== GOURMET_TUNEL_EMAIL) {
      return res.status(403).json({ error: 'forbidden', message: 'tunel grupo not allowed for this user' });
    }

    const base = (process.env.MADURADOR_API_BASE || 'http://161.132.53.51:9051').replace(/\/$/, '');
    const grupo = typeof req.query.grupo === 'string' && req.query.grupo.trim() !== ''
      ? req.query.grupo.trim()
      : 'TUNEL_GREAT';
    const url = `${base}/Unidos/leer_grupo_tunel/?grupo=${encodeURIComponent(grupo)}`;

    const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl });

    if (!r.ok) {
      console.error('[tunel] upstream', r.status, url);
      return res.status(502).json({ error: 'tunel_upstream', message: `upstream ${r.status}` });
    }

    const text = await r.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      console.error('[tunel] json', e);
      return res.status(502).json({ error: 'tunel_parse', message: 'invalid json' });
    }

    res.json(json);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
