import express from 'express';
import { pool } from '../db.js';
import { requireSuperAdmin } from '../authMiddleware.js';
import { writeAudit } from '../auditLog.js';
import {
  configToPublic,
  loadEmailConfig,
  sendConfiguredEmail,
} from '../emailSender.js';
import { EMAIL_EVENT_TYPES } from '../emailNotifications.js';

export const emailNotificationsRouter = express.Router();

emailNotificationsRouter.use(requireSuperAdmin);

function parseEvents(raw) {
  if (!Array.isArray(raw)) return null;
  const out = raw.map((e) => String(e || '').trim()).filter((e) => EMAIL_EVENT_TYPES.includes(e));
  return out.length ? out : null;
}

function parseStringList(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((v) => String(v || '').trim()).filter(Boolean))];
}

async function fetchGroupRow(id) {
  const { rows } = await pool.query(`SELECT * FROM app_email_groups WHERE id = $1::uuid`, [id]);
  return rows[0] || null;
}

async function fetchGroupDetails(id) {
  const group = await fetchGroupRow(id);
  if (!group) return null;
  const [recipients, devices] = await Promise.all([
    pool.query(`SELECT email FROM app_email_group_recipients WHERE group_id = $1::uuid ORDER BY email`, [id]),
    pool.query(`SELECT device_id FROM app_email_group_devices WHERE group_id = $1::uuid ORDER BY device_id`, [id]),
  ]);
  return {
    id: group.id,
    name: group.name,
    active: Boolean(group.active),
    events: Array.isArray(group.events) ? group.events : [],
    recipients: recipients.rows.map((r) => r.email),
    device_ids: devices.rows.map((d) => d.device_id),
    created_at: group.created_at,
    updated_at: group.updated_at,
  };
}

emailNotificationsRouter.get('/config', async (_req, res) => {
  try {
    const row = await loadEmailConfig();
    res.json({ data: configToPublic(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

emailNotificationsRouter.put('/config', async (req, res) => {
  const body = req.body || {};
  const fromEmail = String(body.from_email ?? body.fromEmail ?? '').trim();
  const provider = String(body.provider || 'resend').trim().toLowerCase() || 'resend';
  const enabled = body.enabled === true;
  const apiKeyRaw = body.api_key ?? body.apiKey;
  const clearApiKey = apiKeyRaw === '' || apiKeyRaw === null;

  if (enabled && !fromEmail) {
    return res.status(400).json({ error: 'validation', message: 'from_email required when enabled' });
  }

  try {
    const cur = await loadEmailConfig();
    let apiKey = String(cur?.api_key || '').trim();
    if (typeof apiKeyRaw === 'string' && apiKeyRaw.trim()) {
      apiKey = apiKeyRaw.trim();
    } else if (clearApiKey) {
      apiKey = '';
    }
    if (enabled && !apiKey) {
      return res.status(400).json({ error: 'validation', message: 'api_key required when enabled' });
    }

    await pool.query(
      `UPDATE app_email_config
       SET from_email = $1, api_key = $2, provider = $3, enabled = $4, updated_at = now()
       WHERE id = 1`,
      [fromEmail, apiKey, provider, enabled]
    );

    await writeAudit(req, {
      action: 'email.config.update',
      entityType: 'email_config',
      entityId: '1',
      meta: { from_email: fromEmail, enabled, provider, api_key_updated: typeof apiKeyRaw === 'string' && !!apiKeyRaw.trim() },
    });

    const row = await loadEmailConfig();
    res.json({ data: configToPublic(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

emailNotificationsRouter.post('/test', async (req, res) => {
  const to = String(req.body?.to || req.body?.email || '').trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'validation', message: 'valid to email required' });
  }
  try {
    await sendConfiguredEmail({
      to: [to],
      subject: '[Ripener] Correo de prueba',
      html: `<p>Este es un correo de prueba desde Ripener.</p><p>Si lo recibió, la configuración es correcta.</p>`,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'send_failed', message: String(e.message) });
  }
});

emailNotificationsRouter.get('/groups', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM app_email_groups ORDER BY name ASC`
    );
    const data = [];
    for (const r of rows) {
      const g = await fetchGroupDetails(r.id);
      if (g) data.push(g);
    }
    res.json({ data, event_types: EMAIL_EVENT_TYPES });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

emailNotificationsRouter.post('/groups', async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'validation', message: 'name required' });
  }
  const events = parseEvents(body.events) || [...EMAIL_EVENT_TYPES];
  const recipients = parseStringList(body.recipients);
  const deviceIds = parseStringList(body.device_ids ?? body.deviceIds);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO app_email_groups (name, events, active)
       VALUES ($1, $2::jsonb, $3)
       RETURNING id`,
      [name, JSON.stringify(events), body.active !== false]
    );
    const groupId = rows[0].id;
    for (const email of recipients) {
      await client.query(
        `INSERT INTO app_email_group_recipients (group_id, email) VALUES ($1::uuid, $2)`,
        [groupId, email]
      );
    }
    for (const deviceId of deviceIds) {
      await client.query(
        `INSERT INTO app_email_group_devices (group_id, device_id) VALUES ($1::uuid, $2)`,
        [groupId, deviceId]
      );
    }
    await client.query('COMMIT');
    const data = await fetchGroupDetails(groupId);
    await writeAudit(req, {
      action: 'email.group.create',
      entityType: 'email_group',
      entityId: String(groupId),
      meta: { name, device_count: deviceIds.length, recipient_count: recipients.length },
    });
    res.status(201).json({ data });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  } finally {
    client.release();
  }
});

emailNotificationsRouter.put('/groups/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'validation' });

  const existing = await fetchGroupRow(id);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const body = req.body || {};
  const name = body.name != null ? String(body.name).trim() : existing.name;
  if (!name) return res.status(400).json({ error: 'validation', message: 'name required' });
  const events = body.events != null ? parseEvents(body.events) : existing.events;
  if (!events?.length) {
    return res.status(400).json({ error: 'validation', message: 'at least one event required' });
  }
  const active = body.active != null ? body.active === true : existing.active;
  const recipients = body.recipients != null ? parseStringList(body.recipients) : null;
  const deviceIds = body.device_ids != null || body.deviceIds != null
    ? parseStringList(body.device_ids ?? body.deviceIds)
    : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE app_email_groups SET name = $2, events = $3::jsonb, active = $4, updated_at = now() WHERE id = $1::uuid`,
      [id, name, JSON.stringify(events), active]
    );
    if (recipients) {
      await client.query(`DELETE FROM app_email_group_recipients WHERE group_id = $1::uuid`, [id]);
      for (const email of recipients) {
        await client.query(
          `INSERT INTO app_email_group_recipients (group_id, email) VALUES ($1::uuid, $2)`,
          [id, email]
        );
      }
    }
    if (deviceIds) {
      await client.query(`DELETE FROM app_email_group_devices WHERE group_id = $1::uuid`, [id]);
      for (const deviceId of deviceIds) {
        await client.query(
          `INSERT INTO app_email_group_devices (group_id, device_id) VALUES ($1::uuid, $2)`,
          [id, deviceId]
        );
      }
    }
    await client.query('COMMIT');
    const data = await fetchGroupDetails(id);
    await writeAudit(req, {
      action: 'email.group.update',
      entityType: 'email_group',
      entityId: id,
      meta: { name },
    });
    res.json({ data });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  } finally {
    client.release();
  }
});

emailNotificationsRouter.delete('/groups/:id', async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'validation' });
  try {
    const { rowCount } = await pool.query(`DELETE FROM app_email_groups WHERE id = $1::uuid`, [id]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'email.group.delete',
      entityType: 'email_group',
      entityId: id,
      meta: {},
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
