import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireSuperAdmin } from '../authMiddleware.js';
import { writeAudit } from '../auditLog.js';

export const recipesRouter = express.Router();

function rowToRecipe(row) {
  const phases = row.phases;
  const del = row.deleted_at;
  return {
    id: row.id,
    name: row.name,
    fruit: row.fruit,
    description: row.description ?? '',
    phases: Array.isArray(phases) ? phases : [],
    is_system: row.is_system === true,
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

recipesRouter.get('/', async (req, res) => {
  try {
    const includeArchived = parseIncludeArchived(req);
    if (includeArchived && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'forbidden', message: 'includeArchived requires superadmin' });
    }
    const { rows } = await pool.query(
      `SELECT id, name, fruit, description, phases, is_system, deleted_at, created_at, updated_at
       FROM app_recipes
       WHERE ($1::boolean = TRUE OR deleted_at IS NULL)
       ORDER BY deleted_at NULLS FIRST, is_system DESC, name ASC, updated_at DESC`,
      [includeArchived]
    );
    res.json({ data: rows.map(rowToRecipe) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

recipesRouter.post('/:id/restore', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE app_recipes
       SET deleted_at = NULL, updated_at = now()
       WHERE id = $1 AND deleted_at IS NOT NULL AND (is_system IS NOT TRUE)
       RETURNING id, name, fruit, description, phases, is_system, deleted_at, created_at, updated_at`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'recipe.restore',
      entityType: 'recipe',
      entityId: String(id),
      meta: { name: rows[0].name, fruit: rows[0].fruit },
    });
    res.json({ data: rowToRecipe(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

recipesRouter.get('/:id', async (req, res) => {
  try {
    const superadmin = req.user?.role === 'superadmin';
    const { rows } = await pool.query(
      `SELECT id, name, fruit, description, phases, is_system, deleted_at, created_at, updated_at
       FROM app_recipes
       WHERE id = $1 AND ($2::boolean = TRUE OR deleted_at IS NULL)`,
      [req.params.id, superadmin]
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

recipesRouter.post('/', requireAdmin, async (req, res) => {
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
    await writeAudit(req, {
      action: 'recipe.create',
      entityType: 'recipe',
      entityId: id,
      meta: { name: n, fruit: f },
    });
    res.status(201).json({ data: rowToRecipe(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

recipesRouter.patch('/:id', requireAdmin, async (req, res) => {
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
    await writeAudit(req, {
      action: 'recipe.update',
      entityType: 'recipe',
      entityId: id,
      meta: {
        updated: {
          ...(name !== undefined ? { name: rows[0].name } : {}),
          ...(fruit !== undefined ? { fruit: rows[0].fruit } : {}),
        },
      },
    });
    res.json({ data: rowToRecipe(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

/** Archivo lógico (no borrado físico): deleted_at = ahora */
recipesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: chk } = await pool.query(
      `SELECT is_system, name, fruit FROM app_recipes WHERE id = $1 AND deleted_at IS NULL`,
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
    await writeAudit(req, {
      action: 'recipe.archive',
      entityType: 'recipe',
      entityId: id,
      meta: { name: chk[0].name, fruit: chk[0].fruit },
    });
    res.json({ ok: true, archived: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
