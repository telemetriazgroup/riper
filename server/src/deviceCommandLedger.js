/**
 * Último comando enviado por IMEI (bitácora + memoria) para polls de etileno en idle.
 */
import { pool } from './db.js';
import { parseSessionParams } from './controlProcessParams.js';
import { resolveProcessControlAdapter } from './processControlAdapter.js';

export const IDLE_COMMAND_QUIET_MS = 10 * 60 * 1000;

const recentByImei = new Map();
let dbScanCache = { at: 0, byImei: new Map() };
const DB_SCAN_TTL_MS = 90 * 1000;

const NON_COMMAND_ACTIONS = new Set([
  'check_temperature',
  'check_humidity',
  'check_co2_setpoint',
  'check_ventilation_avl',
  'ethylene_read',
  'ethylene_read_ignored_zero',
  'process_automation_started',
  'process_started',
  'process_completed',
  'process_cancelled',
  'hourly_review_restart',
  'ethylene_skip_dose',
  'co2_skip_after_max_attempts',
  'temp_skip_after_max_attempts',
  'humidity_skip_after_max_attempts',
  'tracking_phase_change',
]);

function isCommandEvent(ev) {
  const action = String(ev?.action ?? '').trim();
  if (!action) return false;
  if (NON_COMMAND_ACTIONS.has(action)) return false;
  if (action.startsWith('check_')) return false;
  return true;
}

function eventAtMs(ev) {
  const at = ev?.at;
  if (!at) return 0;
  const t = new Date(at).getTime();
  return Number.isFinite(t) ? t : 0;
}

function eventMatchesImei(ev, imei) {
  const want = String(imei || '').trim();
  if (!want) return false;
  if (String(ev?.imei ?? '').trim() === want) return true;
  if (Array.isArray(ev?.urls)) {
    return ev.urls.some((u) => String(u?.imei ?? '').trim() === want);
  }
  const url = String(ev?.url ?? '');
  if (url && url.includes(want)) return true;
  return false;
}

function maxCommandTimeInLog(log, imei) {
  if (!Array.isArray(log)) return 0;
  let max = 0;
  for (const ev of log) {
    if (!isCommandEvent(ev)) continue;
    if (!eventMatchesImei(ev, imei)) continue;
    max = Math.max(max, eventAtMs(ev));
  }
  return max;
}

function stepsMatchImei(steps, imei) {
  const want = String(imei || '').trim();
  if (!Array.isArray(steps)) return false;
  return steps.some((s) => {
    const url = String(s?.url ?? '');
    return url.includes(want);
  });
}

async function refreshDbScanCache() {
  const now = Date.now();
  if (now - dbScanCache.at < DB_SCAN_TTL_MS) return;

  const byImei = new Map();

  const bump = (imei, ms) => {
    const id = String(imei || '').trim();
    if (!id || !ms) return;
    byImei.set(id, Math.max(byImei.get(id) ?? 0, ms));
  };

  const { rows: sessions } = await pool.query(
    `SELECT device_id, params, updated_at FROM app_device_control_sessions
     WHERE updated_at > now() - interval '48 hours' AND archived_at IS NULL
     ORDER BY updated_at DESC LIMIT 120`
  );
  for (const row of sessions) {
    const params = parseSessionParams(row.params);
    const log = params.tunnelEventLog;
    const updatedMs = new Date(row.updated_at).getTime();
    if (Array.isArray(log)) {
      for (const ev of log) {
        if (!isCommandEvent(ev)) continue;
        const at = eventAtMs(ev);
        if (ev.imei) bump(ev.imei, at);
        if (Array.isArray(ev.urls)) {
          for (const u of ev.urls) bump(u?.imei, at);
        }
      }
    }
    bump(row.device_id, updatedMs);
  }

  const { rows: tracking } = await pool.query(
    `SELECT payload, updated_at FROM app_ripening_processes
     WHERE deleted_at IS NULL AND updated_at > now() - interval '48 hours'
     ORDER BY updated_at DESC LIMIT 80`
  );
  for (const row of tracking) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const deviceId = String(payload.deviceId ?? '').trim();
    const log = payload.tunnelEventLog;
    if (Array.isArray(log)) {
      for (const ev of log) {
        if (!isCommandEvent(ev)) continue;
        const at = eventAtMs(ev);
        if (ev.imei) bump(ev.imei, at);
        if (Array.isArray(ev.urls)) {
          for (const u of ev.urls) bump(u?.imei, at);
        }
        if (deviceId) bump(deviceId, at);
      }
    }
  }

  const { rows: jobs } = await pool.query(
    `SELECT device_id, steps, updated_at FROM app_tunnel_command_jobs
     WHERE updated_at > now() - interval '48 hours'
     ORDER BY updated_at DESC LIMIT 300`
  );
  for (const job of jobs) {
    const updatedMs = new Date(job.updated_at).getTime();
    bump(job.device_id, updatedMs);
    if (stepsMatchImei(job.steps, job.device_id)) {
      bump(job.device_id, updatedMs);
    }
    if (Array.isArray(job.steps)) {
      for (const step of job.steps) {
        const url = String(step?.url ?? '');
        const m = url.match(/\/([^/?]+)\?/);
        if (m) bump(m[1], updatedMs);
      }
    }
  }

  dbScanCache = { at: now, byImei };
}

/** Registrar envío inmediato (comandos upstream). */
export function noteImeiCommandSent(imei, _detail) {
  const id = String(imei || '').trim();
  if (!id) return;
  recentByImei.set(id, Date.now());
}

export async function lastCommandAtForImei(imei) {
  const id = String(imei || '').trim();
  if (!id) return null;
  await refreshDbScanCache();
  const mem = recentByImei.get(id) ?? 0;
  const db = dbScanCache.byImei.get(id) ?? 0;
  const max = Math.max(mem, db);
  return max > 0 ? max : null;
}

export function deviceIdRelatesToImei(deviceId, imei) {
  const dev = String(deviceId || '').trim();
  const want = String(imei || '').trim();
  if (!dev || !want) return false;
  if (dev === want) return true;
  const adapter = resolveProcessControlAdapter(dev);
  if (!adapter) return false;
  try {
    const units = new Set([
      ...(adapter.fanOutUnits?.(dev) ?? [dev]),
      adapter.sensorUnit?.(dev) ?? dev,
      ...(adapter.commandImeis?.(dev, 0) ?? []),
      ...(adapter.commandImeis?.(dev, 1) ?? []),
    ]);
    return units.has(want);
  } catch {
    return false;
  }
}
