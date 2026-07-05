import { pool } from './db.js';

let cache = null;
let cacheAt = 0;
const CACHE_MS = 5_000;

function envRipeningCo2Ventilation220Enabled() {
  const raw = process.env.RIPENING_CO2_VENTILATION_220;
  if (raw == null || String(raw).trim() === '') return null;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function normalizeControlAutomationConfig(row) {
  const envOverride = envRipeningCo2Ventilation220Enabled();
  return {
    ripening_co2_ventilation_220:
      envOverride != null
        ? envOverride
        : Boolean(row?.ripening_co2_ventilation_220),
    updated_at: row?.updated_at ?? null,
  };
}

export async function loadControlAutomationConfig({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && cache && now - cacheAt < CACHE_MS) {
    return cache;
  }
  const { rows } = await pool.query(
    `SELECT ripening_co2_ventilation_220, updated_at FROM app_control_automation_config WHERE id = 1`
  );
  const normalized = normalizeControlAutomationConfig(rows[0] ?? {});
  cache = normalized;
  cacheAt = now;
  return normalized;
}

export async function isRipeningCo2Ventilation220Enabled() {
  const cfg = await loadControlAutomationConfig();
  return Boolean(cfg.ripening_co2_ventilation_220);
}

export function invalidateControlAutomationConfigCache() {
  cache = null;
  cacheAt = 0;
}

export async function updateControlAutomationConfig(patch) {
  const ripening =
    patch?.ripening_co2_ventilation_220 === true ||
    patch?.ripeningCo2Ventilation220 === true;
  const { rows } = await pool.query(
    `UPDATE app_control_automation_config
     SET ripening_co2_ventilation_220 = $1, updated_at = now()
     WHERE id = 1
     RETURNING ripening_co2_ventilation_220, updated_at`,
    [ripening]
  );
  invalidateControlAutomationConfigCache();
  return normalizeControlAutomationConfig(rows[0] ?? { ripening_co2_ventilation_220: ripening });
}
