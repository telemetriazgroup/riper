import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireSuperAdmin } from '../authMiddleware.js';
import { writeAudit } from '../auditLog.js';

export const alarmCodesRouter = express.Router();

function rowToAlarm(row) {
  return {
    id: row.id,
    code: row.code,
    titleEs: row.title_es,
    titleEn: row.title_en,
    descriptionEs: row.description_es ?? '',
    descriptionEn: row.description_en ?? '',
    correctiveActionEs: row.corrective_action_es ?? '',
    correctiveActionEn: row.corrective_action_en ?? '',
    model: row.model ?? 'MP4000',
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    archived: Boolean(row.deleted_at),
  };
}

function parseIncludeArchived(req) {
  const v = req.query.includeArchived ?? req.query.include_archived;
  return v === true || v === 'true' || v === '1';
}

function trimText(v) {
  if (v == null) return '';
  return String(v).trim();
}

alarmCodesRouter.get('/', async (req, res) => {
  try {
    const includeArchived = parseIncludeArchived(req);
    if (includeArchived && req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'forbidden', message: 'includeArchived requires superadmin' });
    }
    const { rows } = await pool.query(
      `SELECT id, code, title_es, title_en, description_es, description_en,
              corrective_action_es, corrective_action_en, model, deleted_at, created_at, updated_at
       FROM app_alarm_codes
       WHERE ($1::boolean = TRUE OR deleted_at IS NULL)
       ORDER BY code ASC`,
      [includeArchived]
    );
    res.json({ data: rows.map(rowToAlarm) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

alarmCodesRouter.get('/by-code/:code', async (req, res) => {
  const code = Number(req.params.code);
  if (!Number.isFinite(code)) {
    return res.status(400).json({ error: 'validation', message: 'invalid code' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, code, title_es, title_en, description_es, description_en,
              corrective_action_es, corrective_action_en, model, deleted_at, created_at, updated_at
       FROM app_alarm_codes
       WHERE code = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [Math.round(code)]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    res.json({ data: rowToAlarm(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

alarmCodesRouter.post('/', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const code = Number(b.code);
  const titleEs = trimText(b.titleEs ?? b.title_es);
  const titleEn = trimText(b.titleEn ?? b.title_en);
  if (!Number.isFinite(code) || code < 0 || code > 999) {
    return res.status(400).json({ error: 'validation', message: 'code required (0-999)' });
  }
  if (!titleEs && !titleEn) {
    return res.status(400).json({ error: 'validation', message: 'title required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO app_alarm_codes (
         code, title_es, title_en, description_es, description_en,
         corrective_action_es, corrective_action_en, model
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, code, title_es, title_en, description_es, description_en,
                 corrective_action_es, corrective_action_en, model, deleted_at, created_at, updated_at`,
      [
        Math.round(code),
        titleEs || titleEn,
        titleEn || titleEs,
        trimText(b.descriptionEs ?? b.description_es),
        trimText(b.descriptionEn ?? b.description_en),
        trimText(b.correctiveActionEs ?? b.corrective_action_es),
        trimText(b.correctiveActionEn ?? b.corrective_action_en),
        trimText(b.model) || 'MP4000',
      ]
    );
    await writeAudit(req, {
      action: 'alarm_code.create',
      entityType: 'alarm_code',
      entityId: String(rows[0].id),
      meta: { code: rows[0].code },
    });
    res.status(201).json({ data: rowToAlarm(rows[0]) });
  } catch (e) {
    if (String(e.message).includes('idx_app_alarm_codes_code_active')) {
      return res.status(409).json({ error: 'conflict', message: 'code already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

alarmCodesRouter.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const b = req.body || {};
  const updates = [];
  const vals = [];
  let i = 1;

  const fields = [
    ['code', 'code', (v) => Math.round(Number(v))],
    ['title_es', 'titleEs', trimText],
    ['title_en', 'titleEn', trimText],
    ['description_es', 'descriptionEs', trimText],
    ['description_en', 'descriptionEn', trimText],
    ['corrective_action_es', 'correctiveActionEs', trimText],
    ['corrective_action_en', 'correctiveActionEn', trimText],
    ['model', 'model', (v) => trimText(v) || 'MP4000'],
  ];

  for (const [col, bodyKey, fn] of fields) {
    const alt = col;
    const raw = b[bodyKey] ?? b[alt];
    if (raw !== undefined) {
      updates.push(`${col} = $${i++}`);
      vals.push(fn(raw));
    }
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'validation', message: 'no fields' });
  }
  updates.push('updated_at = now()');
  vals.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE app_alarm_codes SET ${updates.join(', ')}
       WHERE id = $${i}::uuid AND deleted_at IS NULL
       RETURNING id, code, title_es, title_en, description_es, description_en,
                 corrective_action_es, corrective_action_en, model, deleted_at, created_at, updated_at`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'alarm_code.update',
      entityType: 'alarm_code',
      entityId: String(id),
      meta: { code: rows[0].code },
    });
    res.json({ data: rowToAlarm(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

alarmCodesRouter.post('/:id/restore', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE app_alarm_codes
       SET deleted_at = NULL, updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NOT NULL
       RETURNING id, code, title_es, title_en, description_es, description_en,
                 corrective_action_es, corrective_action_en, model, deleted_at, created_at, updated_at`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'not_found' });
    await writeAudit(req, {
      action: 'alarm_code.restore',
      entityType: 'alarm_code',
      entityId: String(id),
      meta: { code: rows[0].code },
    });
    res.json({ data: rowToAlarm(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});

alarmCodesRouter.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: cur } = await pool.query(
      `SELECT id, code FROM app_alarm_codes WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    if (!cur.length) return res.status(404).json({ error: 'not_found' });
    await pool.query(
      `UPDATE app_alarm_codes SET deleted_at = now(), updated_at = now()
       WHERE id = $1::uuid AND deleted_at IS NULL`,
      [id]
    );
    await writeAudit(req, {
      action: 'alarm_code.archive',
      entityType: 'alarm_code',
      entityId: String(id),
      meta: { code: cur[0].code },
    });
    res.json({ ok: true, archived: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error', message: String(e.message) });
  }
});
