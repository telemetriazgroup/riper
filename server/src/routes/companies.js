import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireSuperAdmin } from '../authMiddleware.js';
import { writeAudit } from '../auditLog.js';

export const companiesRouter = express.Router();

function rowToCompany(row) {
  const del = row.deleted_at;
  return {
    id: row.id,
    name: row.name,
    ruc_id: row.ruc_id ?? '',
    address: row.address ?? '',
    email: row.email ?? '',
    contact_name: row.contact_name ?? '',
    phone: row.phone ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: del ? new Date(del).toISOString() : null,
    archived: Boolean(del),
  };
}

function parseIncludeArchived(req) {
  const v = req.query.includeArchived ?? req.query.include_archived;
  return v === true || v === 'true' || v === '1';
}

function trimOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

companiesRouter.get('/', async (req, res) => {
  try {
    const includeArchived = parseIncludeArchived(req);
    if (includeArchived && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'forbidden', message: 'includeArchived requires superadmin' });
    }
    const { rows } = await pool.query(
      `SELECT id, name, ruc_id, address, email, contact_name, phone, deleted_at, created_at, updated_at
       FROM app_companies
       WHERE ($1::boolean = TRUE OR deleted_at IS NULL)
       ORDER BY deleted_at NULLS FIRST, name ASC`,
      [includeArchived]
    );
    res.json({ data: rows.map(rowToCompany) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

companiesRouter.post('/', requireAdmin, async (req, res) => {
  const { name, ruc_id, address, email, contact_name, phone } = req.body || {};
  const n = String(name || '').trim();
  if (!n) {
    return res.status(400).json({ error: 'validation', message: 'name required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO app_companies (name, ruc_id, address, email, contact_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, ruc_id, address, email, contact_name, phone, created_at, updated_at`,
      [
        n,
        trimOrNull(ruc_id),
        trimOrNull(address),
        trimOrNull(email),
        trimOrNull(contact_name),
        trimOrNull(phone),
      ]
    );
    await writeAudit(req, {
      action: 'company.create',
      entityType: 'company',
      entityId: String(rows[0].id),
      meta: { name: n },
    });
    res.status(201).json({ data: rowToCompany(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

companiesRouter.post('/:id/restore', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE app_companies
       SET deleted_at = NULL, updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NOT NULL
       RETURNING id, name, ruc_id, address, email, contact_name, phone, deleted_at, created_at, updated_at`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'company.restore',
      entityType: 'company',
      entityId: String(id),
      meta: { name: rows[0].name },
    });
    res.json({ data: rowToCompany(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

companiesRouter.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const b = req.body || {};
  const updates = [];
  const vals = [];
  let i = 1;
  if (b.name !== undefined) {
    const nm = String(b.name || '').trim();
    if (!nm) return res.status(400).json({ error: 'validation', message: 'name empty' });
    updates.push(`name = $${i++}`);
    vals.push(nm);
  }
  if (b.ruc_id !== undefined) {
    updates.push(`ruc_id = $${i++}`);
    vals.push(trimOrNull(b.ruc_id));
  }
  if (b.address !== undefined) {
    updates.push(`address = $${i++}`);
    vals.push(trimOrNull(b.address));
  }
  if (b.email !== undefined) {
    updates.push(`email = $${i++}`);
    vals.push(trimOrNull(b.email));
  }
  if (b.contact_name !== undefined) {
    updates.push(`contact_name = $${i++}`);
    vals.push(trimOrNull(b.contact_name));
  }
  if (b.phone !== undefined) {
    updates.push(`phone = $${i++}`);
    vals.push(trimOrNull(b.phone));
  }
  if (!updates.length) {
    return res.status(400).json({ error: 'validation', message: 'no fields' });
  }
  updates.push(`updated_at = now()`);
  vals.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE app_companies SET ${updates.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING id, name, ruc_id, address, email, contact_name, phone, created_at, updated_at`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'company.update',
      entityType: 'company',
      entityId: String(id),
      meta: { name: rows[0].name },
    });
    res.json({ data: rowToCompany(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

companiesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: cur } = await pool.query(
      `SELECT id, name FROM app_companies WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const { rowCount } = await pool.query(
      `UPDATE app_companies SET deleted_at = now(), updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'company.archive',
      entityType: 'company',
      entityId: String(id),
      meta: { name: cur[0].name },
    });
    res.json({ ok: true, archived: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
