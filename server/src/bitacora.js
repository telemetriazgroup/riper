/**
 * Bitácora de control en tabla propia (no embeber en params de sesión).
 * Vista rápida: últimas 12 h. Histórico: consulta por rango.
 */
import { pool } from './db.js';
import { createHash } from 'crypto';

export const BITACORA_DEFAULT_HOURS = 12;
export const BITACORA_MAX_RANGE_DAYS = 90;
export const BITACORA_PAGE_LIMIT = 100;

/** Dual-write JSON+tabla. Solo si BITACORA_DUAL_WRITE=1. Default: solo tabla. */
export function isBitacoraDualWriteEnabled() {
  const v = process.env.BITACORA_DUAL_WRITE;
  return v === '1' || v === 'true';
}

function toIso(v) {
  if (v == null) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

function legacyKeyFor(deviceId, occurredAt, action, entry) {
  const rawKey = entry?.key != null ? String(entry.key) : '';
  if (rawKey) return `${deviceId}|${rawKey}`.slice(0, 240);
  const basis = JSON.stringify({
    at: occurredAt,
    action,
    dato: entry?.dato ?? null,
    tipo: entry?.tipo ?? null,
    reason: entry?.reason ?? null,
    target: entry?.target ?? null,
  });
  const hash = createHash('sha1').update(basis).digest('hex').slice(0, 20);
  return `${deviceId}|${occurredAt}|${action}|${hash}`.slice(0, 240);
}

function pickSummary(entry) {
  const s =
    entry?.summaryEs ??
    entry?.analysisEs ??
    entry?.changeEs ??
    entry?.summary ??
    entry?.message ??
    null;
  if (s == null) return null;
  const text = String(s).trim();
  return text ? text.slice(0, 2000) : null;
}

/**
 * Inserta un evento. Idempotente por legacy_key.
 * @returns {Promise<object|null>}
 */
export async function insertBitacoraEvent(input) {
  const deviceId = String(input?.deviceId || '').trim();
  if (!deviceId) return null;

  const action = String(input?.action || entryAction(input?.entry) || 'event').trim() || 'event';
  const entry = input?.entry && typeof input.entry === 'object' ? { ...input.entry } : {};
  const occurredAt = toIso(input?.occurredAt ?? entry.at);
  const source = String(input?.source ?? entry.source ?? 'control').slice(0, 64);
  const kind = input?.kind != null ? String(input.kind).slice(0, 64) : entry.kind != null ? String(entry.kind).slice(0, 64) : null;
  const processType =
    input?.processType != null
      ? String(input.processType).slice(0, 32)
      : entry.processType != null
        ? String(entry.processType).slice(0, 32)
        : null;
  const summary = input?.summary != null ? String(input.summary).slice(0, 2000) : pickSummary(entry);
  const userEmail =
    input?.userEmail != null
      ? String(input.userEmail).slice(0, 320)
      : entry.by != null
        ? String(entry.by).slice(0, 320)
        : null;

  const legacyKey =
    input?.legacyKey != null
      ? String(input.legacyKey).slice(0, 240)
      : legacyKeyFor(deviceId, occurredAt, action, entry);

  // No guardar campos ya columnizados / ruido enorme innecesario en listados.
  const payload = { ...entry };
  delete payload.at;
  delete payload.source;
  delete payload.action;
  delete payload.key;

  const sessionId = input?.sessionId || null;
  const trackingId = input?.trackingId || null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO app_control_bitacora (
         occurred_at, device_id, session_id, tracking_id, source, action, kind,
         process_type, summary, payload, user_email, legacy_key
       ) VALUES (
         $1::timestamptz, $2, $3::uuid, $4::uuid, $5, $6, $7,
         $8, $9, $10::jsonb, $11, $12
       )
       ON CONFLICT (legacy_key) DO NOTHING
       RETURNING *`,
      [
        occurredAt,
        deviceId,
        sessionId,
        trackingId,
        source,
        action,
        kind,
        processType,
        summary,
        JSON.stringify(payload),
        userEmail,
        legacyKey,
      ]
    );
    return rows[0] ?? null;
  } catch (e) {
    console.warn('[bitacora] insert failed', deviceId, action, e.message);
    return null;
  }
}

function entryAction(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return entry.action ?? null;
}

/** Fire-and-forget seguro para call sites síncronos. */
export function queueBitacoraEvent(input) {
  void insertBitacoraEvent(input).catch((e) => console.warn('[bitacora] queue', e.message));
}

/**
 * Lista bitácora. Preferir hours=12 en detalle de equipo.
 */
export async function queryBitacora(opts = {}) {
  const deviceId = opts.deviceId != null ? String(opts.deviceId).trim() : '';
  const limit = Math.min(
    Math.max(1, Number(opts.limit) || BITACORA_PAGE_LIMIT),
    500
  );
  const hours = opts.hours != null ? Number(opts.hours) : null;
  const from = opts.from ? new Date(String(opts.from)) : null;
  const to = opts.to ? new Date(String(opts.to)) : null;
  const cursor = opts.cursor ? String(opts.cursor) : null;
  const includePayload = opts.includePayload === true || opts.includePayload === '1';

  const where = [];
  const vals = [];
  let i = 1;

  if (deviceId) {
    where.push(`device_id = $${i++}`);
    vals.push(deviceId);
  }

  if (Number.isFinite(hours) && hours > 0) {
    where.push(`occurred_at >= now() - ($${i++}::text || ' hours')::interval`);
    vals.push(String(hours));
  } else {
    if (from && Number.isFinite(from.getTime())) {
      where.push(`occurred_at >= $${i++}::timestamptz`);
      vals.push(from.toISOString());
    }
    if (to && Number.isFinite(to.getTime())) {
      where.push(`occurred_at <= $${i++}::timestamptz`);
      vals.push(to.toISOString());
    }
    // Tope de seguridad si no hay filtro temporal
    if (!from && !to) {
      where.push(`occurred_at >= now() - interval '${BITACORA_DEFAULT_HOURS} hours'`);
    } else if (from && to) {
      const spanMs = to.getTime() - from.getTime();
      const maxMs = BITACORA_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
      if (spanMs > maxMs) {
        const err = new Error(`date range exceeds ${BITACORA_MAX_RANGE_DAYS} days`);
        err.status = 400;
        throw err;
      }
    }
  }

  if (cursor) {
    where.push(`occurred_at < $${i++}::timestamptz`);
    vals.push(cursor);
  }

  if (opts.action) {
    where.push(`action = $${i++}`);
    vals.push(String(opts.action));
  }
  if (opts.processType) {
    where.push(`process_type = $${i++}`);
    vals.push(String(opts.processType));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  vals.push(limit + 1);

  const cols = includePayload
    ? `id, occurred_at, device_id, session_id, tracking_id, source, action, kind,
       process_type, summary, payload, user_email, created_at`
    : `id, occurred_at, device_id, session_id, tracking_id, source, action, kind,
       process_type, summary, user_email, created_at,
       CASE
         WHEN payload ? 'dato' THEN jsonb_build_object('dato', payload->'dato')
         ELSE '{}'::jsonb
       END AS payload`;

  const { rows } = await pool.query(
    `SELECT ${cols}
     FROM app_control_bitacora
     ${whereSql}
     ORDER BY occurred_at DESC
     LIMIT $${i}`,
    vals
  );

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && data.length ? data[data.length - 1].occurred_at : null;

  return {
    data: data.map(serializeBitacoraRow),
    nextCursor: nextCursor ? new Date(nextCursor).toISOString() : null,
  };
}

export function serializeBitacoraRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    occurred_at: row.occurred_at ? new Date(row.occurred_at).toISOString() : null,
    device_id: row.device_id,
    session_id: row.session_id ?? null,
    tracking_id: row.tracking_id ?? null,
    source: row.source,
    action: row.action,
    kind: row.kind ?? null,
    process_type: row.process_type ?? null,
    summary: row.summary ?? null,
    payload: row.payload ?? {},
    user_email: row.user_email ?? null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

/**
 * Convierte fila bitácora → ProcessEventRow (compatible con summarizeProcessEventParts).
 */
export function bitacoraRowToProcessEvent(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    key: row.id,
    at: row.occurred_at,
    action: row.action,
    source: row.source,
    kind: row.kind,
    processType: row.process_type,
    summaryEs: row.summary,
    analysisEs: row.summary,
    by: row.user_email,
    ...payload,
    detail: payload,
  };
}

/**
 * Migra un array tunnelEventLog a la tabla.
 * @returns {Promise<number>} insertados
 */
export async function migrateTunnelEventLogArray(events, meta = {}) {
  if (!Array.isArray(events) || events.length === 0) return 0;
  const deviceId = String(meta.deviceId || '').trim();
  if (!deviceId) return 0;
  let n = 0;
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const inserted = await insertBitacoraEvent({
      deviceId,
      sessionId: meta.sessionId ?? null,
      trackingId: meta.trackingId ?? null,
      processType: meta.processType ?? ev.processType ?? null,
      occurredAt: ev.at,
      entry: ev,
      source: ev.source,
      action: ev.action,
      kind: ev.kind,
      userEmail: ev.by ?? meta.userEmail ?? null,
    });
    if (inserted) n += 1;
  }
  return n;
}
