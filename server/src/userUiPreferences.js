/** Preferencias de interfaz por usuario (JSONB en app_users.ui_preferences). */

export const DEFAULT_UI_PREFERENCES = {
  language: 'es',
  theme: 'light',
  temp_unit: 'C',
  display_timezone: 'Etc/GMT+5',
  date_format: 'dmy',
};

/** Preferencias crudas desde BD (puede ser `{}`). */
export function rawUiPreferences(row) {
  const raw = row?.ui_preferences;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

export function normalizeUiPreferences(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_UI_PREFERENCES };
  }
  const out = { ...DEFAULT_UI_PREFERENCES };
  if (raw.language === 'es' || raw.language === 'en') out.language = raw.language;
  if (raw.theme === 'light' || raw.theme === 'dark') out.theme = raw.theme;
  const tu = raw.temp_unit ?? raw.tempUnit;
  if (tu === 'C' || tu === 'F') out.temp_unit = tu;
  const tz = raw.display_timezone ?? raw.displayTimeZone;
  if (typeof tz === 'string' && tz.trim()) out.display_timezone = tz.trim();
  const df = raw.date_format ?? raw.dateFormat;
  if (df === 'dmy' || df === 'mdy') out.date_format = df;
  return out;
}

/** Fusiona parcial sobre preferencias actuales y valida. */
export function mergeUiPreferences(current, patch) {
  const base = normalizeUiPreferences(current);
  if (!patch || typeof patch !== 'object') return base;
  return normalizeUiPreferences({ ...base, ...patch });
}

export function hasStoredUiPreferences(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return Boolean(
    raw.language ||
      raw.theme ||
      raw.temp_unit ||
      raw.tempUnit ||
      raw.display_timezone ||
      raw.displayTimeZone ||
      raw.date_format ||
      raw.dateFormat
  );
}
