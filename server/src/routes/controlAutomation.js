import express from 'express';
import { requireAdmin } from '../authMiddleware.js';
import { writeAudit } from '../auditLog.js';
import {
  loadControlAutomationConfig,
  updateControlAutomationConfig,
} from '../controlAutomationConfig.js';

export const controlAutomationRouter = express.Router();

/** Configuración global de automatización (admin). */
controlAutomationRouter.get('/config', requireAdmin, async (_req, res) => {
  try {
    const data = await loadControlAutomationConfig({ bypassCache: true });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

controlAutomationRouter.put('/config', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const enabled =
    body.ripening_co2_ventilation_220 === true ||
    body.ripeningCo2Ventilation220 === true;
  try {
    const data = await updateControlAutomationConfig({
      ripening_co2_ventilation_220: enabled,
    });
    await writeAudit(req, {
      action: 'control_automation.config.update',
      entityType: 'control_automation_config',
      entityId: '1',
      meta: { ripening_co2_ventilation_220: enabled },
    });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
