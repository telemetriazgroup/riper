import express from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAdmin } from '../authMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');

export function ensureUploadDirs() {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const ROLES = new Set(['superadmin', 'admin', 'operator', 'viewer']);

function isAdmin(req) {
  const r = req.user?.role;
  return r === 'superadmin' || r === 'admin';
}

function adminOrSelf(req, res, next) {
  const { id } = req.params;
  if (req.user?.id === id) return next();
  if (isAdmin(req)) return next();
  return res.status(403).json({ error: 'forbidden', message: 'forbidden' });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Misma convención que el front: cuentas *.ultraorganics@riper.local (sin CRUD de usuarios en API). */
function isUltraorganicsFleetEmail(email) {
  return normalizeEmail(email).endsWith('ultraorganics@riper.local');
}

function normalizeCompany(c) {
  const s = String(c ?? '').trim();
  return s.length ? s : 'sin empresa';
}

function rowToPublic(row) {
  const iden = row.identificador != null ? String(row.identificador).trim() : '';
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    company: row.company ?? 'sin empresa',
    active: row.active,
    is_superuser: row.is_superuser,
    has_photo: Boolean(row.photo_path),
    identificador: iden.length ? iden : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const usersRouter = express.Router();

usersRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, company, active, is_superuser, photo_path, identificador, created_at, updated_at
       FROM app_users
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );
    res.json({ data: rows.map(rowToPublic) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

usersRouter.post('/', requireAdmin, async (req, res) => {
  if (isUltraorganicsFleetEmail(req.user?.email)) {
    return res.status(403).json({ error: 'forbidden', message: 'user management not allowed for this account' });
  }
  const { name, email, role, active = true, password, company, identificador } = req.body || {};
  const n = String(name || '').trim();
  const em = normalizeEmail(email);
  const pw = String(password || '');
  if (!n || !em || !pw) {
    return res.status(400).json({ error: 'validation', message: 'name, email and password required' });
  }
  if (!ROLES.has(role)) {
    return res.status(400).json({ error: 'validation', message: 'invalid role' });
  }
  if (role === 'superadmin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'forbidden', message: 'only superadmin can create superadmin' });
  }
  const comp = normalizeCompany(company);
  const iden =
    identificador != null && String(identificador).trim() !== '' ? String(identificador).trim() : null;
  try {
    const hash = await bcrypt.hash(pw, 10);
    const { rows } = await pool.query(
      `INSERT INTO app_users (name, email, role, password_hash, company, active, is_superuser, identificador)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, role, company, active, is_superuser, photo_path, identificador, created_at, updated_at`,
      [n, em, role, hash, comp, Boolean(active), role === 'superadmin', iden]
    );
    res.status(201).json({ data: rowToPublic(rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'duplicate_email', message: 'email already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

usersRouter.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const self = req.user.id === id;
  if (!self && isUltraorganicsFleetEmail(req.user?.email)) {
    return res.status(403).json({ error: 'forbidden', message: 'forbidden' });
  }
  if (!self && !isAdmin(req)) {
    return res.status(403).json({ error: 'forbidden', message: 'forbidden' });
  }

  let { name, email, role, active, password, company, identificador } = req.body || {};
  if (self && !isAdmin(req)) {
    email = undefined;
    role = undefined;
    active = undefined;
  }

  const fields = [];
  const vals = [];
  let i = 1;

  const { rows: existingRows } = await pool.query(
    `SELECT id, is_superuser, role FROM app_users WHERE id = $1::uuid AND deleted_at IS NULL`,
    [id]
  );
  if (!existingRows.length) {
    return res.status(404).json({ error: 'not_found', message: 'user not found' });
  }
  const existing = existingRows[0];
  if (existing.is_superuser && req.user.role !== 'superadmin') {
    if (!self) {
      return res.status(403).json({ error: 'forbidden', message: 'only superadmin can edit superuser' });
    }
    email = undefined;
    role = undefined;
    active = undefined;
  }

  if (name !== undefined) {
    const n = String(name).trim();
    if (!n) return res.status(400).json({ error: 'validation', message: 'name empty' });
    fields.push(`name = $${i++}`);
    vals.push(n);
  }
  if (email !== undefined) {
    const em = normalizeEmail(email);
    if (!em) return res.status(400).json({ error: 'validation', message: 'email empty' });
    fields.push(`email = $${i++}`);
    vals.push(em);
  }
  if (role !== undefined) {
    if (!ROLES.has(role)) {
      return res.status(400).json({ error: 'validation', message: 'invalid role' });
    }
    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'forbidden', message: 'only superadmin can assign superadmin' });
    }
    fields.push(`role = $${i++}`);
    vals.push(role);
    fields.push(`is_superuser = $${i++}`);
    vals.push(role === 'superadmin');
  }
  if (active !== undefined) {
    fields.push(`active = $${i++}`);
    vals.push(Boolean(active));
  }
  if (company !== undefined) {
    fields.push(`company = $${i++}`);
    vals.push(normalizeCompany(company));
  }
  if (identificador !== undefined) {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'forbidden', message: 'only admin can set identificador' });
    }
    const iden =
      identificador === null || String(identificador).trim() === '' ? null : String(identificador).trim();
    fields.push(`identificador = $${i++}`);
    vals.push(iden);
  }
  if (password !== undefined && String(password).length > 0) {
    const hash = await bcrypt.hash(String(password), 10);
    fields.push(`password_hash = $${i++}`);
    vals.push(hash);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'validation', message: 'no fields to update' });
  }

  fields.push(`updated_at = now()`);
  vals.push(id);

  const sql = `
    UPDATE app_users SET ${fields.join(', ')}
    WHERE id = $${i}::uuid AND deleted_at IS NULL
    RETURNING id, name, email, role, company, active, is_superuser, photo_path, identificador, created_at, updated_at
  `;

  try {
    const { rows } = await pool.query(sql, vals);
    if (!rows.length) {
      return res.status(404).json({ error: 'not_found', message: 'user not found' });
    }
    res.json({ data: rowToPublic(rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'duplicate_email', message: 'email already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

usersRouter.delete('/:id', requireAdmin, async (req, res) => {
  if (isUltraorganicsFleetEmail(req.user?.email)) {
    return res.status(403).json({ error: 'forbidden', message: 'user management not allowed for this account' });
  }
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT is_superuser, photo_path FROM app_users WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'not_found', message: 'user not found' });
    }
    if (rows[0].is_superuser) {
      return res.status(403).json({ error: 'forbidden', message: 'cannot delete superuser' });
    }
    const photoPath = rows[0].photo_path;
    const { rowCount } = await pool.query(
      `UPDATE app_users
       SET deleted_at = now(), active = false, updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!rowCount) {
      return res.status(404).json({ error: 'not_found', message: 'user not found' });
    }
    if (photoPath) {
      const fp = path.join(UPLOAD_ROOT, photoPath);
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (_) {}
    }
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${req.params.id}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype)) {
      return cb(new Error('only image files'));
    }
    cb(null, true);
  },
});

usersRouter.post('/:id/avatar', adminOrSelf, upload.single('photo'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'validation', message: 'file required' });
  }
  const finalName = path.basename(req.file.path);
  const rel = `avatars/${finalName}`;
  try {
    const oldFiles = fs.readdirSync(AVATAR_DIR).filter((f) => f.startsWith(id) && f !== finalName);
    for (const f of oldFiles) {
      try {
        fs.unlinkSync(path.join(AVATAR_DIR, f));
      } catch (_) {}
    }
    await pool.query(
      `UPDATE app_users SET photo_path = $1, updated_at = now() WHERE id = $2::uuid AND deleted_at IS NULL`,
      [rel, id]
    );
    res.json({ data: { photo_path: rel, has_photo: true } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

usersRouter.get('/:id/avatar', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT photo_path FROM app_users WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!rows.length || !rows[0].photo_path) {
      return res.status(404).end();
    }
    const full = path.join(UPLOAD_ROOT, rows[0].photo_path);
    if (!fs.existsSync(full)) {
      return res.status(404).end();
    }
    res.sendFile(path.resolve(full));
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});
