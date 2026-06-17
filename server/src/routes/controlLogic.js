import { Router } from 'express';
import { requireSuperUser } from '../authMiddleware.js';
import { buildControlLogicExport } from '../controlLogicExport.js';

export const controlLogicRouter = Router();

/** Export JSON de la lógica TUNEL / TermoKing — solo superusuario. */
controlLogicRouter.get('/export', requireSuperUser, (_req, res) => {
  const data = buildControlLogicExport();
  res.json({ ok: true, data });
});
