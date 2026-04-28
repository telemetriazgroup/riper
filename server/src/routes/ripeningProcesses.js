import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAdmin, requireOperatorPlus } from '../authMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_ROOT = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
const RIPENING_DIR = path.join(UPLOAD_ROOT, 'ripening-processes');
const STAGING_ROOT = path.join(UPLOAD_ROOT, 'ripening-staging');

export function ensureRipeningUploadDirs() {
  fs.mkdirSync(RIPENING_DIR, { recursive: true });
  fs.mkdirSync(STAGING_ROOT, { recursive: true });
}

function isAdminRole(req) {
  const r = req.user?.role;
  return r === 'superadmin' || r === 'admin';
}

function stagingDirMiddleware(req, res, next) {
  const dir = path.join(STAGING_ROOT, randomBytes(16).toString('hex'));
  try {
    fs.mkdirSync(dir, { recursive: true });
    req._ripenerStaging = dir;
    next();
  } catch (e) {
    next(e);
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, req._ripenerStaging || STAGING_ROOT);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
      cb(null, `${Date.now()}-${randomBytes(4).toString('hex')}-${base}${ext}`);
    },
  }),
  limits: { files: 24, fileSize: 6 * 1024 * 1024 },
});

function safeRelName(name) {
  const n = String(name || 'file');
  if (n.includes('..') || n.includes('/') || n.includes('\\')) return null;
  return n;
}

async function getUserName(userId) {
  const { rows } = await pool.query(`SELECT name, email FROM app_users WHERE id = $1::uuid`, [userId]);
  if (!rows.length) return 'Usuario';
  return rows[0].name || rows[0].email || 'Usuario';
}

async function fetchProcessById(rawId, res) {
  const id = String(rawId || '').trim();
  if (!id || id === 'files') {
    res.status(400).json({ error: 'validation', message: 'id required' });
    return null;
  }
  const { rows } = await pool.query(
    `SELECT * FROM app_ripening_processes
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  );
  if (!rows.length) {
    res.status(404).json({ error: 'not_found', message: 'process not found' });
    return null;
  }
  return rows[0];
}

async function getProcessRowFromReq(req, res) {
  const { id } = req.params;
  return fetchProcessById(id, res);
}

function toParamRows(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((p, i) => ({
    id: String(i + 1),
    name: p.name,
    value: p.value,
    unit: p.unit,
  }));
}

function buildInitialTimelineEvent(
  rowId,
  data,
  evidence,
  { personaEscrita, registeredByUserId, registeredByEmail }
) {
  const s = data.initialSample || {};
  const startedAt = data.scheduleSummary?.startedAt || new Date().toISOString();
  const displayPersona = String(personaEscrita || '').trim() || '—';
  return {
    id: `ev-initial-${rowId.slice(0, 8)}`,
    type: 'sampling',
    title: 'Muestreo Inicial / Recepción',
    timestamp: startedAt,
    user: displayPersona,
    persona_escrita: displayPersona,
    registered_by_user_id: registeredByUserId,
    registered_by_email: registeredByEmail,
    description: s.notes || undefined,
    data: toParamRows(s.parameters),
    images: (evidence || []).map((e) => ({
      url: e.apiPath,
      desc: e.name || 'Evidencia',
    })),
  };
}

function progressFromRowPayload(payload) {
  if (!payload || typeof payload !== 'object') return 0;
  const schedule = payload.scheduleSummary || {};
  const s = schedule.startedAt;
  if (!s) return 0;
  const start = new Date(s).getTime();
  const now = Date.now();
  const totalHours = Number(schedule.totalDurationHours) || 0;
  const est = schedule.estimatedEndAt;
  let end;
  if (est) {
    end = new Date(est).getTime();
  } else if (totalHours > 0) {
    end = start + totalHours * 3600 * 1000;
  } else {
    return 0;
  }
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.min(100, Math.round(((now - start) / (end - start)) * 100));
}

function mapRecipeTargets(payload) {
  const r = payload.recipe || {};
  if (r.targets && typeof r.targets === 'object') {
    return {
      brix: r.targets.brix != null ? String(r.targets.brix) : '—',
      firmness: r.targets.firmness != null ? String(r.targets.firmness) : '—',
      color: r.targets.color != null ? String(r.targets.color) : '—',
    };
  }
  const objs = payload.objectives;
  if (Array.isArray(objs) && objs.length) {
    const by = (s) => objs.find((o) => (o.name || '').toLowerCase().includes(s));
    return {
      brix: (by('brix') || by('Brix') || by('°'))?.value ?? '—',
      firmness: (by('firme') || by('Firmeza'))?.value ?? '—',
      color: (by('color') || by('Color'))?.value ?? '—',
    };
  }
  return { brix: '—', firmness: '—', color: '—' };
}

export const ripeningProcessesRouter = express.Router();

/**
 * Seguimiento activo en este dispositivo (cualquier usuario); Visualizadores y resto pueden ver estado en panel/detalle.
 */
ripeningProcessesRouter.get('/active-for-device', async (req, res) => {
  const deviceId = String(req.query.deviceId || '').trim();
  if (!deviceId) {
    return res.status(400).json({ error: 'validation', message: 'deviceId query required' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM app_ripening_processes
       WHERE deleted_at IS NULL
         AND status = 'active'
         AND (payload->>'deviceId') = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [deviceId]
    );
    if (!rows.length) {
      return res.json({ data: null });
    }
    const row = rows[0];
    const p = row.payload || {};
    const clientName = p.client?.name || '—';
    const product = p.batch?.product || '—';
    const schedule = p.scheduleSummary || {};
    return res.json({
      data: {
        process: row,
        summary: {
          id: row.id,
          display_name: row.display_name,
          client: clientName,
          product,
          deviceId: p.deviceId || deviceId,
          progress: progressFromRowPayload(p),
          startedAt: schedule.startedAt || null,
          estimatedEndAt: schedule.estimatedEndAt ?? null,
        },
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/** Listar todos los seguimientos (incl. Visualizador) para ver procesos en curso */
ripeningProcessesRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, status, display_name, payload, timeline, created_at, updated_at
         FROM app_ripening_processes
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC`
    );
    res.json({ data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ripeningProcessesRouter.get('/:id/files/:filename', async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  const name = safeRelName(req.params.filename);
  if (!name) {
    return res.status(400).json({ error: 'validation', message: 'bad filename' });
  }
  const filePath = path.join(RIPENING_DIR, row.id, name);
  if (!filePath.startsWith(RIPENING_DIR)) {
    return res.status(400).json({ error: 'validation' });
  }
  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.sendFile(filePath, { maxAge: '1h' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

ripeningProcessesRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'files') {
      return res.status(400).json({ error: 'validation' });
    }
    const { rows } = await pool.query(
      `SELECT * FROM app_ripening_processes
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ data: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ripeningProcessesRouter.post(
  '/',
  requireAdmin,
  stagingDirMiddleware,
  upload.array('evidence', 24),
  async (req, res) => {
    const staging = req._ripenerStaging;
    const cleanupStaging = () => {
      if (!staging) return;
      try {
        fs.rmSync(staging, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    };
    let data;
    try {
      const raw = req.body?.data;
      if (!raw) {
        cleanupStaging();
        return res.status(400).json({ error: 'validation', message: 'data field required' });
      }
      data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      cleanupStaging();
      return res.status(400).json({ error: 'validation', message: 'invalid json in data' });
    }
    if (!data.client?.name) {
      cleanupStaging();
      return res.status(400).json({ error: 'validation', message: 'client.name required' });
    }
    if (!data.initialSample?.notes?.trim()) {
      cleanupStaging();
      return res.status(400).json({ error: 'validation', message: 'initial sample notes required' });
    }
    if (!data.supervisor?.name?.trim()) {
      cleanupStaging();
      return res.status(400).json({ error: 'validation', message: 'supervisor name required' });
    }
    const replaceActive = data.replaceActiveProcess === true;
    const deviceId = String(data.deviceId || '').trim();
    const dataToStore = { ...data };
    delete dataToStore.replaceActiveProcess;

    const displayName = String(data.name || 'Proceso').trim().slice(0, 500);
    const userLabel = await getUserName(req.user.id);
    const initialPersona =
      String(data.initialSample?.personaEscrita || data.supervisor?.name || '')
        .trim() || userLabel;
    const files = req.files || [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (deviceId) {
        const { rows: actives } = await client.query(
          `SELECT id, display_name, payload FROM app_ripening_processes
           WHERE user_id = $1::uuid AND deleted_at IS NULL
             AND status = 'active'
             AND (payload->>'deviceId') = $2
           FOR UPDATE`,
          [req.user.id, deviceId]
        );
        if (actives.length) {
          if (!replaceActive) {
            await client.query('ROLLBACK');
            cleanupStaging();
            const ex = actives[0];
            const p = ex.payload || {};
            return res.status(409).json({
              error: 'device_active_process',
              message: 'device already has an active process for this user',
              existing: {
                id: ex.id,
                display_name: ex.display_name,
                client: p.client?.name || '—',
                product: p.batch?.product || '—',
                progress: progressFromRowPayload(p),
                deviceId,
              },
            });
          }
          await client.query(
            `UPDATE app_ripening_processes
             SET status = 'cancelled',
                 updated_at = now(),
                 payload = jsonb_set(
                   COALESCE(payload, '{}'::jsonb),
                   '{_cancelledMeta}',
                   $2::jsonb,
                   true
                 )
             WHERE user_id = $1::uuid AND deleted_at IS NULL
               AND status = 'active'
               AND (payload->>'deviceId') = $3`,
            [
              req.user.id,
              {
                at: new Date().toISOString(),
                reason: 'replaced_by_new_process_same_device',
                byUserId: req.user.id,
                byEmail: req.user.email || null,
              },
              deviceId,
            ]
          );
        }
      }

      const { rows: ins } = await client.query(
        `INSERT INTO app_ripening_processes (user_id, status, display_name, payload, timeline)
         VALUES ($1::uuid, 'active', $2, $3::jsonb, '[]'::jsonb)
         RETURNING *`,
        [
          req.user.id,
          displayName,
          JSON.stringify({ ...dataToStore, _createdBy: { at: new Date().toISOString() } }),
        ]
      );
      const row = ins[0];
      const dest = path.join(RIPENING_DIR, row.id);
      fs.mkdirSync(dest, { recursive: true });
      const evidenceMeta = [];
      for (const f of files) {
        const from = f.path;
        const destName = path.basename(from);
        const to = path.join(dest, destName);
        fs.renameSync(from, to);
        evidenceMeta.push({ name: f.originalname, storedName: destName, size: f.size, mime: f.mimetype });
      }
      cleanupStaging();
      const p = { ...row.payload, initialSample: { ...dataToStore.initialSample, evidencePhotos: evidenceMeta } };
      const apiBase = '/api/v1/ripening-processes';
      const evidence = evidenceMeta.map((e) => ({
        name: e.name,
        apiPath: `${apiBase}/${row.id}/files/${encodeURIComponent(e.storedName)}`,
      }));
      p.initialSample = {
        ...p.initialSample,
        evidencePhotos: evidenceMeta.map((e, i) => ({
          name: e.name,
          storedName: e.storedName,
          size: e.size,
          mime: e.mime,
          url: evidence[i].apiPath,
        })),
      };
      p.recipe = { ...p.recipe, targets: mapRecipeTargets(p) };
      const ev = buildInitialTimelineEvent(row.id, p, evidence, {
        personaEscrita: initialPersona,
        registeredByUserId: req.user.id,
        registeredByEmail: req.user.email || null,
      });
      const { rows: up } = await client.query(
        `UPDATE app_ripening_processes SET payload = $2::jsonb, timeline = $3::jsonb, updated_at = now()
         WHERE id = $1::uuid
         RETURNING *`,
        [row.id, JSON.stringify(p), JSON.stringify([ev])]
      );
      await client.query('COMMIT');
      return res.status(201).json({ data: up[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      cleanupStaging();
      console.error(e);
      return res.status(500).json({ error: 'server_error', message: String(e.message) });
    } finally {
      client.release();
    }
  }
);

/** Añadir muestreo (timeline + archivos opcionales) */
ripeningProcessesRouter.post(
  '/:id/sampling',
  requireOperatorPlus,
  stagingDirMiddleware,
  upload.array('evidence', 24),
  async (req, res) => {
    const row = await getProcessRowFromReq(req, res);
    if (!row) return;
    if (row.status !== 'active') {
      const cleanupStagingErr = () => {
        const st = req._ripenerStaging;
        if (!st) return;
        try {
          fs.rmSync(st, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      };
      cleanupStagingErr();
      return res.status(403).json({
        error: 'process_not_active',
        message: 'only active processes accept new samplings',
      });
    }
    const staging = req._ripenerStaging;
    const cleanupStaging = () => {
      if (!staging) return;
      try {
        fs.rmSync(staging, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    };
    let body;
    try {
      const raw = req.body?.data;
      if (!raw) {
        cleanupStaging();
        return res.status(400).json({ error: 'validation', message: 'data field required' });
      }
      body = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      cleanupStaging();
      return res.status(400).json({ error: 'validation', message: 'invalid json' });
    }
    const { samplingType, parameters, notes, personaEscrita } = body;
    const type = ['initial', 'monitoring', 'final'].includes(samplingType) ? samplingType : 'monitoring';
    const titleBy = {
      initial: 'Muestreo de Inicio',
      monitoring: 'Muestreo de Seguimiento',
      final: 'Muestreo de Cierre / Liberación',
    };
    const defaultName = await getUserName(req.user.id);
    const displayPersona = String(personaEscrita || '')
      .trim() || defaultName;
    const files = req.files || [];
    const dest = path.join(RIPENING_DIR, row.id);
    fs.mkdirSync(dest, { recursive: true });
    const images = [];
    for (const f of files) {
      const to = path.join(dest, path.basename(f.path));
      fs.renameSync(f.path, to);
      const storedName = path.basename(to);
      const apiPath = `/api/v1/ripening-processes/${row.id}/files/${encodeURIComponent(storedName)}`;
      images.push({ url: apiPath, desc: f.originalname || 'Evidencia' });
    }
    cleanupStaging();
    const newEvent = {
      id: `ev-${Date.now()}`,
      type: 'sampling',
      title: titleBy[type] || titleBy.monitoring,
      timestamp: new Date().toISOString(),
      user: displayPersona,
      persona_escrita: String(personaEscrita || '').trim() || displayPersona,
      registered_by_user_id: req.user.id,
      registered_by_email: req.user.email || null,
      description: notes || undefined,
      data: toParamRows(Array.isArray(parameters) ? parameters : []),
      images,
    };
    const timeline = Array.isArray(row.timeline) ? row.timeline : [];
    const next = [newEvent, ...timeline];
    const { rows } = await pool.query(
      `UPDATE app_ripening_processes SET timeline = $2::jsonb, updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NULL
       RETURNING *`,
      [row.id, JSON.stringify(next)]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ data: rows[0] });
  }
);

ripeningProcessesRouter.patch('/:id', async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  const role = req.user?.role;
  if (role === 'viewer') {
    return res.status(403).json({ error: 'forbidden', message: 'read only' });
  }
  const { status, display_name, payload: bodyPayload } = req.body || {};
  if (role === 'operator') {
    if (display_name != null || bodyPayload != null) {
      return res.status(403).json({ error: 'forbidden', message: 'operator may only cancel (status)' });
    }
    if (status == null || String(status).toLowerCase() !== 'cancelled') {
      return res.status(400).json({
        error: 'validation',
        message: 'operator can only set status to cancelled',
      });
    }
  }

  const isAdminTier = role === 'superadmin' || role === 'admin';
  const basePayload =
    row.payload != null && typeof row.payload === 'object' ? { ...row.payload } : {};
  let mergedPayload = basePayload;

  if (isAdminTier && bodyPayload != null && typeof bodyPayload === 'object') {
    mergedPayload = { ...mergedPayload, ...bodyPayload };
  }

  if (status !== undefined && String(status).trim().toLowerCase() === 'cancelled') {
    const uid = req.user.id;
    const { rows: urows } = await pool.query(
      `SELECT name, email FROM app_users WHERE id = $1::uuid AND deleted_at IS NULL`,
      [uid]
    );
    const unm = urows[0];
    mergedPayload = {
      ...mergedPayload,
      _cancelledMeta: {
        at: new Date().toISOString(),
        byUserId: uid,
        byEmail: unm?.email != null ? String(unm.email) : req.user.email || null,
        byName: unm?.name != null ? String(unm.name) : null,
      },
    };
  }

  const mustWritePayload =
    (isAdminTier && bodyPayload != null && typeof bodyPayload === 'object') ||
    (status !== undefined && String(status).trim().toLowerCase() === 'cancelled');

  const parts = [];
  const vals = [row.id];
  let i = 2;
  if (status !== undefined) {
    parts.push(`status = $${i++}`);
    vals.push(String(status).slice(0, 32));
  }
  if (display_name !== undefined) {
    parts.push(`display_name = $${i++}`);
    vals.push(String(display_name).slice(0, 500));
  }
  if (mustWritePayload) {
    parts.push(`payload = $${i++}::jsonb`);
    vals.push(JSON.stringify(mergedPayload));
  }

  if (!parts.length) {
    return res.status(400).json({ error: 'validation', message: 'nothing to update' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE app_ripening_processes SET ${parts.join(', ')}, updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NULL
       RETURNING *`,
      vals
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ data: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ripeningProcessesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  try {
    await pool.query(
      `UPDATE app_ripening_processes SET deleted_at = now(), updated_at = now() WHERE id = $1::uuid`,
      [row.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});
