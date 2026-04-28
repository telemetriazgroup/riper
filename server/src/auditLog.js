import { pool } from './db.js';

/** Registro append-only; nunca borrar filas de `app_audit_logs`. */
export async function writeAudit(req, { action, entityType, entityId = null, meta = {} }) {
  try {
    let ip = req.socket?.remoteAddress || null;
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) {
      ip = xf.split(',')[0].trim().slice(0, 128);
    } else if (Array.isArray(xf) && xf[0]) {
      ip = String(xf[0]).trim().slice(0, 128);
    }
    const ua = req.get?.('User-Agent') || null;
    await pool.query(
      `INSERT INTO app_audit_logs (
         actor_user_id, actor_email, actor_role, action, entity_type, entity_id, meta, ip_address, user_agent
       ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        req.user?.id || null,
        req.user?.email || null,
        req.user?.role || null,
        String(action).slice(0, 96),
        String(entityType).slice(0, 64),
        entityId != null ? String(entityId).slice(0, 128) : null,
        JSON.stringify(meta && typeof meta === 'object' ? meta : {}),
        typeof ip === 'string' ? ip.slice(0, 128) : null,
        ua,
      ]
    );
  } catch (e) {
    console.error('[audit] writeAudit failed:', e.message);
  }
}
