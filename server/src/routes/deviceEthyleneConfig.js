import express from 'express';
import { requireSuperAdmin } from '../authMiddleware.js';
import { writeAudit } from '../auditLog.js';
import {
  deleteEthyleneDeviceConfig,
  listEthyleneDeviceConfigs,
  upsertEthyleneDeviceConfig,
} from '../ethyleneDeviceConfig.js';

export const deviceEthyleneConfigRouter = express.Router();

/** Listado de multiplicadores por IMEI (solo superadmin). */
deviceEthyleneConfigRouter.get('/', requireSuperAdmin, async (_req, res) => {
  try {
    const data = await listEthyleneDeviceConfigs();
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

deviceEthyleneConfigRouter.put('/:deviceId', requireSuperAdmin, async (req, res) => {
  const deviceId = String(req.params.deviceId || '').trim();
  const multiplier = req.body?.injection_multiplier ?? req.body?.injectionMultiplier;
  if (!deviceId) {
    return res.status(400).json({ error: 'bad_request', message: 'deviceId required' });
  }
  if (multiplier == null || !Number.isFinite(Number(multiplier)) || Number(multiplier) <= 0) {
    return res.status(400).json({ error: 'bad_request', message: 'injection_multiplier must be > 0' });
  }
  try {
    const data = await upsertEthyleneDeviceConfig(deviceId, multiplier, req.user?.id ?? null);
    await writeAudit(req, {
      action: 'device_ethylene_config.update',
      entityType: 'device_ethylene_config',
      entityId: deviceId,
      meta: { injection_multiplier: data.injection_multiplier },
    });
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

deviceEthyleneConfigRouter.delete('/:deviceId', requireSuperAdmin, async (req, res) => {
  const deviceId = String(req.params.deviceId || '').trim();
  if (!deviceId) {
    return res.status(400).json({ error: 'bad_request', message: 'deviceId required' });
  }
  try {
    await deleteEthyleneDeviceConfig(deviceId);
    await writeAudit(req, {
      action: 'device_ethylene_config.delete',
      entityType: 'device_ethylene_config',
      entityId: deviceId,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
