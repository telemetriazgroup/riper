import express from 'express';
import { pool } from '../db.js';

export const deviceProcessFollowRouter = express.Router();

const MAX_DEVICE_ID = 128;
const MAX_PROCESO = 128;

function normalizeDeviceId(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s.length > MAX_DEVICE_ID) return null;
  return s;
}

/**
 * GET /list — todos los seguimientos del usuario (para validar flota / tarjetas).
 */
deviceProcessFollowRouter.get('/list', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const r = await pool.query(
      `SELECT device_id, proceso, id_proceso, fecha_inicio, hasta, progress, numero_alarma, updated_at
       FROM app_user_device_process_follow
       WHERE user_id = $1::uuid
       ORDER BY updated_at DESC`,
      [userId]
    );
    res.json({ data: r.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * GET /device/:deviceId — seguimiento guardado (snapshot sincronizado) para el usuario actual y ese IMEI/dispositivo.
 */
deviceProcessFollowRouter.get('/device/:deviceId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const deviceId = normalizeDeviceId(req.params.deviceId);
    if (!deviceId) return res.status(400).json({ error: 'invalid_device_id' });

    const r = await pool.query(
      `SELECT device_id, proceso, id_proceso, fecha_inicio, hasta, progress, numero_alarma, updated_at
       FROM app_user_device_process_follow
       WHERE user_id = $1::uuid AND device_id = $2`,
      [userId, deviceId]
    );
    if (!r.rows.length) return res.json({ data: null });
    return res.json({ data: r.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * DELETE /device/:deviceId — elimina el seguimiento para poder iniciar otros procesos desde el panel.
 */
deviceProcessFollowRouter.delete('/device/:deviceId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const deviceId = normalizeDeviceId(req.params.deviceId);
    if (!deviceId) return res.status(400).json({ error: 'invalid_device_id' });

    await pool.query(
      `DELETE FROM app_user_device_process_follow WHERE user_id = $1::uuid AND device_id = $2`,
      [userId, deviceId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

function toTs(iso) {
  if (iso == null || iso === '') return null;
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * POST /sync  body: { items: [{ device_id, proceso, id_proceso, fecha_inicio, hasta, progress, numero_alarma }] }
 * Upsert por usuario y dispositivo (estado mostrado en panel / API).
 */
deviceProcessFollowRouter.post('/sync', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length > 400) {
      return res.status(400).json({ error: 'too_many_items' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const it of items) {
        const deviceId = normalizeDeviceId(it.device_id);
        if (!deviceId) continue;

        const proceso = String(it.proceso ?? '')
          .trim()
          .slice(0, MAX_PROCESO);
        const idProceso =
          it.id_proceso != null && it.id_proceso !== '' ? Number(it.id_proceso) : null;
        const idProcesoSql = Number.isFinite(idProceso) ? Math.trunc(idProceso) : null;
        const fi = toTs(it.fecha_inicio);
        const hasta = toTs(it.hasta);
        const progress =
          it.progress != null && it.progress !== '' ? Math.min(100, Math.max(0, Math.round(Number(it.progress)))) : null;
        const numAl = Math.max(0, Math.round(Number(it.numero_alarma ?? 0)));

        await client.query(
          `INSERT INTO app_user_device_process_follow
            (user_id, device_id, proceso, id_proceso, fecha_inicio, hasta, progress, numero_alarma, updated_at)
           VALUES ($1::uuid, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, now())
           ON CONFLICT (user_id, device_id) DO UPDATE SET
             proceso = EXCLUDED.proceso,
             id_proceso = EXCLUDED.id_proceso,
             fecha_inicio = EXCLUDED.fecha_inicio,
             hasta = EXCLUDED.hasta,
             progress = EXCLUDED.progress,
             numero_alarma = EXCLUDED.numero_alarma,
             updated_at = now()`,
          [userId, deviceId, proceso, idProcesoSql, fi, hasta, progress, numAl]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
