/**
 * Registro local de dispositivos (respaldo cuando falla la API Madurador).
 * Ver equipos_en_linea.md
 */
import { pool } from './db.js';
import {
  CONNECTION_STANDBY_MINUTES,
  isDeviceRowOnline,
  rowLastSeenMs,
} from './maduradorConnection.js';

export const TELEMETRY_RETENTION_HOURS = 24;
export const TELEMETRY_UI_HOURS = 12;

function rowImei(row) {
  if (!row || typeof row !== 'object') return '';
  const ud = row.ultimo_dato;
  const fromUd =
    ud && typeof ud === 'object' && !Array.isArray(ud) ? String(ud.imei ?? '').trim() : '';
  return fromUd || String(row.imei ?? row.device_id ?? row.id ?? '').trim();
}

function rowDisplayName(row) {
  if (!row || typeof row !== 'object') return null;
  const ud = row.ultimo_dato && typeof row.ultimo_dato === 'object' ? row.ultimo_dato : {};
  const name =
    row.nombre ??
    row.name ??
    ud.nombre ??
    ud.name ??
    row.descripcion ??
    null;
  const s = name != null ? String(name).trim() : '';
  return s || null;
}

function pickMetrics(row) {
  if (!row || typeof row !== 'object') return {};
  const ud = row.ultimo_dato && typeof row.ultimo_dato === 'object' ? { ...row.ultimo_dato } : {};
  const flat = { ...ud, ...row };
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    temp: num(flat.temperatura ?? flat.temp ?? flat.set_point),
    supply: num(flat.supply ?? flat.temperatura_suministro),
    return: num(flat.return ?? flat.temperatura_retorno),
    humidity: num(flat.humedad ?? flat.humidity ?? flat.hr),
    ethylene: num(flat.etileno ?? flat.ethylene ?? flat.ppm),
    co2: num(flat.co2 ?? flat.dioxido_carbono),
    set_point: num(flat.set_point ?? flat.setpoint),
  };
}

/**
 * Upsert filas Madurador + sample de telemetría (fire-and-forget seguro).
 * @param {object[]} rows
 * @param {{ empresaIdentificador?: string, fleetKey?: string, source?: string }} [meta]
 */
export async function upsertDevicesFromMaduradorRows(rows, meta = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return { upserted: 0 };
  const empresa = meta.empresaIdentificador != null ? String(meta.empresaIdentificador).trim() : null;
  const fleetKey = meta.fleetKey != null ? String(meta.fleetKey).trim() : null;
  const source = String(meta.source || 'madurador').slice(0, 64);
  const now = new Date();
  let upserted = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const deviceId = rowImei(row);
      if (!deviceId) continue;
      const lastSeenMs = rowLastSeenMs(row);
      const lastSeenAt = lastSeenMs != null ? new Date(lastSeenMs) : null;
      const online = isDeviceRowOnline(row);
      const displayName = rowDisplayName(row);

      await client.query(
        `INSERT INTO app_device_registry (
           device_id, empresa_identificador, fleet_keys, display_name, payload,
           last_seen_at, last_online_at, first_seen_at, upstream_fetched_at, source, updated_at
         ) VALUES (
           $1, $2, $3::text[], $4, $5::jsonb,
           $6::timestamptz, $7::timestamptz, now(), now(), $8, now()
         )
         ON CONFLICT (device_id) DO UPDATE SET
           empresa_identificador = COALESCE(EXCLUDED.empresa_identificador, app_device_registry.empresa_identificador),
           fleet_keys = (
             SELECT ARRAY(SELECT DISTINCT x FROM unnest(
               COALESCE(app_device_registry.fleet_keys, '{}'::text[]) || EXCLUDED.fleet_keys
             ) AS x WHERE x IS NOT NULL AND x <> '')
           ),
           display_name = COALESCE(EXCLUDED.display_name, app_device_registry.display_name),
           payload = EXCLUDED.payload,
           last_seen_at = COALESCE(EXCLUDED.last_seen_at, app_device_registry.last_seen_at),
           last_online_at = CASE
             WHEN EXCLUDED.last_online_at IS NOT NULL THEN EXCLUDED.last_online_at
             ELSE app_device_registry.last_online_at
           END,
           upstream_fetched_at = EXCLUDED.upstream_fetched_at,
           source = EXCLUDED.source,
           updated_at = now()`,
        [
          deviceId,
          empresa,
          fleetKey ? [fleetKey] : [],
          displayName,
          JSON.stringify(row),
          lastSeenAt ? lastSeenAt.toISOString() : null,
          online ? now.toISOString() : null,
          source,
        ]
      );

      const sampleAt = lastSeenAt || now;
      const metrics = pickMetrics(row);
      await client.query(
        `INSERT INTO app_device_telemetry_samples (device_id, sampled_at, metrics, source)
         VALUES ($1, $2::timestamptz, $3::jsonb, $4)
         ON CONFLICT (device_id, sampled_at, source) DO UPDATE SET
           metrics = EXCLUDED.metrics`,
        [deviceId, sampleAt.toISOString(), JSON.stringify(metrics), source]
      );
      upserted += 1;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.warn('[deviceRegistry] upsert failed', e.message);
    return { upserted: 0, error: e.message };
  } finally {
    client.release();
  }

  // Retención best-effort (fuera de la txn de upsert)
  void pruneOldTelemetrySamples().catch(() => {});
  return { upserted };
}

export function queueUpsertDevicesFromMaduradorRows(rows, meta = {}) {
  void upsertDevicesFromMaduradorRows(rows, meta).catch((e) =>
    console.warn('[deviceRegistry] queue', e.message)
  );
}

export async function pruneOldTelemetrySamples(hours = TELEMETRY_RETENTION_HOURS) {
  const h = Number.isFinite(hours) && hours > 0 ? hours : TELEMETRY_RETENTION_HOURS;
  await pool.query(
    `DELETE FROM app_device_telemetry_samples
     WHERE sampled_at < now() - ($1::text || ' hours')::interval`,
    [String(h)]
  );
}

/**
 * @param {{ deviceIds?: string[], empresaIdentificador?: string, fleetKey?: string }} scope
 */
export async function listRegistryPayloads(scope = {}) {
  const where = [];
  const vals = [];
  let i = 1;

  if (Array.isArray(scope.deviceIds) && scope.deviceIds.length) {
    where.push(`device_id = ANY($${i++}::text[])`);
    vals.push(scope.deviceIds.map((d) => String(d).trim()).filter(Boolean));
  }
  if (scope.empresaIdentificador) {
    where.push(`empresa_identificador = $${i++}`);
    vals.push(String(scope.empresaIdentificador).trim());
  }
  if (scope.fleetKey) {
    where.push(`$${i++} = ANY(fleet_keys)`);
    vals.push(String(scope.fleetKey).trim());
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT device_id, payload, last_seen_at, last_online_at, upstream_fetched_at, empresa_identificador
     FROM app_device_registry
     ${whereSql}
     ORDER BY last_seen_at DESC NULLS LAST
     LIMIT 2000`,
    vals
  );

  const payloads = rows.map((r) => r.payload).filter((p) => p && typeof p === 'object');
  const maxFetched = rows.reduce((acc, r) => {
    if (!r.upstream_fetched_at) return acc;
    const t = new Date(r.upstream_fetched_at).getTime();
    return Number.isFinite(t) && t > acc ? t : acc;
  }, 0);

  return {
    rows: payloads,
    count: payloads.length,
    upstream_fetched_at: maxFetched ? new Date(maxFetched).toISOString() : null,
    registry_rows: rows,
  };
}

export async function getRegistryDevice(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT * FROM app_device_registry WHERE device_id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * ¿Se puede enviar control?
 * - last_seen ≤ 30 min
 * - upstream_fetched_at reciente (≤ 5 min) → la API de listado estuvo viva
 */
export async function canControlDevice(deviceId, { allowDegraded = false } = {}) {
  const id = String(deviceId || '').trim();
  if (!id) return { ok: false, reason: 'no_device' };

  const reg = await getRegistryDevice(id);
  // Sin fila aún (antes del primer listado): no bloquear — el listado en vivo es la fuente.
  if (!reg) return { ok: true, reason: 'not_in_registry' };

  const fetchedMs = reg.upstream_fetched_at ? new Date(reg.upstream_fetched_at).getTime() : null;
  if (!allowDegraded && (fetchedMs == null || !Number.isFinite(fetchedMs) || (Date.now() - fetchedMs) / 60000 > 5)) {
    return { ok: false, reason: 'fleet_degraded', ageMinutes: null };
  }

  const ms = reg.last_seen_at ? new Date(reg.last_seen_at).getTime() : null;
  if (ms == null || !Number.isFinite(ms)) return { ok: false, reason: 'no_last_seen' };
  const mins = (Date.now() - ms) / 60000;
  if (mins > CONNECTION_STANDBY_MINUTES) {
    return { ok: false, reason: 'stale_connection', ageMinutes: mins };
  }
  return { ok: true, ageMinutes: mins };
}

export async function listTelemetrySamples(deviceId, { hours = TELEMETRY_UI_HOURS } = {}) {
  const id = String(deviceId || '').trim();
  if (!id) return [];
  const h = Number.isFinite(hours) && hours > 0 ? hours : TELEMETRY_UI_HOURS;
  const { rows } = await pool.query(
    `SELECT sampled_at, metrics, source
     FROM app_device_telemetry_samples
     WHERE device_id = $1
       AND sampled_at >= now() - ($2::text || ' hours')::interval
     ORDER BY sampled_at ASC`,
    [id, String(h)]
  );
  return rows;
}
