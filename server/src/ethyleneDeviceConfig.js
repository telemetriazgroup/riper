import { pool } from './db.js';
import { clampEthyleneDose } from './ethyleneReading.js';
import { sendEthyleneDoseCommand } from './tunelControlClient.js';

const DEFAULT_MULTIPLIER = 1;
const MIN_MULTIPLIER = 0.1;
const MAX_MULTIPLIER = 20;

let cache = new Map();
let cacheAt = 0;
const CACHE_MS = 5_000;

function normalizeMultiplier(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MULTIPLIER;
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, Number(n.toFixed(2))));
}

export function normalizeEthyleneDeviceConfigRow(row) {
  return {
    device_id: String(row?.device_id ?? '').trim(),
    injection_multiplier: normalizeMultiplier(row?.injection_multiplier ?? DEFAULT_MULTIPLIER),
    updated_at: row?.updated_at ?? null,
    updated_by: row?.updated_by ?? null,
  };
}

export async function loadEthyleneDeviceConfigMap({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && cache && now - cacheAt < CACHE_MS) {
    return cache;
  }
  const { rows } = await pool.query(
    `SELECT device_id, injection_multiplier, updated_at, updated_by
     FROM app_device_ethylene_config
     ORDER BY device_id ASC`
  );
  const map = new Map();
  for (const row of rows) {
    const normalized = normalizeEthyleneDeviceConfigRow(row);
    if (normalized.device_id) map.set(normalized.device_id, normalized);
  }
  cache = map;
  cacheAt = now;
  return map;
}

export function invalidateEthyleneDeviceConfigCache() {
  cache = new Map();
  cacheAt = 0;
}

export async function getEthyleneInjectionMultiplier(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) return DEFAULT_MULTIPLIER;
  const map = await loadEthyleneDeviceConfigMap();
  const row = map.get(id);
  return row?.injection_multiplier ?? DEFAULT_MULTIPLIER;
}

/**
 * Resuelve dosis lógica (algoritmo) vs física (comando al equipo).
 */
export async function resolveEthyleneDoseForDevice(imei, logicalDose) {
  const id = String(imei || '').trim();
  if (!id) throw new Error('imei required');
  const doseLogical = clampEthyleneDose(logicalDose);
  if (doseLogical <= 0) throw new Error('ethylene dose must be > 0');

  const injectionMultiplier = await getEthyleneInjectionMultiplier(id);
  const datoSent = clampEthyleneDose(Math.round(doseLogical * injectionMultiplier));

  return { doseLogical, datoSent, injectionMultiplier };
}

/**
 * Envía dosis física (logical × multiplicador) pero devuelve dosis lógica para
 * historial proporcional y bitácora orientada al cliente.
 */
export async function sendEthyleneDoseWithDeviceConfig(imei, logicalDose, sendPhysicalFn) {
  const resolved = await resolveEthyleneDoseForDevice(imei, logicalDose);
  const sendFn = sendPhysicalFn ?? sendEthyleneDoseCommand;
  const sent = await sendFn(imei, resolved.datoSent);

  return {
    ...sent,
    ppm: resolved.datoSent,
    doseLogical: resolved.doseLogical,
    datoSent: resolved.datoSent,
    injectionMultiplier: resolved.injectionMultiplier,
  };
}

export async function listEthyleneDeviceConfigs() {
  const map = await loadEthyleneDeviceConfigMap({ bypassCache: true });
  return [...map.values()];
}

export async function upsertEthyleneDeviceConfig(deviceId, injectionMultiplier, updatedBy = null) {
  const id = String(deviceId || '').trim();
  if (!id) throw new Error('device_id required');
  const multiplier = normalizeMultiplier(injectionMultiplier);
  const { rows } = await pool.query(
    `INSERT INTO app_device_ethylene_config (device_id, injection_multiplier, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (device_id) DO UPDATE
       SET injection_multiplier = EXCLUDED.injection_multiplier,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
     RETURNING device_id, injection_multiplier, updated_at, updated_by`,
    [id, multiplier, updatedBy]
  );
  invalidateEthyleneDeviceConfigCache();
  return normalizeEthyleneDeviceConfigRow(rows[0] ?? { device_id: id, injection_multiplier: multiplier });
}

export async function deleteEthyleneDeviceConfig(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) throw new Error('device_id required');
  await pool.query(`DELETE FROM app_device_ethylene_config WHERE device_id = $1`, [id]);
  invalidateEthyleneDeviceConfigCache();
}
