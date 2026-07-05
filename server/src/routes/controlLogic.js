import { Router } from 'express';
import { requireSuperUser } from '../authMiddleware.js';
import { buildControlLogicExport } from '../controlLogicExport.js';

export const controlLogicRouter = Router();

/** Export JSON de la lógica TUNEL / TermoKing — solo superusuario. */
controlLogicRouter.get('/export', requireSuperUser, async (_req, res) => {
  try {
    const data = await buildControlLogicExport();
    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
