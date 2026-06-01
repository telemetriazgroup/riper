import {
  DEFAULT_DISPLAY_TIMEZONE,
  formatInDisplayTimeZone,
  type DateFormatStyle,
} from '@/app/lib/displayTimeZone';
import { MADURADOR_SERVER_TIMEZONE } from '@/app/lib/maduradorTimestamps';
import type { Language } from '@/app/lib/userPreferences';

/** Zona IANA de referencia de telemetría upstream (hora civil GMT-5 / Perú). */
export const SERVER_TELEMETRY_IANA = MADURADOR_SERVER_TIMEZONE;

/** Misma referencia en nomenclatura Etc/GMT usada por la UI. */
export const SERVER_TELEMETRY_DISPLAY_TZ = DEFAULT_DISPLAY_TIMEZONE;

const US_IANA_TIMEZONES = new Set([
  'America/New_York',
  'America/Detroit',
  'America/Kentucky/Louisville',
  'America/Kentucky/Monticello',
  'America/Indiana/Indianapolis',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Indiana/Marengo',
  'America/Indiana/Petersburg',
  'America/Indiana/Tell_City',
  'America/Indiana/Knox',
  'America/Chicago',
  'America/Menominee',
  'America/North_Dakota/Center',
  'America/North_Dakota/New_Salem',
  'America/North_Dakota/Beulah',
  'America/Denver',
  'America/Boise',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Juneau',
  'America/Sitka',
  'America/Metlakatla',
  'America/Yakutata',
  'America/Nome',
  'America/Adak',
  'Pacific/Honolulu',
]);

/** País inferido del navegador (p. ej. US, PE). */
export function detectCountryCode(): string | null {
  try {
    const langs = navigator.languages?.length ? [...navigator.languages] : [navigator.language];
    for (const lang of langs) {
      if (!lang) continue;
      try {
        const locale = new Intl.Locale(lang);
        if (locale.region) return locale.region.toUpperCase();
      } catch {
        const m = /^[a-z]{2}-([A-Za-z]{2})$/.exec(lang.trim());
        if (m) return m[1].toUpperCase();
      }
    }
  } catch {
    /* ignore */
  }

  const tz = detectBrowserIanaTimeZone();
  if (tz && US_IANA_TIMEZONES.has(tz)) return 'US';
  if (tz === SERVER_TELEMETRY_IANA) return 'PE';
  return null;
}

/** Zona IANA del sistema (p. ej. America/Lima). */
export function detectBrowserIanaTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || SERVER_TELEMETRY_IANA;
  } catch {
    return SERVER_TELEMETRY_IANA;
  }
}

/**
 * Convierte el offset actual del navegador a Etc/GMT±N (sin DST en la etiqueta fija).
 * Ref. displayTimeZone.ts — Etc/GMT+5 = coloquial GMT-5.
 */
export function browserOffsetToEtcGmtTimezone(at: Date = new Date()): string {
  const offsetMinEastOfUtc = -at.getTimezoneOffset();
  if (offsetMinEastOfUtc === 0) return 'UTC';
  const hours = Math.round(Math.abs(offsetMinEastOfUtc) / 60);
  if (hours === 0) return 'UTC';
  return offsetMinEastOfUtc < 0 ? `Etc/GMT+${hours}` : `Etc/GMT-${hours}`;
}

/** Etiqueta coloquial GMT±N a partir de Etc/GMT±N o UTC. */
export function formatColloquialGmtLabel(displayTimeZone: string): string {
  const v = String(displayTimeZone || '').trim();
  if (!v || v === 'UTC') return 'GMT+0';
  const m = /^Etc\/GMT([+-])(\d+)$/.exec(v);
  if (!m) return v;
  const sign = m[1] === '+' ? '-' : '+';
  return `GMT${sign}${m[2]}`;
}

/** Offset fijo en minutos respecto a UTC para zonas Etc/GMT o UTC. */
export function etcGmtToOffsetMinutes(etcTz: string): number | null {
  const v = String(etcTz || '').trim();
  if (v === 'UTC') return 0;
  const m = /^Etc\/GMT([+-])(\d+)$/.exec(v);
  if (!m) return null;
  const h = Number(m[2]);
  return m[1] === '+' ? -h * 60 : h * 60;
}

/**
 * Idioma inicial del login según región:
 * — Estados Unidos → inglés
 * — resto → español
 */
export function detectDefaultLoginLanguage(country: string | null = detectCountryCode()): Language {
  return country === 'US' ? 'en' : 'es';
}

export function detectSystemLocalePreferences(): {
  language: Language;
  display_timezone: string;
  date_format: DateFormatStyle;
  country: string | null;
  browser_iana: string;
} {
  const country = detectCountryCode();
  const browser_iana = detectBrowserIanaTimeZone();
  return {
    language: detectDefaultLoginLanguage(country),
    display_timezone: browserOffsetToEtcGmtTimezone(),
    date_format: country === 'US' ? 'mdy' : 'dmy',
    country,
    browser_iana,
  };
}

/** Diferencia en horas entre dos husos Etc/GMT fijos (positivo = usuario adelantado vs referencia). */
export function fixedTimezoneOffsetHours(userTz: string, referenceTz: string): number | null {
  const u = etcGmtToOffsetMinutes(userTz);
  const r = etcGmtToOffsetMinutes(referenceTz);
  if (u == null || r == null) return null;
  return (u - r) / 60;
}

export function formatTimezoneOffsetDelta(hours: number, language: Language): string {
  if (!Number.isFinite(hours) || Math.abs(hours) < 0.01) {
    return language === 'es' ? 'misma hora que el servidor' : 'same as server time';
  }
  const abs = Math.abs(hours);
  const hLabel = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  if (hours > 0) {
    return language === 'es'
      ? `${hLabel} h adelante respecto al servidor (GMT-5)`
      : `${hLabel} h ahead of server (GMT-5)`;
  }
  return language === 'es'
    ? `${hLabel} h atrás respecto al servidor (GMT-5)`
    : `${hLabel} h behind server (GMT-5)`;
}

export function formatLoginClockSnapshot(
  now: Date,
  displayTimeZone: string,
  language: Language
): {
  localTime: string;
  serverTime: string;
  userGmt: string;
  serverGmt: string;
  offsetNote: string;
} {
  const userGmt = formatColloquialGmtLabel(displayTimeZone);
  const serverGmt = formatColloquialGmtLabel(SERVER_TELEMETRY_DISPLAY_TZ);
  const delta = fixedTimezoneOffsetHours(displayTimeZone, SERVER_TELEMETRY_DISPLAY_TZ);
  return {
    localTime: formatInDisplayTimeZone(now, displayTimeZone, language, true),
    serverTime: formatInDisplayTimeZone(now, SERVER_TELEMETRY_DISPLAY_TZ, language, true),
    userGmt,
    serverGmt,
    offsetNote: delta == null ? '' : formatTimezoneOffsetDelta(delta, language),
  };
}
