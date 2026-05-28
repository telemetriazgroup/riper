import express from 'express';
import { pool } from '../db.js';
import { writeAudit } from '../auditLog.js';
import { requireSuperAdmin } from '../authMiddleware.js';
import { maybeFinalizeDeviceControlDebounced } from '../autoFinalizeDueProcesses.js';
import {
  filterRowsByPinnedFleetDeviceIds,
  isPinnedFleetDeviceId,
  isPinnedFleetDemoEmail,
} from '../demoFleetFilter.js';

function parseIncludeArchived(req) {
  const v = req.query.includeArchived ?? req.query.include_archived;
  return v === true || v === 'true' || v === '1';
}

function isAdminRole(req) {
  const r = req.user?.role;
  return r === 'superadmin' || r === 'admin';
}

function isViewer(req) {
  return req.user?.role === 'viewer';
}

/** Ver / completar cancelar sesión ajena si operador+. Visualizadores: sólo lectura (API rechaza escritura). */
function canModifyControlSession(req, row) {
  if (isViewer(req)) return false;
  if (req.user?.id === row.user_id) return true;
  const r = req.user?.role;
  return r === 'superadmin' || r === 'admin' || r === 'operator';
}

export const deviceControlRouter = express.Router();

/** Antes de GET, marcar sesiones vencidas como completadas. */
deviceControlRouter.use(async (req, res, next) => {
  if (req.method !== 'GET') return next();
  try {
    await maybeFinalizeDeviceControlDebounced();
  } catch {
    /* log en debounce */
  }
  next();
});

/**
 * Sesión activa de panel Homogenización/… para el equipo (visible para todos los que ven el dispositivo).
 */
deviceControlRouter.get('/active', async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'validation', message: 'deviceId required' });
    }
    if (isPinnedFleetDemoEmail(req.user?.email) && !isPinnedFleetDeviceId(req.user?.email, deviceId)) {
      return res.status(403).json({ error: 'forbidden', message: 'device not in fleet scope' });
    }
    const { rows } = await pool.query(
      `SELECT s.*, u.name AS user_name, u.email AS user_email,
              uc.name AS cancelled_by_name, uc.email AS cancelled_by_email
       FROM app_device_control_sessions s
       JOIN app_users u ON u.id = s.user_id
       LEFT JOIN app_users uc ON uc.id = s.cancelled_by_user_id
       WHERE s.device_id = $1 AND s.status = 'active' AND s.archived_at IS NULL
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [deviceId]
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
  if (isPinnedFleetDemoEmail(req.user?.email) && !isPinnedFleetDeviceId(req.user?.email, deviceId)) {
    return res.status(403).json({ error: 'forbidden', message: 'device not in fleet scope' });
  }
  const auditLog = body.auditLog === true && processType === 'Manual';
  if (!['Homogenization', 'Ripening', 'Ventilation', 'Cooling', 'StopPlan', 'Manual'].includes(processType)) {
    return res.status(400).json({ error: 'validation', message: 'invalid processType' });
  }
  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 10000) {
    return res.status(400).json({ error: 'validation', message: 'invalid durationHours' });
  }
  if (isViewer(req)) {
    return res.status(403).json({ error: 'forbidden', message: 'viewers cannot start control sessions' });
  }

  const started = startedAtRaw ? new Date(String(startedAtRaw)) : new Date();
  if (Number.isNaN(started.getTime())) {
    return res.status(400).json({ error: 'validation', message: 'invalid startedAt' });
  }
  const ms = started.getTime() + durationHours * 3600 * 1000;
  const estimatedEnd = auditLog ? started : new Date(ms);
  const sessionStatus = auditLog ? 'completed' : 'active';
  /** STOP PLAN y ajustes manuales (auditLog) pueden registrarse aunque haya seguimiento activo. */
  const skipRipeningGuard = auditLog || processType === 'StopPlan';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!skipRipeningGuard) {
      const { rows: ripeningBusy } = await client.query(
        `SELECT 1 FROM app_ripening_processes
         WHERE deleted_at IS NULL AND status = 'active'
           AND (payload->>'deviceId') = $1
         LIMIT 1`,
        [deviceId]
      );
      if (ripeningBusy.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'device_ripening_active',
          message: 'an active ripening tracking exists for this device; cancel or finish it first',
        });
      }
    }

    if (!auditLog) {
      const { rows: otherCtrl } = await client.query(
        `SELECT id FROM app_device_control_sessions
         WHERE device_id = $1 AND status = 'active' AND user_id <> $2::uuid AND archived_at IS NULL
         LIMIT 1`,
        [deviceId, req.user.id]
      );
      if (otherCtrl.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'device_control_busy',
          message: 'another active control session exists for this device',
        });
      }

      await client.query(
        `UPDATE app_device_control_sessions
         SET status = 'cancelled',
             cancelled_at = now(),
             cancelled_by_user_id = $3::uuid,
             updated_at = now()
         WHERE user_id = $1::uuid AND device_id = $2 AND status = 'active' AND archived_at IS NULL`,
        [req.user.id, deviceId, req.user.id]
      );
    }

    const { rows } = await client.query(
      `INSERT INTO app_device_control_sessions
         (user_id, device_id, process_type, display_label, params, status, started_at, estimated_end_at, duration_hours, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7::timestamptz, $8::timestamptz, $9::numeric, now())
       RETURNING *`,
      [
        req.user.id,
        deviceId,
        processType,
        displayLabel,
        JSON.stringify(params),
        sessionStatus,
        started.toISOString(),
        estimatedEnd.toISOString(),
        durationHours,
      ]
    );
    await client.query('COMMIT');
    const sessionRow = rows[0];
    await writeAudit(req, {
      action: 'device_control.session.start',
      entityType: 'device_control_session',
      entityId: String(sessionRow.id),
      meta: {
        deviceId,
        processType,
        durationHours,
        display_label: sessionRow.display_label,
        auditLog,
      },
    });
    return res.json({ data: sessionRow });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  } finally {
    client.release();
  }
});

/**
 * Listado global (solo lectura diferenciando permisos en el cliente).
 */
deviceControlRouter.get('/sessions', async (req, res) => {
  try {
    const includeArchived = parseIncludeArchived(req);
    if (includeArchived && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'forbidden', message: 'includeArchived requires superadmin' });
    }
    const { rows } = await pool.query(
      `SELECT s.*,
              u.name AS user_name,
              u.email AS user_email,
              uc.name AS cancelled_by_name,
              uc.email AS cancelled_by_email
         FROM app_device_control_sessions s
         JOIN app_users u ON u.id = s.user_id
         LEFT JOIN app_users uc ON uc.id = s.cancelled_by_user_id
        WHERE ($1::boolean = TRUE OR s.archived_at IS NULL)
         ORDER BY s.archived_at NULLS FIRST, s.created_at DESC
         LIMIT 500`,
      [includeArchived]
    );
    let data = rows;
    if (isPinnedFleetDemoEmail(req.user?.email) && req.user?.role !== 'superadmin') {
      data = filterRowsByPinnedFleetDeviceIds(req.user.email, rows, (r) => r.device_id);
    }
    return res.json({ data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

deviceControlRouter.post('/:id/restore', requireSuperAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'validation' });
    const { rows } = await pool.query(
      `UPDATE app_device_control_sessions
       SET archived_at = NULL, updated_at = now()
       WHERE id = $1::uuid AND archived_at IS NOT NULL
       RETURNING *`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    const row = rows[0];
    await writeAudit(req, {
      action: 'device_control.session.restore',
      entityType: 'device_control_session',
      entityId: id,
      meta: { device_id: row.device_id, process_type: row.process_type },
    });
    return res.json({ data: row });
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
      `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid AND archived_at IS NULL`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const row = cur[0];
    if (!canModifyControlSession(req, row)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (row.status !== 'active') {
      return res.json({ data: row });
    }
    const { rows: upd } = await pool.query(
      `UPDATE app_device_control_sessions
       SET status = 'completed', updated_at = now()
       WHERE id = $1::uuid AND archived_at IS NULL
       RETURNING *`,
      [id]
    );
    await writeAudit(req, {
      action: 'device_control.session.complete',
      entityType: 'device_control_session',
      entityId: id,
      meta: { device_id: upd[0]?.device_id, process_type: upd[0]?.process_type },
    });
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
      `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid AND archived_at IS NULL`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const row = cur[0];
    if (!canModifyControlSession(req, row)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (row.status !== 'active') {
      return res.json({ data: row });
    }
    const uid = req.user.id;
    const { rows: upd } = await pool.query(
      `UPDATE app_device_control_sessions
       SET status = 'cancelled',
           cancelled_at = now(),
           cancelled_by_user_id = $2::uuid,
           updated_at = now()
       WHERE id = $1::uuid AND archived_at IS NULL
       RETURNING *`,
      [id, uid]
    );
    await writeAudit(req, {
      action: 'device_control.session.cancel',
      entityType: 'device_control_session',
      entityId: id,
      meta: { device_id: upd[0]?.device_id, process_type: upd[0]?.process_type },
    });
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
      `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid AND archived_at IS NULL`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const row = cur[0];
    if (!canModifyControlSession(req, row)) {
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
       WHERE id = $1::uuid AND archived_at IS NULL
       RETURNING *`,
      [id, displayLabel, JSON.stringify(params), durationHours, estimatedEnd.toISOString()]
    );
    await writeAudit(req, {
      action: 'device_control.session.update',
      entityType: 'device_control_session',
      entityId: id,
      meta: { device_id: upd[0]?.device_id, process_type: upd[0]?.process_type },
    });
    return res.json({ data: upd[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * Archivar registro (no borrado físico). Procesos activos: cancelar antes con POST .../cancel.
 */
deviceControlRouter.delete('/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'validation' });
    const { rows: cur } = await pool.query(
      `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid AND archived_at IS NULL`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const row = cur[0];
    if (!isAdminRole(req)) {
      return res.status(403).json({ error: 'forbidden', message: 'only administrators can archive session rows' });
    }
    if (row.status === 'active') {
      return res.status(400).json({
        error: 'invalid_state',
        message: 'cancel active session first',
      });
    }
    const { rows: upd } = await pool.query(
      `UPDATE app_device_control_sessions
       SET archived_at = now(), updated_at = now()
       WHERE id = $1::uuid AND archived_at IS NULL AND status <> 'active'
       RETURNING *`,
      [id]
    );
    if (!upd.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'device_control.session.archive',
      entityType: 'device_control_session',
      entityId: id,
      meta: {
        device_id: row.device_id,
        process_type: row.process_type,
        prior_status: row.status,
      },
    });
    return res.json({ data: { archived: true, id, row: upd[0] } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
