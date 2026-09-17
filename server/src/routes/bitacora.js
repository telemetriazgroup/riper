import express from 'express';
import { BITACORA_DEFAULT_HOURS, queryBitacora } from '../bitacora.js';
import { isPinnedFleetDeviceId, isPinnedFleetDemoEmail } from '../demoFleetFilter.js';

export const bitacoraRouter = express.Router();

/**
 * GET /api/v1/bitacora
 * Query: deviceId, hours (default 12), from, to, cursor, limit, action, processType, includePayload
 */
bitacoraRouter.get('/', async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'validation', message: 'deviceId required' });
    }
    if (isPinnedFleetDemoEmail(req.user?.email) && !isPinnedFleetDeviceId(req.user?.email, deviceId)) {
      return res.status(403).json({ error: 'forbidden', message: 'device not in fleet scope' });
    }

    const hoursRaw = req.query.hours;
    const hours =
      hoursRaw != null && String(hoursRaw).trim() !== ''
        ? Number(hoursRaw)
        : req.query.from || req.query.to
          ? null
          : BITACORA_DEFAULT_HOURS;

    const result = await queryBitacora({
      deviceId,
      hours,
      from: req.query.from,
      to: req.query.to,
      cursor: req.query.cursor,
      limit: req.query.limit,
      action: req.query.action,
      processType: req.query.processType,
      includePayload: req.query.includePayload,
    });
    return res.json(result);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    return res
      .status(status)
      .json({ error: status === 400 ? 'validation' : 'server_error', message: String(e.message) });
  }
});

/**
 * GET /api/v1/bitacora/devices/:deviceId — últimas 12 h (includePayload por defecto).
 */
bitacoraRouter.get('/devices/:deviceId', async (req, res) => {
  try {
    const deviceId = String(req.params.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'validation', message: 'deviceId required' });
    }
    if (isPinnedFleetDemoEmail(req.user?.email) && !isPinnedFleetDeviceId(req.user?.email, deviceId)) {
      return res.status(403).json({ error: 'forbidden', message: 'device not in fleet scope' });
    }
    const hours = req.query.hours != null ? Number(req.query.hours) : BITACORA_DEFAULT_HOURS;
    const result = await queryBitacora({
      deviceId,
      hours: Number.isFinite(hours) && hours > 0 ? hours : BITACORA_DEFAULT_HOURS,
      cursor: req.query.cursor,
      limit: req.query.limit,
      includePayload: req.query.includePayload ?? '1',
    });
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
