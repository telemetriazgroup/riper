import express from 'express';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAdmin, requireOperatorPlus, requireSuperAdmin } from '../authMiddleware.js';
import { writeAudit } from '../auditLog.js';
import { fireEmailNotification } from '../emailNotifications.js';
import { maybeFinalizeRipeningDebounced } from '../autoFinalizeDueProcesses.js';
import {
  filterRowsByPinnedFleetDeviceIds,
  isPinnedFleetDeviceId,
  isPinnedFleetDemoEmail,
} from '../demoFleetFilter.js';
import { gourmetLinkedDeviceIds } from '../gourmetFleet.js';
import { cancelActiveControlSessionsForDevice, kickTrackingControlForProcess } from '../ripeningTrackingControl.js';
import {
  applyPauseToPayload,
  applyResumeToPayload,
  buildTimelineControlEvent,
  ensurePlannedDurationOnCreate,
  progressFromTrackingPayload,
  recalcScheduleAfterPayloadEdit,
} from '../ripeningSchedule.js';
import { applyReactivationToPayload, buildClosureSnapshot } from '../ripeningReactivation.js';

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

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_DOC_EXT = /\.(pdf|doc|docx|xls|xlsx|jpe?g|png|webp)$/i;

function isAllowedProcessDocument(file) {
  const mime = String(file.mimetype || '').toLowerCase();
  if (ALLOWED_DOC_MIMES.has(mime)) return true;
  return ALLOWED_DOC_EXT.test(String(file.originalname || ''));
}

const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      cb(null, req._ripenerStaging || STAGING_ROOT);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
      cb(null, `doc-${Date.now()}-${randomBytes(4).toString('hex')}-${base}${ext}`);
    },
  }),
  limits: { files: 1, fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedProcessDocument(file)) cb(null, true);
    else cb(new Error('unsupported document type'));
  },
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

function parseIncludeArchived(req) {
  const v = req.query?.includeArchived ?? req.query?.include_archived;
  return v === true || v === 'true' || v === '1';
}

/** Superadmin puede cargar procesos archivados (deleted_at); el resto solo vigentes. */
async function fetchProcessById(rawId, res, req = null) {
  const id = String(rawId || '').trim();
  if (!id || id === 'files') {
    res.status(400).json({ error: 'validation', message: 'id required' });
    return null;
  }
  const allowArchived = req?.user?.role === 'superadmin';
  const delCond = allowArchived ? '' : 'AND deleted_at IS NULL';
  const { rows } = await pool.query(
    `SELECT * FROM app_ripening_processes
     WHERE id = $1::uuid ${delCond}`,
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
  return fetchProcessById(id, res, req);
}

function toParamRows(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((p, i) => ({
    id: String(i + 1),
    name: p.name,
    value: p.value,
    unit: p.unit,
    ...(p.target != null && String(p.target).trim() !== '' ? { target: String(p.target).trim() } : {}),
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

function progressFromRowPayload(payload, status = 'active') {
  return progressFromTrackingPayload(payload, status);
}

async function userMetaFromReq(req) {
  const uid = req.user.id;
  const { rows } = await pool.query(
    `SELECT name, email FROM app_users WHERE id = $1::uuid AND deleted_at IS NULL`,
    [uid]
  );
  const u = rows[0];
  return {
    userId: uid,
    email: u?.email ?? req.user.email ?? null,
    name: u?.name ?? null,
  };
}

function linkedDeviceIdsForProcess(deviceId) {
  const dev = String(deviceId || '').trim();
  if (!dev) return [];
  const linked = gourmetLinkedDeviceIds(dev);
  return linked.length ? linked : [dev];
}

/** Último seguimiento registrado en el equipo (cualquier estado terminal o activo). */
async function fetchLatestProcessForDevice(deviceId) {
  const ids = linkedDeviceIdsForProcess(deviceId);
  const { rows } = await pool.query(
    `SELECT id, status, updated_at, created_at FROM app_ripening_processes
     WHERE deleted_at IS NULL
       AND (payload->>'deviceId') = ANY($1::text[])
     ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
     LIMIT 1`,
    [ids]
  );
  return rows[0] ?? null;
}

async function assertNoActiveTrackingOnDevice(res, deviceId, excludeId = null) {
  const ids = linkedDeviceIdsForProcess(deviceId);
  const { rows } = await pool.query(
    `SELECT id, display_name, status FROM app_ripening_processes
     WHERE deleted_at IS NULL
       AND status IN ('active', 'paused')
       AND (payload->>'deviceId') = ANY($1::text[])
       AND ($2::uuid IS NULL OR id <> $2::uuid)
     LIMIT 1`,
    [ids, excludeId]
  );
  if (rows.length) {
    res.status(409).json({
      error: 'device_active_process',
      message: 'device already has an active or paused tracking',
      existing: rows[0],
    });
    return false;
  }
  return true;
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

/** Antes de responder GET de seguimiento, completar registros si ya pasó fecha/hora de fin planificada. */
ripeningProcessesRouter.use(async (req, res, next) => {
  if (req.method !== 'GET') return next();
  try {
    await maybeFinalizeRipeningDebounced();
  } catch {
    /* log en debounce */
  }
  next();
});

/**
 * Seguimiento activo en este dispositivo (cualquier usuario); Visualizadores y resto pueden ver estado en panel/detalle.
 */
ripeningProcessesRouter.get('/active-for-device', async (req, res) => {
  const deviceId = String(req.query.deviceId || '').trim();
  if (!deviceId) {
    return res.status(400).json({ error: 'validation', message: 'deviceId query required' });
  }
  if (isPinnedFleetDemoEmail(req.user?.email) && !isPinnedFleetDeviceId(req.user?.email, deviceId)) {
    return res.status(403).json({ error: 'forbidden', message: 'device not in fleet scope' });
  }
  try {
    const linkedIds = gourmetLinkedDeviceIds(deviceId);
    const { rows } = await pool.query(
      `SELECT * FROM app_ripening_processes
       WHERE deleted_at IS NULL
         AND status IN ('active', 'paused')
         AND (payload->>'deviceId') = ANY($1::text[])
       ORDER BY created_at DESC
       LIMIT 1`,
      [linkedIds.length ? linkedIds : [deviceId]]
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
          progress: progressFromRowPayload(p, row.status),
          startedAt: schedule.startedAt || null,
          estimatedEndAt: schedule.estimatedEndAt ?? null,
          status: row.status,
          paused: String(row.status).toLowerCase() === 'paused',
        },
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/** Listar seguimientos (incl. Visualizador). Superadmin puede incluir archivados con ?includeArchived=true */
ripeningProcessesRouter.get('/', async (req, res) => {
  try {
    const includeArchived = parseIncludeArchived(req);
    if (includeArchived && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'forbidden', message: 'includeArchived requires superadmin' });
    }
    const { rows } = await pool.query(
      `SELECT id, user_id, status, display_name, payload, timeline, deleted_at, created_at, updated_at
         FROM app_ripening_processes
        WHERE ($1::boolean = TRUE OR deleted_at IS NULL)
        ORDER BY deleted_at NULLS FIRST, created_at DESC`,
      [includeArchived]
    );
    let data = rows;
    if (isPinnedFleetDemoEmail(req.user?.email) && req.user?.role !== 'superadmin') {
      data = filterRowsByPinnedFleetDeviceIds(req.user.email, rows, (r) => (r.payload || {}).deviceId);
    }
    res.json({ data });
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
    const row = await fetchProcessById(id, res, req);
    if (!row) return;
    res.json({ data: row });
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
    if (isPinnedFleetDemoEmail(req.user?.email) && deviceId && !isPinnedFleetDeviceId(req.user?.email, deviceId)) {
      cleanupStaging();
      return res.status(403).json({ error: 'forbidden', message: 'device not in fleet scope' });
    }
    const dataToStore = { ...data };
    delete dataToStore.replaceActiveProcess;

    const displayName = String(data.name || 'Proceso').trim().slice(0, 500);
    const userLabel = await getUserName(req.user.id);
    const initialPersona =
      String(data.initialSample?.personaEscrita || data.supervisor?.name || '')
        .trim() || userLabel;
    const files = req.files || [];
    let replacedProcessId = null;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (deviceId) {
        await cancelActiveControlSessionsForDevice(
          client,
          deviceId,
          req.user.id,
          'superseded_by_tracking'
        );

        const { rows: actives } = await client.query(
          `SELECT id, display_name, payload FROM app_ripening_processes
           WHERE user_id = $1::uuid AND deleted_at IS NULL
             AND status IN ('active', 'paused')
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
               AND status IN ('active', 'paused')
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
          replacedProcessId = actives[0].id;
        }
      }

      const { rows: ins } = await client.query(
        `INSERT INTO app_ripening_processes (user_id, status, display_name, payload, timeline)
         VALUES ($1::uuid, 'active', $2, $3::jsonb, '[]'::jsonb)
         RETURNING *`,
        [
          req.user.id,
          displayName,
          JSON.stringify({
            ...dataToStore,
            scheduleSummary: ensurePlannedDurationOnCreate(dataToStore),
            _createdBy: { at: new Date().toISOString() },
          }),
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
      const out = up[0];
      const pOut = out.payload || {};
      if (replacedProcessId) {
        await writeAudit(req, {
          action: 'ripening.process.cancel',
          entityType: 'ripening_process',
          entityId: String(replacedProcessId),
          meta: { reason: 'replaced_by_new_same_device', deviceId: deviceId || null },
        });
      }
      await writeAudit(req, {
        action: 'ripening.process.create',
        entityType: 'ripening_process',
        entityId: String(out.id),
        meta: {
          display_name: out.display_name,
          deviceId: pOut.deviceId || null,
        },
      });
      const ripDeviceId = pOut.deviceId ? String(pOut.deviceId).trim() : '';
      if (ripDeviceId) {
        fireEmailNotification({
          deviceId: ripDeviceId,
          eventType: 'tracking_start',
          actorEmail: req.user?.email,
          meta: { display_name: out.display_name, processId: out.id },
        });
        kickTrackingControlForProcess(out.id).catch((e) =>
          console.warn('[tracking-control] kickoff', out.id, e.message)
        );
      }
      return res.status(201).json({ data: out });
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
    if (row.deleted_at) {
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
        error: 'process_archived',
        message: 'archived processes are read-only',
      });
    }
    const samplingAllowed = ['active', 'cancelled', 'completed'].includes(
      String(row.status || '').toLowerCase()
    );
    if (!samplingAllowed) {
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
        message: 'this process state does not accept new samplings',
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
    const updated = rows[0];
    await writeAudit(req, {
      action: 'ripening.sampling.add',
      entityType: 'ripening_process',
      entityId: String(row.id),
      meta: {
        samplingType: type,
        display_name: row.display_name,
        title: newEvent.title,
      },
    });
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const sampDeviceId = payload.deviceId ? String(payload.deviceId).trim() : '';
    if (sampDeviceId) {
      fireEmailNotification({
        deviceId: sampDeviceId,
        eventType: 'sampling',
        actorEmail: req.user?.email,
        meta: {
          samplingType: type,
          display_name: row.display_name,
          title: newEvent.title,
          processId: row.id,
        },
      });
    }
    res.json({ data: updated });
  }
);

/** Documentos del proceso (PDF, Office, imágenes). */
ripeningProcessesRouter.post(
  '/:id/documents',
  requireOperatorPlus,
  stagingDirMiddleware,
  documentUpload.single('file'),
  async (req, res) => {
    const row = await getProcessRowFromReq(req, res);
    if (!row) return;
    if (row.deleted_at) {
      const st = req._ripenerStaging;
      if (st) {
        try {
          fs.rmSync(st, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
      return res.status(403).json({ error: 'process_archived', message: 'archived processes are read-only' });
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
    const file = req.file;
    if (!file) {
      cleanupStaging();
      return res.status(400).json({ error: 'validation', message: 'file required' });
    }
    const description = String(req.body?.description || '').trim().slice(0, 300);
    if (!description) {
      cleanupStaging();
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      return res.status(400).json({ error: 'validation', message: 'description required' });
    }
    const observations = String(req.body?.observations || '').trim().slice(0, 2000) || null;
    const destDir = path.join(RIPENING_DIR, row.id);
    fs.mkdirSync(destDir, { recursive: true });
    const storedName = path.basename(file.path);
    const to = path.join(destDir, storedName);
    if (!to.startsWith(destDir)) {
      cleanupStaging();
      return res.status(400).json({ error: 'validation' });
    }
    try {
      fs.renameSync(file.path, to);
    } catch (e) {
      cleanupStaging();
      return res.status(500).json({ error: 'server_error', message: String(e.message) });
    }
    cleanupStaging();
    const userMeta = await userMetaFromReq(req);
    const docId = `doc-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const apiPath = `/api/v1/ripening-processes/${row.id}/files/${encodeURIComponent(storedName)}`;
    const docEntry = {
      id: docId,
      name: file.originalname || storedName,
      storedName,
      mime: file.mimetype || 'application/octet-stream',
      size: file.size,
      apiPath,
      description,
      observations,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: userMeta.userId,
      uploadedByEmail: userMeta.email,
      uploadedByName: userMeta.name,
    };
    const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
    const docs = Array.isArray(payload.processDocuments) ? payload.processDocuments : [];
    payload.processDocuments = [docEntry, ...docs];
    const timelineEvent = {
      id: `ev-doc-${Date.now()}`,
      type: 'document',
      title: 'Documento adjunto',
      timestamp: docEntry.uploadedAt,
      user: userMeta.name || userMeta.email || 'Usuario',
      persona_escrita: userMeta.name || userMeta.email || 'Usuario',
      registered_by_user_id: userMeta.userId,
      registered_by_email: userMeta.email,
      description,
      data: [
        { name: 'Archivo', value: docEntry.name, unit: '' },
        ...(observations ? [{ name: 'Observaciones', value: observations, unit: '' }] : []),
      ],
      documentId: docId,
      documentApiPath: apiPath,
    };
    const timeline = [timelineEvent, ...(Array.isArray(row.timeline) ? row.timeline : [])];
    const { rows } = await pool.query(
      `UPDATE app_ripening_processes
          SET payload = $2::jsonb, timeline = $3::jsonb, updated_at = now()
        WHERE id = $1::uuid AND deleted_at IS NULL
        RETURNING *`,
      [row.id, JSON.stringify(payload), JSON.stringify(timeline)]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'ripening.document.upload',
      entityType: 'ripening_process',
      entityId: String(row.id),
      meta: { documentId: docId, name: docEntry.name },
    });
    res.status(201).json({ data: rows[0] });
  }
);

ripeningProcessesRouter.delete('/:id/documents/:documentId', requireOperatorPlus, async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  if (row.deleted_at) {
    return res.status(403).json({ error: 'process_archived', message: 'archived processes are read-only' });
  }
  const documentId = String(req.params.documentId || '').trim();
  if (!documentId) {
    return res.status(400).json({ error: 'validation', message: 'documentId required' });
  }
  const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
  const docs = Array.isArray(payload.processDocuments) ? payload.processDocuments : [];
  const idx = docs.findIndex((d) => String(d?.id) === documentId);
  if (idx < 0) {
    return res.status(404).json({ error: 'not_found', message: 'document not found' });
  }
  const doc = docs[idx];
  const storedName = safeRelName(doc.storedName);
  if (storedName) {
    const filePath = path.join(RIPENING_DIR, row.id, storedName);
    if (filePath.startsWith(RIPENING_DIR)) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
  }
  payload.processDocuments = docs.filter((_, i) => i !== idx);
  const { rows } = await pool.query(
    `UPDATE app_ripening_processes SET payload = $2::jsonb, updated_at = now()
     WHERE id = $1::uuid AND deleted_at IS NULL RETURNING *`,
    [row.id, JSON.stringify(payload)]
  );
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  await writeAudit(req, {
    action: 'ripening.document.delete',
    entityType: 'ripening_process',
    entityId: String(row.id),
    meta: { documentId, name: doc.name },
  });
  res.json({ data: rows[0] });
});

ripeningProcessesRouter.patch('/:id', async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  if (row.deleted_at) {
    return res.status(403).json({ error: 'process_archived', message: 'archived processes are read-only' });
  }
  const role = req.user?.role;
  if (role === 'viewer') {
    return res.status(403).json({ error: 'forbidden', message: 'read only' });
  }
  const { status, display_name, payload: bodyPayload } = req.body || {};
  if (String(row.status || '').toLowerCase() === 'completed') {
    return res.status(403).json({ error: 'process_completed', message: 'process is finalized; editing is disabled' });
  }
  const editableStatus = ['active', 'paused'].includes(String(row.status || '').toLowerCase());
  if (bodyPayload != null && isAdminTier && !editableStatus) {
    return res.status(403).json({ error: 'process_not_editable', message: 'process cannot be edited in this state' });
  }
  if (status !== undefined && String(status).trim().toLowerCase() === 'completed') {
    return res.status(400).json({
      error: 'validation',
      message: 'status completed is set automatically when the scheduled end time is reached',
    });
  }
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
    const st = String(status ?? row.status ?? 'active').toLowerCase();
    if (st === 'active' || st === 'paused') {
      mergedPayload.scheduleSummary = recalcScheduleAfterPayloadEdit(
        mergedPayload,
        basePayload,
        st
      );
    }
  }

  const rowStatus = String(status ?? row.status ?? '').toLowerCase();
  if (rowStatus === 'paused' && bodyPayload != null) {
    return res.status(400).json({
      error: 'validation',
      message: 'use POST /pause and /resume endpoints to change pause state',
    });
  }
  if (status !== undefined && String(status).trim().toLowerCase() === 'paused') {
    return res.status(400).json({
      error: 'validation',
      message: 'use POST /pause endpoint to pause tracking',
    });
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
      _closureSnapshot: buildClosureSnapshot(
        basePayload,
        String(row.status || 'active'),
        'cancelled',
        Date.now()
      ),
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
    const updated = rows[0];
    const st = updated.status;
    const isCancel = String(st).toLowerCase() === 'cancelled';
    await writeAudit(req, {
      action: isCancel ? 'ripening.process.cancel' : 'ripening.process.update',
      entityType: 'ripening_process',
      entityId: String(updated.id),
      meta: {
        status: updated.status,
        display_name: updated.display_name,
        cancelled: isCancel,
      },
    });
    res.json({ data: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/** Pausar seguimiento: detiene automatización y permite control manual. */
ripeningProcessesRouter.post('/:id/pause', requireOperatorPlus, async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  if (row.deleted_at) {
    return res.status(403).json({ error: 'process_archived', message: 'archived processes are read-only' });
  }
  if (String(row.status).toLowerCase() !== 'active') {
    return res.status(400).json({ error: 'validation', message: 'only active tracking can be paused' });
  }
  try {
    const userMeta = await userMetaFromReq(req);
    const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
    const nextPayload = applyPauseToPayload(payload, userMeta);
    const ev = buildTimelineControlEvent('pause', 'Seguimiento pausado', userMeta, {
      description: 'Automatización detenida; control manual habilitado.',
    });
    const timeline = [ev, ...(Array.isArray(row.timeline) ? row.timeline : [])];
    const { rows } = await pool.query(
      `UPDATE app_ripening_processes
          SET status = 'paused', payload = $2::jsonb, timeline = $3::jsonb, updated_at = now()
        WHERE id = $1::uuid AND deleted_at IS NULL AND status = 'active'
        RETURNING *`,
      [row.id, JSON.stringify(nextPayload), JSON.stringify(timeline)]
    );
    if (!rows.length) return res.status(409).json({ error: 'conflict', message: 'state changed' });
    const updated = rows[0];
    await writeAudit(req, {
      action: 'ripening.process.pause',
      entityType: 'ripening_process',
      entityId: String(updated.id),
      meta: { display_name: updated.display_name },
    });
    res.json({ data: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/** Reanudar seguimiento pausado; extiende fin por tiempo pausado. */
ripeningProcessesRouter.post('/:id/resume', requireOperatorPlus, async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  if (row.deleted_at) {
    return res.status(403).json({ error: 'process_archived', message: 'archived processes are read-only' });
  }
  if (String(row.status).toLowerCase() !== 'paused') {
    return res.status(400).json({ error: 'validation', message: 'only paused tracking can be resumed' });
  }
  try {
    const userMeta = await userMetaFromReq(req);
    const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
    const nextPayload = applyResumeToPayload(payload);
    const ev = buildTimelineControlEvent('resume', 'Seguimiento reanudado', userMeta, {
      description: 'Automatización retomada; fin ajustado por tiempo pausado.',
      data: [
        {
          name: 'Fin estimado',
          value: nextPayload.scheduleSummary?.estimatedEndAt ?? '—',
          unit: '',
        },
      ],
    });
    const timeline = [ev, ...(Array.isArray(row.timeline) ? row.timeline : [])];
    const { rows } = await pool.query(
      `UPDATE app_ripening_processes
          SET status = 'active', payload = $2::jsonb, timeline = $3::jsonb, updated_at = now()
        WHERE id = $1::uuid AND deleted_at IS NULL AND status = 'paused'
        RETURNING *`,
      [row.id, JSON.stringify(nextPayload), JSON.stringify(timeline)]
    );
    if (!rows.length) return res.status(409).json({ error: 'conflict', message: 'state changed' });
    const updated = rows[0];
    await writeAudit(req, {
      action: 'ripening.process.resume',
      entityType: 'ripening_process',
      entityId: String(updated.id),
      meta: { display_name: updated.display_name },
    });
    kickTrackingControlForProcess(updated.id).catch((e) =>
      console.warn('[tracking-control] resume kickoff', updated.id, e.message)
    );
    res.json({ data: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/** Superadmin: reactivar seguimiento completado o cancelado con extensión en horas. */
ripeningProcessesRouter.post('/:id/reactivate', requireSuperAdmin, async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  if (row.deleted_at) {
    return res.status(403).json({ error: 'process_archived', message: 'archived processes are read-only' });
  }
  const previousStatus = String(row.status || '').toLowerCase();
  if (previousStatus !== 'completed' && previousStatus !== 'cancelled') {
    return res.status(400).json({
      error: 'validation',
      message: 'only completed or cancelled tracking can be reactivated',
    });
  }
  const extensionHours = Number(req.body?.extensionHours);
  if (!Number.isFinite(extensionHours) || extensionHours <= 0) {
    return res.status(400).json({
      error: 'validation',
      message: 'extensionHours (positive number) is required',
    });
  }
  const note = req.body?.note != null ? String(req.body.note).trim().slice(0, 500) : '';

  const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
  const deviceId = String(payload.deviceId || '').trim();
  if (!deviceId) {
    return res.status(400).json({ error: 'validation', message: 'process has no linked device' });
  }
  try {
    const latest = await fetchLatestProcessForDevice(deviceId);
    if (!latest || String(latest.id) !== String(row.id)) {
      return res.status(409).json({
        error: 'not_latest_process',
        message: 'only the most recent process on this device can be reactivated',
        latestId: latest?.id ?? null,
      });
    }
    if (!(await assertNoActiveTrackingOnDevice(res, deviceId, row.id))) return;

    const userMeta = await userMetaFromReq(req);
    const { payload: nextPayload, timelineEvent, summary } = applyReactivationToPayload(payload, {
      extensionHours,
      previousStatus,
      rowUpdatedAt: row.updated_at,
      userMeta,
      note: note || null,
    });

    const timeline = [timelineEvent, ...(Array.isArray(row.timeline) ? row.timeline : [])];

    const { rows } = await pool.query(
      `UPDATE app_ripening_processes
          SET status = 'active', payload = $2::jsonb, timeline = $3::jsonb, updated_at = now()
        WHERE id = $1::uuid AND deleted_at IS NULL AND status = ANY($4::text[])
        RETURNING *`,
      [row.id, JSON.stringify(nextPayload), JSON.stringify(timeline), ['completed', 'cancelled']]
    );
    if (!rows.length) return res.status(409).json({ error: 'conflict', message: 'state changed' });
    const updated = rows[0];
    await writeAudit(req, {
      action: 'ripening.process.reactivate',
      entityType: 'ripening_process',
      entityId: String(updated.id),
      meta: {
        display_name: updated.display_name,
        deviceId,
        extensionHours,
        closureAt: summary.closure?.at,
        phaseLabel: summary.closure?.phaseLabel,
      },
    });
    kickTrackingControlForProcess(updated.id).catch((e) =>
      console.warn('[tracking-control] reactivate kickoff', updated.id, e.message)
    );
    res.json({ data: updated, summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ripeningProcessesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const row = await getProcessRowFromReq(req, res);
  if (!row) return;
  if (row.deleted_at) {
    return res.status(400).json({ error: 'already_archived', message: 'process already archived' });
  }
  try {
    await pool.query(
      `UPDATE app_ripening_processes SET deleted_at = now(), updated_at = now() WHERE id = $1::uuid`,
      [row.id]
    );
    await writeAudit(req, {
      action: 'ripening.process.delete',
      entityType: 'ripening_process',
      entityId: String(row.id),
      meta: { display_name: row.display_name, soft: true },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});
