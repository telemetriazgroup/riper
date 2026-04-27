import express from 'express';

/**
 * Proxy same-origin para la API Madurador (cuenta demo): el navegador llama a
 * /api/v1/madurador-demo/Madurador/... y el servidor reenvía a MADURADOR_DEMO_API_BASE (ej. :9090).
 * Evita CORS al no cruzar orígenes. Por defecto: 161.132.53.51:9051 (listar_dispositivos… / buscar_datos…).
 */
export const maduradorDemoProxyRouter = express.Router();

maduradorDemoProxyRouter.get(/.*/, async (req, res) => {
  const base = (process.env.MADURADOR_DEMO_API_BASE || 'http://161.132.53.51:9051').replace(
    /\/$/,
    ''
  );
  /** Tras el mount, req.url es /Madurador/...?query */
  const target = `${base}${req.url}`;

  const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;

  try {
    const r = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: ctrl,
    });
    const text = await r.text();
    const ct = r.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(r.status).set('Content-Type', ct).send(text);
  } catch (e) {
    console.error('[madurador-demo-proxy]', target, e);
    res.status(502).json({
      error: 'madurador_demo_upstream',
      message: String(e.message),
    });
  }
});
