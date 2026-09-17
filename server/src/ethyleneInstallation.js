/**
 * Instalación de balón de etileno + prueba de calibración (10–50 ppm).
 * Reutiliza ethyleneReading + sendEthyleneDoseWithDeviceConfig (no Ripening completo).
 */
import { pool } from './db.js';
import {
  computeInitialEthyleneDose,
  computeProportionalEthyleneDose,
  recordEthyleneDose,
  resolveEthyleneReading,
} from './ethyleneReading.js';
import { resolveProcessControlAdapter } from './processControlAdapter.js';
import { fetchDeviceRowByImei, readTelemetryField } from './tunnelCommandTelemetry.js';
import {
  sendEthyleneDoseCommand,
  sendEthylenePollCommand,
} from './tunelControlClient.js';
import { sendEthyleneDoseWithDeviceConfig } from './ethyleneDeviceConfig.js';
import { canControlDevice, getRegistryDevice } from './deviceRegistry.js';
import { queueBitacoraEvent } from './bitacora.js';

export const TEST_PPM_MIN = 10;
export const TEST_PPM_MAX = 50;
export const TEST_TOLERANCE = 0.5;
export const TEST_TICK_MS = 35_000;
export const TEST_MAX_MS = 2 * 60 * 60 * 1000;
/** Segundos estimados por ppm de dosis lógica (reporte). */
export const SECONDS_PER_PPM_ESTIMATE = 1;

const runningTicks = new Map();

export function serializeInstallation(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    device_id: row.device_id,
    user_id: row.user_id ?? null,
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
    status: row.status,
    notes: row.notes ?? null,
    flowmeter_lpm: row.flowmeter_lpm != null ? Number(row.flowmeter_lpm) : null,
    test_target_ppm: row.test_target_ppm != null ? Number(row.test_target_ppm) : null,
    test_started_at: row.test_started_at ? new Date(row.test_started_at).toISOString() : null,
    test_completed_at: row.test_completed_at ? new Date(row.test_completed_at).toISOString() : null,
    test_elapsed_seconds: row.test_elapsed_seconds != null ? Number(row.test_elapsed_seconds) : null,
    test_total_injection_seconds:
      row.test_total_injection_seconds != null ? Number(row.test_total_injection_seconds) : 0,
    test_baseline_ppm: row.test_baseline_ppm != null ? Number(row.test_baseline_ppm) : null,
    test_final_ppm: row.test_final_ppm != null ? Number(row.test_final_ppm) : null,
    test_summary: row.test_summary ?? {},
    notified_at: row.notified_at ? new Date(row.notified_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    ...extras,
  };
}

export async function listInstallationsForDevice(deviceId, { limit = 50 } = {}) {
  const id = String(deviceId || '').trim();
  if (!id) return [];
  const { rows } = await pool.query(
    `SELECT i.*, u.name AS user_name, u.email AS user_email
     FROM app_ethylene_installations i
     LEFT JOIN app_users u ON u.id = i.user_id
     WHERE i.device_id = $1
     ORDER BY i.created_at DESC
     LIMIT $2`,
    [id, Math.min(200, Math.max(1, Number(limit) || 50))]
  );
  return rows.map((r) => serializeInstallation(r));
}

export async function getInstallationById(id) {
  const { rows } = await pool.query(
    `SELECT i.*, u.name AS user_name, u.email AS user_email
     FROM app_ethylene_installations i
     LEFT JOIN app_users u ON u.id = i.user_id
     WHERE i.id = $1::uuid`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listPhotos(installationId) {
  const { rows } = await pool.query(
    `SELECT id, kind, file_path, original_name, created_at
     FROM app_ethylene_installation_photos
     WHERE installation_id = $1::uuid
     ORDER BY created_at ASC`,
    [installationId]
  );
  return rows;
}

export async function listDoses(installationId) {
  const { rows } = await pool.query(
    `SELECT id, occurred_at, dose_ppm, physical_dato, reading_before, reading_after,
            injection_seconds, meta
     FROM app_ethylene_installation_doses
     WHERE installation_id = $1::uuid
     ORDER BY occurred_at ASC`,
    [installationId]
  );
  return rows;
}

export async function createInstallation({ deviceId, userId, notes, flowmeterLpm }) {
  const device_id = String(deviceId || '').trim();
  if (!device_id) {
    const err = new Error('deviceId required');
    err.status = 400;
    throw err;
  }
  const { rows } = await pool.query(
    `INSERT INTO app_ethylene_installations (device_id, user_id, status, notes, flowmeter_lpm)
     VALUES ($1, $2::uuid, 'documented', $3, $4)
     RETURNING *`,
    [
      device_id,
      userId ?? null,
      notes != null ? String(notes).slice(0, 4000) : null,
      flowmeterLpm != null && Number.isFinite(Number(flowmeterLpm)) ? Number(flowmeterLpm) : null,
    ]
  );
  return rows[0];
}

export async function addPhoto({ installationId, kind, filePath, originalName }) {
  const k = String(kind || 'other').slice(0, 32);
  const { rows } = await pool.query(
    `INSERT INTO app_ethylene_installation_photos (installation_id, kind, file_path, original_name)
     VALUES ($1::uuid, $2, $3, $4)
     RETURNING *`,
    [installationId, k, filePath, originalName ?? null]
  );
  return rows[0];
}

export async function listPendingNotices(deviceId) {
  const id = String(deviceId || '').trim();
  const { rows } = await pool.query(
    `SELECT i.*, u.name AS user_name, u.email AS user_email
     FROM app_ethylene_installations i
     LEFT JOIN app_users u ON u.id = i.user_id
     WHERE i.device_id = $1
       AND i.status = 'completed'
       AND i.notified_at IS NULL
       AND i.test_completed_at IS NOT NULL
     ORDER BY i.test_completed_at DESC
     LIMIT 5`,
    [id]
  );
  return rows.map((r) => serializeInstallation(r));
}

export async function ackNotice(installationId) {
  await pool.query(
    `UPDATE app_ethylene_installations
     SET notified_at = now(), updated_at = now()
     WHERE id = $1::uuid AND notified_at IS NULL`,
    [installationId]
  );
}

function resolveAdapterOrFallback(deviceId) {
  const adapter = resolveProcessControlAdapter(deviceId);
  if (adapter) return adapter;
  return {
    fleet: 'generic',
    empresaIdentificador: null,
    fanOutUnits(dev) {
      return [String(dev || '').trim()];
    },
    sensorUnit(dev) {
      return String(dev || '').trim();
    },
    sendEthylenePoll(unitId) {
      return sendEthylenePollCommand(unitId);
    },
    sendEthyleneDose(unitId, ppm) {
      return sendEthyleneDoseWithDeviceConfig(unitId, ppm, sendEthyleneDoseCommand);
    },
  };
}

async function resolveEmpresaIdent(deviceId, adapter) {
  if (adapter?.empresaIdentificador) return adapter.empresaIdentificador;
  if (typeof adapter?.identificadorForImei === 'function') {
    return adapter.identificadorForImei(deviceId);
  }
  const reg = await getRegistryDevice(deviceId);
  return reg?.empresa_identificador ?? null;
}

async function readCampo1(deviceId, adapter) {
  const sensor =
    typeof adapter.telemetryImei === 'function'
      ? adapter.telemetryImei(deviceId, 'campo_1')
      : adapter.sensorUnit(deviceId);
  const ident = await resolveEmpresaIdent(deviceId, adapter);
  try {
    await adapter.sendEthylenePoll(sensor);
  } catch (e) {
    console.warn('[eth-install] poll', e.message);
  }
  await new Promise((r) => setTimeout(r, 2500));
  const row = await fetchDeviceRowByImei(sensor, ident);
  return readTelemetryField(row, 'campo_1');
}

export async function startInstallationTest(installationId, targetPpm, { userEmail } = {}) {
  const target = Number(targetPpm);
  if (!Number.isFinite(target) || target < TEST_PPM_MIN || target > TEST_PPM_MAX) {
    const err = new Error(`targetPpm must be between ${TEST_PPM_MIN} and ${TEST_PPM_MAX}`);
    err.status = 400;
    throw err;
  }

  const row = await getInstallationById(installationId);
  if (!row) {
    const err = new Error('installation not found');
    err.status = 404;
    throw err;
  }
  if (row.status === 'testing') {
    const err = new Error('test already running');
    err.status = 409;
    throw err;
  }

  const gate = await canControlDevice(row.device_id);
  if (!gate.ok) {
    const err = new Error('device not ready for control (offline or degraded fleet)');
    err.status = 503;
    err.reason = gate.reason;
    throw err;
  }

  const { rows: active } = await pool.query(
    `SELECT id FROM app_ethylene_installations
     WHERE device_id = $1 AND status = 'testing' AND id <> $2::uuid
     LIMIT 1`,
    [row.device_id, installationId]
  );
  if (active.length) {
    const err = new Error('another test is already running on this device');
    err.status = 409;
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE app_ethylene_installations
     SET status = 'testing',
         test_target_ppm = $2,
         test_started_at = now(),
         test_completed_at = NULL,
         test_elapsed_seconds = NULL,
         test_total_injection_seconds = 0,
         test_baseline_ppm = NULL,
         test_final_ppm = NULL,
         test_summary = '{}'::jsonb,
         notified_at = NULL,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [installationId, target]
  );

  queueBitacoraEvent({
    deviceId: row.device_id,
    userEmail: userEmail ?? null,
    action: 'ethylene_installation_test_started',
    source: 'ethylene_installation',
    processType: 'InstallationTest',
    summary: `Prueba instalación etileno → ${target} ppm`,
    entry: { installationId, targetPpm: target },
  });

  scheduleTestTick(installationId);
  return rows[0];
}

export async function cancelInstallationTest(installationId, { userEmail } = {}) {
  stopTestTick(installationId);
  const row = await getInstallationById(installationId);
  if (!row) {
    const err = new Error('installation not found');
    err.status = 404;
    throw err;
  }
  const { rows } = await pool.query(
    `UPDATE app_ethylene_installations
     SET status = 'cancelled',
         test_completed_at = now(),
         test_elapsed_seconds = CASE
           WHEN test_started_at IS NOT NULL
           THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - test_started_at))::int)
           ELSE test_elapsed_seconds
         END,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [installationId]
  );
  queueBitacoraEvent({
    deviceId: row.device_id,
    userEmail: userEmail ?? null,
    action: 'ethylene_installation_test_cancelled',
    source: 'ethylene_installation',
    processType: 'InstallationTest',
    summary: 'Prueba de instalación etileno cancelada',
    entry: { installationId },
  });
  return rows[0];
}

function stopTestTick(installationId) {
  const t = runningTicks.get(installationId);
  if (t) {
    clearTimeout(t);
    runningTicks.delete(installationId);
  }
}

export function scheduleTestTick(installationId, delayMs = 3_000) {
  stopTestTick(installationId);
  const handle = setTimeout(() => {
    void runTestTick(installationId).catch((e) =>
      console.warn('[eth-install] tick', installationId, e.message)
    );
  }, delayMs);
  runningTicks.set(installationId, handle);
}

async function completeTest(installationId, finalPpm, summaryPatch = {}) {
  stopTestTick(installationId);
  const { rows } = await pool.query(
    `UPDATE app_ethylene_installations
     SET status = 'completed',
         test_completed_at = now(),
         test_final_ppm = $2,
         test_elapsed_seconds = CASE
           WHEN test_started_at IS NOT NULL
           THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - test_started_at))::int)
           ELSE NULL
         END,
         test_summary = COALESCE(test_summary, '{}'::jsonb) || $3::jsonb,
         updated_at = now()
     WHERE id = $1::uuid
     RETURNING *`,
    [installationId, finalPpm, JSON.stringify(summaryPatch)]
  );
  const row = rows[0];
  if (row) {
    queueBitacoraEvent({
      deviceId: row.device_id,
      action: 'ethylene_installation_test_completed',
      source: 'ethylene_installation',
      processType: 'InstallationTest',
      summary: `Calibración instalación OK → ${finalPpm} ppm (objetivo ${row.test_target_ppm})`,
      entry: {
        installationId,
        targetPpm: row.test_target_ppm,
        finalPpm,
        elapsedSeconds: row.test_elapsed_seconds,
      },
    });
  }
  return row;
}

async function failTest(installationId, reason) {
  stopTestTick(installationId);
  await pool.query(
    `UPDATE app_ethylene_installations
     SET status = 'failed',
         test_completed_at = now(),
         test_elapsed_seconds = CASE
           WHEN test_started_at IS NOT NULL
           THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - test_started_at))::int)
           ELSE NULL
         END,
         test_summary = COALESCE(test_summary, '{}'::jsonb) || $2::jsonb,
         updated_at = now()
     WHERE id = $1::uuid`,
    [installationId, JSON.stringify({ failReason: reason })]
  );
}

async function runTestTick(installationId) {
  const row = await getInstallationById(installationId);
  if (!row || row.status !== 'testing') {
    stopTestTick(installationId);
    return;
  }

  const started = row.test_started_at ? new Date(row.test_started_at).getTime() : Date.now();
  if (Date.now() - started > TEST_MAX_MS) {
    await failTest(installationId, 'timeout');
    return;
  }

  const adapter = resolveAdapterOrFallback(row.device_id);
  const target = Number(row.test_target_ppm);
  const raw = await readCampo1(row.device_id, adapter);
  const summary = row.test_summary && typeof row.test_summary === 'object' ? { ...row.test_summary } : {};
  const ethMeta = summary.ethMeta && typeof summary.ethMeta === 'object' ? { ...summary.ethMeta } : {};
  const resolved = resolveEthyleneReading(raw, ethMeta);
  const effective = resolved.effective;

  if (row.test_baseline_ppm == null && effective != null) {
    await pool.query(
      `UPDATE app_ethylene_installations
       SET test_baseline_ppm = $2, updated_at = now()
       WHERE id = $1::uuid`,
      [installationId, effective]
    );
  }

  if (effective != null && effective >= target - TEST_TOLERANCE) {
    await completeTest(installationId, effective, {
      ethMeta: resolved,
      lastReading: effective,
      completedReason: 'target_reached',
    });
    return;
  }

  const doses = await listDoses(installationId);
  let dose = 0;
  if (!doses.length) {
    dose = computeInitialEthyleneDose(effective ?? 0, target);
  } else {
    dose = computeProportionalEthyleneDose(ethMeta, target, effective);
    if (dose <= 0 && recentlyNoRise(ethMeta, effective)) {
      const remaining = Math.max(0, target - (effective ?? 0));
      dose = remaining > 0 ? Math.max(1, Math.round(remaining / 4)) : 0;
    }
  }

  if (dose > 0 && (resolved.canInject || !doses.length)) {
    const units = adapter.fanOutUnits(row.device_id);
    const unitId = units[0] || row.device_id;
    const readingBefore = effective;
    try {
      const sent = await adapter.sendEthyleneDose(unitId, dose);
      const injSec = Number(dose) * SECONDS_PER_PPM_ESTIMATE;
      const nextMeta = recordEthyleneDose(
        ethMeta,
        sent.doseLogical ?? dose,
        readingBefore
      );
      await pool.query(
        `INSERT INTO app_ethylene_installation_doses
           (installation_id, dose_ppm, physical_dato, reading_before, injection_seconds, meta)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)`,
        [
          installationId,
          sent.doseLogical ?? dose,
          sent.datoSent ?? sent.ppm ?? null,
          readingBefore,
          injSec,
          JSON.stringify({ urls: sent.urls ?? null }),
        ]
      );
      await pool.query(
        `UPDATE app_ethylene_installations
         SET test_total_injection_seconds = COALESCE(test_total_injection_seconds, 0) + $2,
             test_summary = COALESCE(test_summary, '{}'::jsonb) || $3::jsonb,
             updated_at = now()
         WHERE id = $1::uuid`,
        [
          installationId,
          injSec,
          JSON.stringify({
            ethMeta: nextMeta,
            lastReading: readingBefore,
            lastDoseLogical: sent.doseLogical ?? dose,
          }),
        ]
      );
    } catch (e) {
      console.warn('[eth-install] dose failed', e.message);
      await pool.query(
        `UPDATE app_ethylene_installations
         SET test_summary = COALESCE(test_summary, '{}'::jsonb) || $2::jsonb,
             updated_at = now()
         WHERE id = $1::uuid`,
        [installationId, JSON.stringify({ lastError: e.message, ethMeta, lastReading: effective })]
      );
    }
  } else {
    await pool.query(
      `UPDATE app_ethylene_installations
       SET test_summary = COALESCE(test_summary, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1::uuid`,
      [
        installationId,
        JSON.stringify({
          ethMeta: { ...ethMeta, ...resolved },
          lastReading: effective,
          waiting: true,
        }),
      ]
    );
  }

  scheduleTestTick(installationId, TEST_TICK_MS);
}

function recentlyNoRise(ethMeta, reading) {
  const at = ethMeta?.lastDoseAt;
  if (!at) return false;
  const t = new Date(at).getTime();
  if (!Number.isFinite(t) || Date.now() - t < 10 * 60 * 1000) return false;
  const baseline = Number(ethMeta?.baselineBeforeDose);
  if (!Number.isFinite(baseline) || reading == null) return true;
  return Number(reading) - baseline <= 0;
}

/** Resume ticks for any testing rows after server restart. */
export async function resumeActiveInstallationTests() {
  const { rows } = await pool.query(
    `SELECT id FROM app_ethylene_installations WHERE status = 'testing'`
  );
  for (const r of rows) {
    scheduleTestTick(r.id, 5_000);
  }
  if (rows.length) console.log('[eth-install] resumed', rows.length, 'tests');
}
