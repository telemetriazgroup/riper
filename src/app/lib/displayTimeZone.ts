/**
 * Zonas fijas (sin horario de verano) vía IANA.
 * Nomenclatura IANA: Etc/GMT+N corresponde a un offset *negativo* respecto a UTC
 * (p. ej. Etc/GMT+5 = 5 h detrás de UTC, es decir "GMT-5" coloquial).
 * Ref: https://en.wikipedia.org/wiki/Tz_database#Area
 */
export const DEFAULT_DISPLAY_TIMEZONE = 'Etc/GMT+5';

/** `labelKey` = clave en SettingsContext `t()`; `gmtLabel` = respaldo. */
export const DISPLAY_TIMEZONE_PRESETS: { value: string; gmtLabel: string; labelKey: string }[] = [
  { value: 'Etc/GMT+3', gmtLabel: 'GMT-3', labelKey: 'tz_gmt3' },
  { value: 'Etc/GMT+4', gmtLabel: 'GMT-4', labelKey: 'tz_gmt4' },
  { value: 'Etc/GMT+5', gmtLabel: 'GMT-5', labelKey: 'tz_gmt5' },
  { value: 'Etc/GMT+6', gmtLabel: 'GMT-6', labelKey: 'tz_gmt6' },
  { value: 'Etc/GMT+7', gmtLabel: 'GMT-7', labelKey: 'tz_gmt7' },
  { value: 'Etc/GMT+8', gmtLabel: 'GMT-8', labelKey: 'tz_gmt8' },
  { value: 'America/Mexico_City', gmtLabel: 'México (oficial)', labelKey: 'tz_mexico_city' },
  { value: 'America/Bogota', gmtLabel: 'Colombia', labelKey: 'tz_bogota' },
  { value: 'America/Lima', gmtLabel: 'Perú', labelKey: 'tz_lima' },
  { value: 'UTC', gmtLabel: 'UTC', labelKey: 'tz_utc' },
];

export function formatInDisplayTimeZone(
  input: string | number | Date | null | undefined,
  timeZone: string,
  language: 'es' | 'en',
  withSeconds = false
): string {
  if (input == null || input === '') return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'es' ? 'es-419' : 'en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(d);
}

export function formatDateShortInDisplayTimeZone(
  input: string | number | Date | null | undefined,
  timeZone: string,
  language: 'es' | 'en'
): string {
  if (input == null || input === '') return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'es' ? 'es-419' : 'en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

const dayKeyInZone = (d: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

/**
 * Misma lógica que en la gráfica: etiquetas corta / eje con día si cambia de día (en el huso elegido).
 */
export function formatChartPointLabels(
  d: Date,
  prev: Date | null,
  timeZone: string,
  language: 'es' | 'en'
): { timeStr: string; timeAxisLabel: string } {
  const timeStr = new Intl.DateTimeFormat(language === 'es' ? 'es-419' : 'en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

  const sameDay = prev != null && dayKeyInZone(d, timeZone) === dayKeyInZone(prev, timeZone);
  if (sameDay) {
    const timeOnly = new Intl.DateTimeFormat(language === 'es' ? 'es-419' : 'en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return { timeStr, timeAxisLabel: timeOnly };
  }
  if (language === 'es') {
    const withMonth = new Intl.DateTimeFormat('es-419', {
      timeZone,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return { timeStr, timeAxisLabel: withMonth };
  }
  const withMonth = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return { timeStr, timeAxisLabel: withMonth };
}

/** Sufijo de archivo: `yyyy-MM-dd_HHmm` en el huso de visualización. */
export function formatFileTimestampInDisplayTimeZone(
  input: string | number | Date,
  timeZone: string
): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return 'invalid';
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${datePart.replace(/\//g, '-')}_${timePart.replace(/:/g, '')}`;
}
