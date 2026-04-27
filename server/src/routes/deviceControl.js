import express from 'express';
import { pool } from '../db.js';

function isAdminRole(req) {
  const r = req.user?.role;
  return r === 'superadmin' || r === 'admin';
}

export const deviceControlRouter = express.Router();

/**
 * Proceso de control activo (panel Homogenization / …) para un dispositivo y el usuario actual.
 */
deviceControlRouter.get('/active', async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'validation', message: 'deviceId required' });
    }
    const { rows } = await pool.query(
      `SELECT * FROM app_device_control_sessions
       WHERE user_id = $1::uuid AND device_id = $2 AND status = 'active'
       ORDER BY started_at DESC
       LIMIT 1`,
      [req.user.id, deviceId]
    );
    return res.json({ data: rows[0] ?? null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * Inicia sesión de control: cancela la activa previa (mismo usuario y dispositivo) y guarda la nueva.
 */
deviceControlRouter.post('/start', async (req, res) => {
  const body = req.body || {};
  const deviceId = String(body.deviceId || '').trim();
  const processType = String(body.processType || '').trim();
  const displayLabel = String(body.displayLabel || processType).trim() || processType;
  const params = body.params && typeof body.params === 'object' ? body.params : {};
  const durationHours = Number(body.durationHours);
  const startedAtRaw = body.startedAt;

  if (!deviceId) {
    return res.status(400).json({ error: 'validation', message: 'deviceId required' });
  }
  if (!['Homogenization', 'Ripening', 'Ventilation', 'Cooling'].includes(processType)) {
    return res.status(400).json({ error: 'validation', message: 'invalid processType' });
  }
  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 10000) {
    return res.status(400).json({ error: 'validation', message: 'invalid durationHours' });
  }

  const started = startedAtRaw ? new Date(String(startedAtRaw)) : new Date();
  if (Number.isNaN(started.getTime())) {
    return res.status(400).json({ error: 'validation', message: 'invalid startedAt' });
  }
  const ms = started.getTime() + durationHours * 3600 * 1000;
  const estimatedEnd = new Date(ms);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE app_device_control_sessions
       SET status = 'cancelled', updated_at = now()
       WHERE user_id = $1::uuid AND device_id = $2 AND status = 'active'`,
      [req.user.id, deviceId]
    );
    const { rows } = await client.query(
      `INSERT INTO app_device_control_sessions
         (user_id, device_id, process_type, display_label, params, status, started_at, estimated_end_at, duration_hours, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, 'active', $6::timestamptz, $7::timestamptz, $8::numeric, now())
       RETURNING *`,
      [
        req.user.id,
        deviceId,
        processType,
        displayLabel,
        JSON.stringify(params),
        started.toISOString(),
        estimatedEnd.toISOString(),
        durationHours,
      ]
    );
    await client.query('COMMIT');
    return res.json({ data: rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  } finally {
    client.release();
  }
});

/**
 * Listado: el usuario ve lo suyo; admin/superadmin ve todo.
 */
deviceControlRouter.get('/sessions', async (req, res) => {
  try {
    if (isAdminRole(req)) {
      const { rows } = await pool.query(
        `SELECT s.*, u.name AS user_name, u.email AS user_email
         FROM app_device_control_sessions s
         JOIN app_users u ON u.id = s.user_id
         ORDER BY s.created_at DESC
         LIMIT 500`
      );
      return res.json({ data: rows });
    }
    const { rows } = await pool.query(
      `SELECT * FROM app_device_control_sessions
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`,
      [req.user.id]
    );
    return res.json({ data: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * Marcar como completada (p. ej. al terminar plazo o manual).
 */
deviceControlRouter.post('/:id/complete', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'validation' });
    const { rows: cur } = await pool.query(
      `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const row = cur[0];
    if (row.user_id !== req.user.id && !isAdminRole(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (row.status !== 'active') {
      return res.json({ data: row });
    }
    const { rows: upd } = await pool.query(
      `UPDATE app_device_control_sessions
       SET status = 'completed', updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [id]
    );
    return res.json({ data: upd[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * Cancelar proceso activo.
 */
deviceControlRouter.post('/:id/cancel', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'validation' });
    const { rows: cur } = await pool.query(
      `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const row = cur[0];
    if (row.user_id !== req.user.id && !isAdminRole(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (row.status !== 'active') {
      return res.json({ data: row });
    }
    const { rows: upd } = await pool.query(
      `UPDATE app_device_control_sessions
       SET status = 'cancelled', updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [id]
    );
    return res.json({ data: upd[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * Editar sesión activa: etiqueta, parámetros y/o duración (recalcula fin estimado desde started_at).
 */
deviceControlRouter.patch('/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'validation' });
    const { rows: cur } = await pool.query(
      `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const row = cur[0];
    if (row.user_id !== req.user.id && !isAdminRole(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (row.status !== 'active') {
      return res.status(400).json({ error: 'invalid_state', message: 'only active sessions can be edited' });
    }
    const body = req.body || {};
    const displayLabel =
      body.displayLabel != null
        ? String(body.displayLabel).trim().slice(0, 500)
        : String(row.display_label || '');
    let params = row.params;
    if (body.params != null && typeof body.params === 'object' && !Array.isArray(body.params)) {
      params = body.params;
    }
    let durationHours = row.duration_hours != null ? Number(row.duration_hours) : NaN;
    if (body.durationHours != null) {
      const d = Number(body.durationHours);
      if (!Number.isFinite(d) || d <= 0 || d > 10000) {
        return res.status(400).json({ error: 'validation', message: 'invalid durationHours' });
      }
      durationHours = d;
    }
    const t0 = new Date(row.started_at).getTime();
    if (Number.isNaN(t0)) {
      return res.status(500).json({ error: 'server_error', message: 'invalid started_at' });
    }
    const estimatedEnd = new Date(t0 + durationHours * 3600 * 1000);
    const { rows: upd } = await pool.query(
      `UPDATE app_device_control_sessions
       SET display_label = $2,
           params = $3::jsonb,
           duration_hours = $4::numeric,
           estimated_end_at = $5::timestamptz,
           updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [id, displayLabel, JSON.stringify(params), durationHours, estimatedEnd.toISOString()]
    );
    return res.json({ data: upd[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * Borrar un registro (procesos activos: cancelar antes con POST .../cancel).
 */
deviceControlRouter.delete('/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'validation' });
    const { rows: cur } = await pool.query(
      `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const row = cur[0];
    if (row.user_id !== req.user.id && !isAdminRole(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (row.status === 'active') {
      return res.status(400).json({
        error: 'invalid_state',
        message: 'cancel active session first',
      });
    }
    await pool.query(`DELETE FROM app_device_control_sessions WHERE id = $1::uuid`, [id]);
    return res.json({ data: { deleted: true, id } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
