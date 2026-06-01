import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireSuperAdmin } from '../authMiddleware.js';
import { writeAudit } from '../auditLog.js';

export const productsRouter = express.Router();

function rowToProduct(row) {
  const del = row.deleted_at;
  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en ?? null,
    sort_order: row.sort_order,
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

productsRouter.get('/', async (req, res) => {
  try {
    const includeArchived = parseIncludeArchived(req);
    if (includeArchived && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'forbidden', message: 'includeArchived requires superadmin' });
    }
    const { rows } = await pool.query(
      `SELECT id, name, name_en, sort_order, deleted_at, created_at, updated_at
       FROM app_products
       WHERE ($1::boolean = TRUE OR deleted_at IS NULL)
       ORDER BY deleted_at NULLS FIRST, sort_order ASC, name ASC`,
      [includeArchived]
    );
    res.json({ data: rows.map(rowToProduct) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

productsRouter.post('/', requireAdmin, async (req, res) => {
  const { name, sort_order: so } = req.body || {};
  const n = String(name || '').trim();
  if (!n) {
    return res.status(400).json({ error: 'validation', message: 'name required' });
  }
  const sort_order = Number.isFinite(Number(so)) ? Number(so) : 0;
  try {
    const { rows } = await pool.query(
      `INSERT INTO app_products (name, sort_order)
       VALUES ($1, $2)
       RETURNING id, name, name_en, sort_order, created_at, updated_at`,
      [n, sort_order]
    );
    await writeAudit(req, {
      action: 'product.create',
      entityType: 'product',
      entityId: String(rows[0].id),
      meta: { name: n },
    });
    res.status(201).json({ data: rowToProduct(rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'duplicate', message: 'product name exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

productsRouter.post('/:id/restore', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE app_products
       SET deleted_at = NULL, updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NOT NULL
       RETURNING id, name, name_en, sort_order, deleted_at, created_at, updated_at`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'product.restore',
      entityType: 'product',
      entityId: String(id),
      meta: { name: rows[0].name },
    });
    res.json({ data: rowToProduct(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

productsRouter.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, sort_order: so } = req.body || {};
  const updates = [];
  const vals = [];
  let i = 1;
  if (name !== undefined) {
    const n = String(name || '').trim();
    if (!n) return res.status(400).json({ error: 'validation', message: 'name empty' });
    updates.push(`name = $${i++}`);
    vals.push(n);
  }
  if (so !== undefined) {
    updates.push(`sort_order = $${i++}`);
    vals.push(Number(so));
  }
  if (!updates.length) {
    return res.status(400).json({ error: 'validation', message: 'no fields' });
  }
  updates.push(`updated_at = now()`);
  vals.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE app_products SET ${updates.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING id, name, name_en, sort_order, created_at, updated_at`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'product.update',
      entityType: 'product',
      entityId: String(id),
      meta: {
        ...(name !== undefined ? { name: rows[0].name } : {}),
        ...(so !== undefined ? { sort_order: rows[0].sort_order } : {}),
      },
    });
    res.json({ data: rowToProduct(rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'duplicate', message: 'product name exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/** Archivo lógico (no borrado físico) */
productsRouter.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: cur } = await pool.query(
      `SELECT id, name FROM app_products WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    const { rowCount } = await pool.query(
      `UPDATE app_products SET deleted_at = now(), updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'product.archive',
      entityType: 'product',
      entityId: String(id),
      meta: { name: cur[0].name },
    });
    res.json({ ok: true, archived: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
