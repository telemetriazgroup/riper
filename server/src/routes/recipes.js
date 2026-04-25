import express from 'express';
import { pool } from '../db.js';
import { requireStaff } from '../authMiddleware.js';

export const recipesRouter = express.Router();

function rowToRecipe(row) {
  const phases = row.phases;
  return {
    id: row.id,
    name: row.name,
    fruit: row.fruit,
    description: row.description ?? '',
    phases: Array.isArray(phases) ? phases : [],
    is_system: row.is_system === true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

recipesRouter.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, fruit, description, phases, is_system, created_at, updated_at
       FROM app_recipes
       WHERE deleted_at IS NULL
       ORDER BY is_system DESC, name ASC, updated_at DESC`
    );
    res.json({ data: rows.map(rowToRecipe) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

recipesRouter.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, fruit, description, phases, is_system, created_at, updated_at
       FROM app_recipes
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rowToRecipe(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

function newRecipeId() {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

recipesRouter.post('/', requireStaff, async (req, res) => {
  const { name, fruit, description = '', phases } = req.body || {};
  const n = String(name || '').trim();
  const f = String(fruit || '').trim();
  if (!n || !f) {
    return res.status(400).json({ error: 'validation', message: 'name and fruit required' });
  }
  if (!Array.isArray(phases)) {
    return res.status(400).json({ error: 'validation', message: 'phases must be array' });
  }
  const id = newRecipeId();
  try {
    const { rows } = await pool.query(
      `INSERT INTO app_recipes (id, name, fruit, description, phases, is_system)
       VALUES ($1, $2, $3, $4, $5::jsonb, false)
       RETURNING id, name, fruit, description, phases, is_system, created_at, updated_at`,
      [id, n, f, String(description), JSON.stringify(phases)]
    );
    res.status(201).json({ data: rowToRecipe(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

recipesRouter.patch('/:id', requireStaff, async (req, res) => {
  const { id } = req.params;
  const { name, fruit, description, phases } = req.body || {};
  const updates = [];
  const vals = [];
  let i = 1;
  if (name !== undefined) {
    const n = String(name || '').trim();
    if (!n) return res.status(400).json({ error: 'validation', message: 'name empty' });
    updates.push(`name = $${i++}`);
    vals.push(n);
  }
  if (fruit !== undefined) {
    const f = String(fruit || '').trim();
    if (!f) return res.status(400).json({ error: 'validation', message: 'fruit empty' });
    updates.push(`fruit = $${i++}`);
    vals.push(f);
  }
  if (description !== undefined) {
    updates.push(`description = $${i++}`);
    vals.push(String(description));
  }
  if (phases !== undefined) {
    if (!Array.isArray(phases)) {
      return res.status(400).json({ error: 'validation', message: 'phases must be array' });
    }
    updates.push(`phases = $${i++}::jsonb`);
    vals.push(JSON.stringify(phases));
  }
  if (!updates.length) {
    return res.status(400).json({ error: 'validation', message: 'no fields' });
  }
  updates.push(`updated_at = now()`);
  vals.push(id);
  try {
    const { rows: chk } = await pool.query(
      `SELECT is_system FROM app_recipes WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!chk.length) return res.status(404).json({ error: 'not_found' });
    if (chk[0].is_system === true) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'system recipe cannot be modified; duplicate to customize',
      });
    }
    const { rows } = await pool.query(
      `UPDATE app_recipes SET ${updates.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL AND (is_system IS NOT TRUE)
       RETURNING id, name, fruit, description, phases, is_system, created_at, updated_at`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rowToRecipe(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

recipesRouter.delete('/:id', requireStaff, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: chk } = await pool.query(
      `SELECT is_system FROM app_recipes WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!chk.length) return res.status(404).json({ error: 'not_found' });
    if (chk[0].is_system === true) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'standard recipes cannot be deleted; duplicate to create a custom copy',
      });
    }
    const { rowCount } = await pool.query(
      `UPDATE app_recipes SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL AND (is_system IS NOT TRUE)`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
