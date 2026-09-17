/**
 * Migra tunnelEventLog embebido → app_control_bitacora (idempotente por legacy_key).
 *
 * Uso (desde carpeta server/):
 *   npm run migrate:bitacora
 *   node src/migrateBitacora.js --purge
 *
 * dotenv es opcional: si no está instalado, usa DATABASE_URL del entorno.
 */
import { createRequire } from 'module';

try {
  createRequire(import.meta.url)('dotenv').config();
} catch {
  /* DATABASE_URL / .env ya inyectados por el proceso */
}

const SQL_ENSURE_BITACORA = `
CREATE TABLE IF NOT EXISTS app_control_bitacora (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  session_id UUID NULL REFERENCES app_device_control_sessions(id) ON DELETE SET NULL,
  tracking_id UUID NULL REFERENCES app_ripening_processes(id) ON DELETE SET NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'control',
  action VARCHAR(96) NOT NULL,
  kind VARCHAR(64) NULL,
  process_type VARCHAR(32) NULL,
  summary TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_email VARCHAR(320) NULL,
  legacy_key VARCHAR(240) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bitacora_device_time
  ON app_control_bitacora (device_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_time
  ON app_control_bitacora (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_session
  ON app_control_bitacora (session_id, occurred_at DESC)
  WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bitacora_tracking
  ON app_control_bitacora (tracking_id, occurred_at DESC)
  WHERE tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bitacora_action
  ON app_control_bitacora (action, occurred_at DESC);
`;

function wantPurge() {
  return process.argv.includes('--purge');
}

async function main() {
  // Imports dinámicos: dotenv ya intentó cargar antes.
  const { pool } = await import('./db.js');
  const { migrateTunnelEventLogArray } = await import('./bitacora.js');

  await pool.query(SQL_ENSURE_BITACORA);
  console.log('[migrateBitacora] table app_control_bitacora OK');

  const sessions = await pool.query(
    `SELECT id, device_id, process_type, params
     FROM app_device_control_sessions
     WHERE params ? 'tunnelEventLog'
       AND jsonb_typeof(params->'tunnelEventLog') = 'array'
       AND jsonb_array_length(params->'tunnelEventLog') > 0
     ORDER BY created_at ASC`
  );
  let sessionInserted = 0;
  for (const row of sessions.rows) {
    const n = await migrateTunnelEventLogArray(row.params?.tunnelEventLog, {
      deviceId: row.device_id,
      sessionId: row.id,
      processType: row.process_type,
    });
    sessionInserted += n;
    if (n) console.log(`[migrateBitacora] session ${row.id} +${n}`);
  }

  const tracking = await pool.query(
    `SELECT id, payload
     FROM app_ripening_processes
     WHERE payload ? 'tunnelEventLog'
       AND jsonb_typeof(payload->'tunnelEventLog') = 'array'
       AND jsonb_array_length(payload->'tunnelEventLog') > 0
     ORDER BY created_at ASC`
  );
  let trackingInserted = 0;
  for (const row of tracking.rows) {
    const deviceId = String(row.payload?.deviceId ?? '').trim();
    if (!deviceId) continue;
    const n = await migrateTunnelEventLogArray(row.payload.tunnelEventLog, {
      deviceId,
      trackingId: row.id,
      processType: row.payload?.trackingControl?.processType ?? null,
    });
    trackingInserted += n;
    if (n) console.log(`[migrateBitacora] tracking ${row.id} +${n}`);
  }

  console.log('[migrateBitacora] sessions scanned', sessions.rows.length, 'inserted', sessionInserted);
  console.log('[migrateBitacora] tracking scanned', tracking.rows.length, 'inserted', trackingInserted);

  if (wantPurge()) {
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
    console.log('[migrateBitacora] purged', {
      sessionsUpdated: s.rowCount ?? 0,
      trackingUpdated: t.rowCount ?? 0,
    });
  } else {
    console.log('[migrateBitacora] tip: re-run with --purge after verifying UI reads /api/v1/bitacora');
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
