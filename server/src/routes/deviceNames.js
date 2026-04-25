import express from 'express';
import { pool } from '../db.js';

export const deviceNamesRouter = express.Router();

const MAX_DEVICE_ID = 128;
const MAX_NAME = 255;

function normalizeDeviceId(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s.length > MAX_DEVICE_ID) return null;
  return s;
}

/** GET → { data: { [device_id]: display_name } } */
deviceNamesRouter.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { rows } = await pool.query(
      `SELECT device_id, display_name FROM app_user_device_names WHERE user_id = $1::uuid`,
      [userId]
    );
    const data = {};
    for (const r of rows) {
      data[String(r.device_id)] = String(r.display_name);
    }
    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/**
 * PUT /:deviceId  body: { display_name: string }
 * Vacío → borra alias (vuelve al nombre que venga de la API / IMEI en el cliente).
 */
deviceNamesRouter.put('/:deviceId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const deviceId = normalizeDeviceId(req.params.deviceId);
    if (!deviceId) return res.status(400).json({ error: 'invalid_device_id' });

    const displayName = String(req.body?.display_name ?? '').trim().slice(0, MAX_NAME);

    if (!displayName) {
      await pool.query(
        `DELETE FROM app_user_device_names WHERE user_id = $1::uuid AND device_id = $2`,
        [userId, deviceId]
      );
      return res.json({ ok: true, deleted: true });
    }

    await pool.query(
      `INSERT INTO app_user_device_names (user_id, device_id, display_name, updated_at)
       VALUES ($1::uuid, $2, $3, now())
       ON CONFLICT (user_id, device_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
      [userId, deviceId, displayName]
    );
    res.json({ ok: true, display_name: displayName });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
