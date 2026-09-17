/**
 * Migra tunnelEventLog embebido → app_control_bitacora (idempotente por legacy_key).
 *
 * Uso:
 *   node src/migrateBitacora.js
 *   node src/migrateBitacora.js --purge   # tras verificar: quita tunnelEventLog de JSON
 */
import 'dotenv/config';
import { pool } from './db.js';
import { migrateTunnelEventLogArray } from './bitacora.js';
import { runMigrate } from './migrate.js';

function wantPurge() {
  return process.argv.includes('--purge');
}

async function migrateSessions() {
  const { rows } = await pool.query(
    `SELECT id, device_id, process_type, params
     FROM app_device_control_sessions
     WHERE params ? 'tunnelEventLog'
       AND jsonb_typeof(params->'tunnelEventLog') = 'array'
       AND jsonb_array_length(params->'tunnelEventLog') > 0
     ORDER BY created_at ASC`
  );
  let inserted = 0;
  for (const row of rows) {
    const log = row.params?.tunnelEventLog;
    const n = await migrateTunnelEventLogArray(log, {
      deviceId: row.device_id,
      sessionId: row.id,
      processType: row.process_type,
    });
    inserted += n;
    if (n) console.log(`[migrateBitacora] session ${row.id} +${n}`);
  }
  return { sessions: rows.length, inserted };
}

async function migrateTracking() {
  const { rows } = await pool.query(
    `SELECT id, payload
     FROM app_ripening_processes
     WHERE payload ? 'tunnelEventLog'
       AND jsonb_typeof(payload->'tunnelEventLog') = 'array'
       AND jsonb_array_length(payload->'tunnelEventLog') > 0
     ORDER BY created_at ASC`
  );
  let inserted = 0;
  for (const row of rows) {
    const deviceId = String(row.payload?.deviceId ?? '').trim();
    if (!deviceId) continue;
    const n = await migrateTunnelEventLogArray(row.payload.tunnelEventLog, {
      deviceId,
      trackingId: row.id,
      processType: row.payload?.trackingControl?.processType ?? null,
    });
    inserted += n;
    if (n) console.log(`[migrateBitacora] tracking ${row.id} +${n}`);
  }
  return { tracking: rows.length, inserted };
}

async function purgeEmbeddedLogs() {
  const s = await pool.query(
    `UPDATE app_device_control_sessions
     SET params = params - 'tunnelEventLog' - 'tunnelJobs',
         updated_at = now()
     WHERE params ? 'tunnelEventLog' OR params ? 'tunnelJobs'`
  );
  await pool.query(
    `UPDATE app_device_control_sessions
     SET params = jsonb_set(
           params,
           '{processAutomation}',
           (params->'processAutomation') - 'coolingDecisionLog',
           true
         ),
         updated_at = now()
     WHERE jsonb_typeof(params->'processAutomation') = 'object'
       AND params->'processAutomation' ? 'coolingDecisionLog'`
  );
  const t = await pool.query(
    `UPDATE app_ripening_processes
     SET payload = payload - 'tunnelEventLog',
         updated_at = now()
     WHERE payload ? 'tunnelEventLog'`
  );
  return {
    sessionsUpdated: s.rowCount ?? 0,
    trackingUpdated: t.rowCount ?? 0,
  };
}

async function main() {
  await runMigrate();
  const a = await migrateSessions();
  const b = await migrateTracking();
  console.log('[migrateBitacora] sessions scanned', a.sessions, 'inserted', a.inserted);
  console.log('[migrateBitacora] tracking scanned', b.tracking, 'inserted', b.inserted);

  if (wantPurge()) {
    const p = await purgeEmbeddedLogs();
    console.log('[migrateBitacora] purged', p);
  } else {
    console.log('[migrateBitacora] tip: re-run with --purge after verifying UI reads /api/v1/bitacora');
  }
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
