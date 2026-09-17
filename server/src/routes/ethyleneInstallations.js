import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import {
  ackNotice,
  addPhoto,
  cancelInstallationTest,
  createInstallation,
  getInstallationById,
  listDoses,
  listInstallationsForDevice,
  listPendingNotices,
  listPhotos,
  serializeInstallation,
  startInstallationTest,
} from '../ethyleneInstallation.js';

export const ethyleneInstallationsRouter = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_ROOT = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
const INSTALL_DIR = path.join(UPLOAD_ROOT, 'ethylene-installations');
const STAGING_ROOT = path.join(UPLOAD_ROOT, 'ethylene-install-staging');

for (const d of [UPLOAD_ROOT, INSTALL_DIR, STAGING_ROOT]) {
  try {
    fs.mkdirSync(d, { recursive: true });
  } catch {
    /* ignore */
  }
}

const PHOTO_KINDS = new Set(['cylinder', 'flowmeter', 'flowmeter_lpm', 'other']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, STAGING_ROOT),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const base = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(0, 80);
      cb(null, `${Date.now()}-${randomBytes(4).toString('hex')}-${base}${ext}`);
    },
  }),
  limits: { files: 8, fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (mime.startsWith('image/')) cb(null, true);
    else cb(new Error('only images allowed'));
  },
});

function photoApiPath(installationId, storedName) {
  return `/api/v1/ethylene-installations/${installationId}/files/${encodeURIComponent(storedName)}`;
}

function serializePhoto(p, installationId) {
  const storedName = path.basename(p.file_path);
  return {
    id: p.id,
    kind: p.kind,
    original_name: p.original_name,
    url: photoApiPath(installationId, storedName),
    created_at: p.created_at ? new Date(p.created_at).toISOString() : null,
  };
}

function serializeDose(d) {
  return {
    id: d.id,
    occurred_at: d.occurred_at ? new Date(d.occurred_at).toISOString() : null,
    dose_ppm: d.dose_ppm != null ? Number(d.dose_ppm) : null,
    physical_dato: d.physical_dato != null ? Number(d.physical_dato) : null,
    reading_before: d.reading_before != null ? Number(d.reading_before) : null,
    reading_after: d.reading_after != null ? Number(d.reading_after) : null,
    injection_seconds: d.injection_seconds != null ? Number(d.injection_seconds) : null,
    meta: d.meta ?? {},
  };
}

async function fullInstallation(id) {
  const row = await getInstallationById(id);
  if (!row) return null;
  const photos = await listPhotos(id);
  const doses = await listDoses(id);
  return serializeInstallation(row, {
    photos: photos.map((p) => serializePhoto(p, id)),
    doses: doses.map(serializeDose),
  });
}

async function moveStagedFiles(installationId, filesByKind) {
  const destDir = path.join(INSTALL_DIR, installationId);
  fs.mkdirSync(destDir, { recursive: true });
  const saved = [];
  for (const [kind, file] of Object.entries(filesByKind)) {
    if (!file) continue;
    const destName = `${kind}-${path.basename(file.filename || file.path)}`;
    const destPath = path.join(destDir, destName);
    fs.renameSync(file.path, destPath);
    const rel = path.relative(UPLOAD_ROOT, destPath).replace(/\\/g, '/');
    const photo = await addPhoto({
      installationId,
      kind,
      filePath: rel,
      originalName: file.originalname,
    });
    saved.push(photo);
  }
  return saved;
}

ethyleneInstallationsRouter.get('/', async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'validation', message: 'deviceId required' });
    }
    const data = await listInstallationsForDevice(deviceId, { limit: req.query.limit });
    return res.json({ data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ethyleneInstallationsRouter.get('/pending-notice', async (req, res) => {
  try {
    const deviceId = String(req.query.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'validation', message: 'deviceId required' });
    }
    const data = await listPendingNotices(deviceId);
    return res.json({ data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ethyleneInstallationsRouter.get('/:id', async (req, res) => {
  try {
    const data = await fullInstallation(req.params.id);
    if (!data) return res.status(404).json({ error: 'not_found' });
    return res.json({ data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ethyleneInstallationsRouter.get('/:id/report', async (req, res) => {
  try {
    const data = await fullInstallation(req.params.id);
    if (!data) return res.status(404).json({ error: 'not_found' });
    return res.json({ data, report: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ethyleneInstallationsRouter.get('/:id/files/:filename', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const filename = path.basename(String(req.params.filename || ''));
    if (!id || !filename || filename.includes('..')) {
      return res.status(400).json({ error: 'validation' });
    }
    const abs = path.join(INSTALL_DIR, id, filename);
    if (!abs.startsWith(INSTALL_DIR) || !fs.existsSync(abs)) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.sendFile(abs);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

ethyleneInstallationsRouter.post(
  '/',
  upload.fields([
    { name: 'cylinder', maxCount: 1 },
    { name: 'flowmeter', maxCount: 1 },
    { name: 'flowmeter_lpm', maxCount: 1 },
    { name: 'other', maxCount: 3 },
  ]),
  async (req, res) => {
    try {
      const deviceId = String(req.body.deviceId || '').trim();
      const notes = req.body.notes != null ? String(req.body.notes) : null;
      const flowmeterLpm =
        req.body.flowmeterLpm != null && String(req.body.flowmeterLpm).trim() !== ''
          ? Number(req.body.flowmeterLpm)
          : null;

      const row = await createInstallation({
        deviceId,
        userId: req.user?.id,
        notes,
        flowmeterLpm,
      });

      const filesByKind = {};
      for (const kind of PHOTO_KINDS) {
        const arr = req.files?.[kind];
        if (Array.isArray(arr) && arr[0]) filesByKind[kind] = arr[0];
      }
      await moveStagedFiles(row.id, filesByKind);

      const data = await fullInstallation(row.id);
      return res.status(201).json({ data });
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      return res.status(status).json({ error: status === 400 ? 'validation' : 'server_error', message: String(e.message) });
    }
  }
);

ethyleneInstallationsRouter.post(
  '/:id/photos',
  upload.fields([
    { name: 'cylinder', maxCount: 1 },
    { name: 'flowmeter', maxCount: 1 },
    { name: 'flowmeter_lpm', maxCount: 1 },
    { name: 'other', maxCount: 3 },
  ]),
  async (req, res) => {
    try {
      const row = await getInstallationById(req.params.id);
      if (!row) return res.status(404).json({ error: 'not_found' });
      const filesByKind = {};
      for (const kind of PHOTO_KINDS) {
        const arr = req.files?.[kind];
        if (Array.isArray(arr) && arr[0]) filesByKind[kind] = arr[0];
      }
      await moveStagedFiles(row.id, filesByKind);
      const data = await fullInstallation(row.id);
      return res.json({ data });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'server_error', message: String(e.message) });
    }
  }
);

ethyleneInstallationsRouter.post('/:id/test/start', async (req, res) => {
  try {
    const targetPpm = req.body?.targetPpm ?? req.body?.target_ppm;
    const row = await startInstallationTest(req.params.id, targetPpm, {
      userEmail: req.user?.email,
    });
    const data = await fullInstallation(row.id);
    return res.json({ data });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    return res.status(status).json({
      error: status === 503 ? 'device_not_ready' : status === 400 ? 'validation' : 'server_error',
      message: String(e.message),
      reason: e.reason,
    });
  }
});

ethyleneInstallationsRouter.post('/:id/test/cancel', async (req, res) => {
  try {
    const row = await cancelInstallationTest(req.params.id, { userEmail: req.user?.email });
    const data = await fullInstallation(row.id);
    return res.json({ data });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    return res.status(status).json({ error: 'server_error', message: String(e.message) });
  }
});

ethyleneInstallationsRouter.post('/:id/ack-notice', async (req, res) => {
  try {
    await ackNotice(req.params.id);
    const data = await fullInstallation(req.params.id);
    return res.json({ data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
