import express from 'express';
import { pool } from '../db.js';
import { requireSuperAdmin } from '../authMiddleware.js';

export const auditRouter = express.Router();

function rowToApi(row) {
  return {
    id: String(row.id),
    created_at: row.created_at,
    actor_user_id: row.actor_user_id,
    actor_email: row.actor_email,
    actor_role: row.actor_role,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    meta: row.meta,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  };
}

/**
 * Listado para el módulo Auditoría (solo superadmin). Los registros no se eliminan.
 * Paginación: ?limit=80&beforeId=<id del registro más antiguo de la página anterior>
 */
auditRouter.get('/logs', requireSuperAdmin, async (req, res) => {
  const rawLimit = parseInt(String(req.query.limit || '80'), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, rawLimit)) : 80;
  const beforeId = req.query.beforeId != null && String(req.query.beforeId).trim() !== ''
    ? String(req.query.beforeId).trim()
    : null;
  try {
    const params = [limit];
    let where = '';
    if (beforeId && /^\d+$/.test(beforeId)) {
      params.push(beforeId);
      where = `WHERE id < $${params.length}::bigint`;
    }
    const { rows } = await pool.query(
      `SELECT id, created_at, actor_user_id, actor_email, actor_role, action, entity_type, entity_id, meta, ip_address, user_agent
       FROM app_audit_logs
       ${where}
       ORDER BY id DESC
       LIMIT $1`,
      params
    );
    const nextBeforeId = rows.length === limit ? String(rows[rows.length - 1].id) : null;
    res.json({ data: rows.map(rowToApi), nextBeforeId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
