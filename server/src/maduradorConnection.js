/** Conexión en línea según antigüedad del último dato Madurador (misma lógica que la UI). */

export const CONNECTION_STANDBY_MINUTES = 30;
export const CONNECTION_OFFLINE_MINUTES = 720;
export const MADURADOR_SERVER_TIMEZONE = 'America/Lima';

const TZ_AWARE_SUFFIX = /([Zz]|[+-]\d{2}:?\d{2})$/;

function extractMaduradorDateString(v) {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'object' && v !== null && '$date' in v) {
    const d = v.$date;
    if (typeof d === 'string' && d.trim()) return d.trim();
  }
  return null;
}

function civilPartsFromNaive(raw) {
  const normalized = raw.trim().replace(' ', 'T');
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!m) return null;
  const frac = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0;
  return {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    h: Number(m[4]),
    mi: Number(m[5]),
    s: Number(m[6]),
    ms: Number.isFinite(frac) ? frac : 0,
  };
}

function getCivilPartsInZone(utcMs, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const map = Object.fromEntries(fmt.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return {
    y: Number(map.year),
    mo: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour),
    mi: Number(map.minute),
    s: Number(map.second),
    ms: 0,
  };
}

function civilPartsToUtcGuess(parts) {
  return Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi, parts.s, parts.ms);
}

export function maduradorServerTimestampToMs(v, timeZone = MADURADOR_SERVER_TIMEZONE) {
  const raw = extractMaduradorDateString(v);
  if (!raw) return null;
  if (TZ_AWARE_SUFFIX.test(raw)) {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  const parts = civilPartsFromNaive(raw);
  if (!parts) {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  let utcMs = civilPartsToUtcGuess(parts);
  for (let i = 0; i < 4; i++) {
    const seen = getCivilPartsInZone(utcMs, timeZone);
    const targetMs = civilPartsToUtcGuess(parts);
    const seenMs = civilPartsToUtcGuess(seen);
    const delta = targetMs - seenMs;
    if (delta === 0) break;
    utcMs += delta;
  }
  return utcMs;
}

export function minutesSinceUtcMs(sampleMs, nowMs = Date.now()) {
  if (!Number.isFinite(sampleMs)) return 999999;
  return (nowMs - sampleMs) / 60000;
}

export function connectionStateFromAgeMinutes(mins) {
  if (!Number.isFinite(mins) || mins > CONNECTION_OFFLINE_MINUTES) {
    return { status: 'offline', estado_conexion: 'offline' };
  }
  if (mins > CONNECTION_STANDBY_MINUTES) {
    return { status: 'warning', estado_conexion: 'wait' };
  }
  return { status: 'active', estado_conexion: 'online' };
}

function flatMaduradorRow(row) {
  if (!row || typeof row !== 'object') return {};
  const flat = { ...row };
  const ud = row.ultimo_dato;
  if (ud && typeof ud === 'object' && !Array.isArray(ud)) {
    Object.assign(flat, ud);
  }
  return flat;
}

export function rowLastSeenMs(row) {
  if (!row) return null;
  const flat = flatMaduradorRow(row);
  return (
    maduradorServerTimestampToMs(flat.fecha) ??
    maduradorServerTimestampToMs(row.hasta) ??
    maduradorServerTimestampToMs(row.fecha_procesada) ??
    null
  );
}

/** En línea = último dato ≤ 30 min (estado «online» en flota). */
export function isDeviceRowOnline(row) {
  const ms = rowLastSeenMs(row);
  if (ms == null) return false;
  const mins = minutesSinceUtcMs(ms);
  return connectionStateFromAgeMinutes(mins).estado_conexion === 'online';
}
