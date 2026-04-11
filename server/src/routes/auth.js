import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { JWT_SECRET, authMiddleware } from '../authMiddleware.js';

const router = express.Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function userPayload(row) {
  const iden = row.identificador != null ? String(row.identificador).trim() : '';
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    company: row.company ?? 'sin empresa',
    is_superuser: row.is_superuser,
    has_photo: Boolean(row.photo_path),
    active: row.active,
    identificador: iden.length ? iden : null,
  };
}

router.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || !password) {
    return res.status(400).json({ error: 'validation', message: 'email and password required' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, company, is_superuser, password_hash, active, deleted_at, photo_path, identificador
       FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'invalid email or password' });
    }
    const u = rows[0];
    if (!u.active) {
      return res.status(403).json({ error: 'inactive', message: 'user is inactive' });
    }
    if (!u.password_hash) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'password not set' });
    }
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'invalid email or password' });
    }
    const token = jwt.sign(
      {
        sub: u.id,
        email: u.email,
        role: u.role,
        is_superuser: u.is_superuser,
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({
      token,
      user: userPayload(u),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, company, is_superuser, active, photo_path, deleted_at, identificador
       FROM app_users WHERE id = $1::uuid`,
      [req.user.id]
    );
    if (!rows.length || rows[0].deleted_at) {
      return res.status(401).json({ error: 'unauthorized', message: 'user not found' });
    }
    res.json({ data: userPayload(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

export const authRouter = router;
