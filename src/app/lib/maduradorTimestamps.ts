/**
 * Timestamps de la API Madurador upstream sin sufijo de zona (p. ej. `2026-05-05T10:00:07.866000`)
 * son hora civil en la zona del servidor (GMT-5 / Perú), no la hora local del navegador.
 * Interpretarlos como hora local del cliente desplaza ~1 h la antigüedad del dato (falso "wait").
 */

/** Misma referencia que queries `buscar_datos_madurador_rango` (America/Lima = UTC-5 fijo). */
export const MADURADOR_SERVER_TIMEZONE = 'America/Lima';

const TZ_AWARE_SUFFIX = /([Zz]|[+-]\d{2}:?\d{2})$/;

/** Extrae string ISO/Mongo de un campo fecha. */
export function extractMaduradorDateString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'object' && v !== null && '$date' in v) {
    const d = (v as { $date?: unknown }).$date;
    if (typeof d === 'string' && d.trim()) return d.trim();
  }
  return null;
}

type CivilParts = { y: number; mo: number; d: number; h: number; mi: number; s: number; ms: number };

function civilPartsFromNaive(raw: string): CivilParts | null {
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

function getCivilPartsInZone(utcMs: number, timeZone: string): CivilParts {
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

function civilPartsToUtcGuess(parts: CivilParts): number {
  return Date.UTC(parts.y, parts.mo - 1, parts.d, parts.h, parts.mi, parts.s, parts.ms);
}

/** Convierte hora civil en `timeZone` del servidor a epoch UTC (ms). */
export function maduradorServerTimestampToMs(
  v: unknown,
  timeZone: string = MADURADOR_SERVER_TIMEZONE
): number | null {
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

export function maduradorServerTimestampToIso(
  v: unknown,
  timeZone: string = MADURADOR_SERVER_TIMEZONE
): string | null {
  const ms = maduradorServerTimestampToMs(v, timeZone);
  if (ms == null) return null;
  return new Date(ms).toISOString();
}

export const CONNECTION_STANDBY_MINUTES = 30;
export const CONNECTION_OFFLINE_MINUTES = 720;

export function minutesSinceUtcMs(sampleMs: number, nowMs: number = Date.now()): number {
  if (!Number.isFinite(sampleMs)) return 999999;
  return (nowMs - sampleMs) / 60000;
}

export function connectionStateFromAgeMinutes(mins: number): {
  status: 'active' | 'warning' | 'offline';
  estado_conexion: 'online' | 'wait' | 'offline';
} {
  if (!Number.isFinite(mins) || mins > CONNECTION_OFFLINE_MINUTES) {
    return { status: 'offline', estado_conexion: 'offline' };
  }
  if (mins > CONNECTION_STANDBY_MINUTES) {
    return { status: 'warning', estado_conexion: 'wait' };
  }
  return { status: 'active', estado_conexion: 'online' };
}

export function connectionStateFromSample(v: unknown): {
  lastSeenIso: string;
  mins: number;
  status: 'active' | 'warning' | 'offline';
  estado_conexion: 'online' | 'wait' | 'offline';
} {
  const ms = maduradorServerTimestampToMs(v);
  const lastSeenIso = ms != null ? new Date(ms).toISOString() : new Date(0).toISOString();
  const mins = ms != null ? minutesSinceUtcMs(ms) : 999999;
  const conn = connectionStateFromAgeMinutes(mins);
  return { lastSeenIso, mins, ...conn };
}
