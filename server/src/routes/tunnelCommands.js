import express from 'express';
import { writeAudit } from '../auditLog.js';
import { fireEmailNotification } from '../emailNotifications.js';
import { isPinnedFleetDeviceId, isPinnedFleetDemoEmail } from '../demoFleetFilter.js';
import { isGourmetTunnelCommandDeviceId, isGourmetTradingFleetEmail } from '../gourmetFleet.js';
import { isGreenyardDeviceId, isGreenyardFleetEmail } from '../greenyardFleet.js';
import {
  isUltraorganicsDeviceId,
  isUltraorganicsFleetEmail,
  isUltraorganicsScopedDeviceId,
} from '../ultraorganicsFleet.js';
import { isAutomatedControlDeviceId } from '../processControlAdapter.js';
import {
  createTunnelCommandJobs,
  kickoffTunnelCommandBatch,
  listTunnelCommandJobs,
} from '../tunnelCommandCompliance.js';
import { syncControlSessionForTunnelBatch } from '../tunnelControlHistory.js';
import { validateProcessSetPointC } from '../processTempLimits.js';

export const tunnelCommandsRouter = express.Router();

function isViewer(req) {
  return req.user?.role === 'viewer';
}

function canUseTunnelCommands(req, deviceId) {
  if (isViewer(req)) return false;
  const email = req.user?.email;
  const id = String(deviceId || '').trim();
  if (!id) return false;
  if (isPinnedFleetDemoEmail(email) && !isPinnedFleetDeviceId(email, id)) {
    return false;
  }
  if (isGourmetTradingFleetEmail(email) && isGourmetTunnelCommandDeviceId(id)) return true;
  if (isGreenyardFleetEmail(email) && isGreenyardDeviceId(id)) return true;
  if (isUltraorganicsFleetEmail(email) && (isUltraorganicsDeviceId(id) || isUltraorganicsScopedDeviceId(id))) {
    return true;
  }
  if ((req.user?.role === 'superadmin' || req.user?.role === 'admin') && isAutomatedControlDeviceId(id)) {
    return true;
  }
  return false;
}

function parseCommandsBody(body) {
  const out = {};
  const src = body?.commands && typeof body.commands === 'object' ? body.commands : body;
  if (src.set_point != null) out.temperature = Number(src.set_point);
  if (src.humidity_set_point != null) out.humidity = Number(src.humidity_set_point);
  if (src.ethylene != null) out.ethylene = Number(src.ethylene);
  if (src.fan_speed != null) out.ventilation = Number(src.fan_speed);
  return out;
}

/**
 * POST /api/v1/tunnel-commands/apply-manual
 * Body: { deviceId, commands: { set_point?, humidity_set_point?, ethylene?, fan_speed? } }
 */
tunnelCommandsRouter.post('/apply-manual', async (req, res) => {
  try {
    const deviceId = String(req.body?.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'validation', message: 'deviceId required' });
    }
    if (!canUseTunnelCommands(req, deviceId)) {
      return res.status(403).json({ error: 'forbidden', message: 'tunnel commands not allowed' });
    }

    const commands = parseCommandsBody(req.body);
    const kinds = Object.keys(commands).filter((k) => Number.isFinite(commands[k]));
    if (kinds.length === 0) {
      return res.status(400).json({ error: 'validation', message: 'at least one command required' });
    }

    if (Number.isFinite(commands.temperature)) {
      const extended = req.body?.extendedManualTempRange === true || req.body?.extended_temp_range === true;
      const tempErr = validateProcessSetPointC('Manual', commands.temperature, { extendedManual: extended });
      if (tempErr) {
        return res.status(400).json({ error: 'validation', message: tempErr });
      }
    }

    const { batchId, jobs } = await createTunnelCommandJobs({
      userId: req.user.id,
      deviceId,
      commands,
    });

    await kickoffTunnelCommandBatch(batchId);
    await syncControlSessionForTunnelBatch(batchId);

    await writeAudit(req, {
      action: 'tunnel_commands.apply_manual',
      entityType: 'tunnel_command_batch',
      entityId: batchId,
      meta: { deviceId, commands, jobCount: jobs.length },
    });

    fireEmailNotification({
      deviceId,
      eventType: 'manual_control',
      actorEmail: req.user?.email,
      meta: { commands, batchId, source: 'tunnel_api' },
    });

    return res.status(201).json({ batchId, jobs });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/** GET /api/v1/tunnel-commands?deviceId=&batchId=&active=1 */
tunnelCommandsRouter.get('/', async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    const batchId = String(req.query.batchId || '').trim();
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const email = req.user?.email;

    if (deviceId && isPinnedFleetDemoEmail(email) && !isPinnedFleetDeviceId(email, deviceId)) {
      return res.status(403).json({ error: 'forbidden', message: 'device not in scope' });
    }
    if (deviceId && isGourmetTradingFleetEmail(email) && !isGourmetTunnelCommandDeviceId(deviceId)) {
      return res.status(403).json({ error: 'forbidden', message: 'device not in scope' });
    }
    if (deviceId && isGreenyardFleetEmail(email) && !isGreenyardDeviceId(deviceId)) {
      return res.status(403).json({ error: 'forbidden', message: 'device not in scope' });
    }
    if (
      deviceId &&
      isUltraorganicsFleetEmail(email) &&
      !isUltraorganicsDeviceId(deviceId) &&
      !isUltraorganicsScopedDeviceId(deviceId)
    ) {
      return res.status(403).json({ error: 'forbidden', message: 'device not in scope' });
    }

    const jobs = await listTunnelCommandJobs({
      deviceId: deviceId || undefined,
      batchId: batchId || undefined,
      activeOnly,
      limit: Math.min(100, Number(req.query.limit) || 50),
    });

    return res.json({ data: jobs });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
