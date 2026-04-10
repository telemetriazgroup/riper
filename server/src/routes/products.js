import express from 'express';
import { pool } from '../db.js';
import { requireAdmin } from '../authMiddleware.js';

export const productsRouter = express.Router();

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

productsRouter.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, sort_order, created_at, updated_at
       FROM app_products
       WHERE deleted_at IS NULL
       ORDER BY sort_order ASC, name ASC`
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
       RETURNING id, name, sort_order, created_at, updated_at`,
      [n, sort_order]
    );
    res.status(201).json({ data: rowToProduct(rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'duplicate', message: 'product name exists' });
    }
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
       RETURNING id, name, sort_order, created_at, updated_at`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rowToProduct(rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'duplicate', message: 'product name exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

productsRouter.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      `UPDATE app_products SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
