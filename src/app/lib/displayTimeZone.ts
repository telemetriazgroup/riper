/**
 * Zonas fijas (sin horario de verano) vía IANA.
 * Nomenclatura IANA: Etc/GMT+N corresponde a un offset *negativo* respecto a UTC
 * (p. ej. Etc/GMT+5 = 5 h detrás de UTC, es decir "GMT-5" coloquial).
 * Ref: https://en.wikipedia.org/wiki/Tz_database#Area
 */
export const DEFAULT_DISPLAY_TIMEZONE = 'Etc/GMT+5';

/** Formato de fecha/hora: día/mes/año (normal) o mes/día/año (americano). */
export type DateFormatStyle = 'dmy' | 'mdy';

export const DEFAULT_DATE_FORMAT: DateFormatStyle = 'dmy';

export type GmtTimezoneOption = { value: string; label: string };

/** GMT-12 … GMT+0 … GMT+14 (sin horario de verano). */
export function buildAllGmtTimezoneOptions(): GmtTimezoneOption[] {
  const out: GmtTimezoneOption[] = [];
  for (let n = 12; n >= 1; n--) {
    out.push({ value: `Etc/GMT+${n}`, label: `GMT-${n}` });
  }
  out.push({ value: 'UTC', label: 'GMT+0 (UTC)' });
  for (let n = 1; n <= 14; n++) {
    out.push({ value: `Etc/GMT-${n}`, label: `GMT+${n}` });
  }
  return out;
}

export const ALL_GMT_TIMEZONE_OPTIONS = buildAllGmtTimezoneOptions();

/** Incluye el valor guardado si no está en la lista estándar (p. ej. migración desde zonas regionales). */
export function gmtTimezoneOptionsForSelect(currentValue?: string): GmtTimezoneOption[] {
  const v = String(currentValue || '').trim();
  if (!v || ALL_GMT_TIMEZONE_OPTIONS.some((o) => o.value === v)) {
    return ALL_GMT_TIMEZONE_OPTIONS;
  }
  return [{ value: v, label: v }, ...ALL_GMT_TIMEZONE_OPTIONS];
}

/** @deprecated Usar ALL_GMT_TIMEZONE_OPTIONS */
export const DISPLAY_TIMEZONE_PRESETS = ALL_GMT_TIMEZONE_OPTIONS.map((o) => ({
  value: o.value,
  gmtLabel: o.label,
  labelKey: o.label,
}));

export function isValidDisplayTimeZone(tz: string): boolean {
  const v = String(tz || '').trim();
  if (!v) return false;
  return ALL_GMT_TIMEZONE_OPTIONS.some((o) => o.value === v);
}

export function dateFormatLocale(style: DateFormatStyle, language: 'es' | 'en'): string {
  if (style === 'mdy') return 'en-US';
  return language === 'es' ? 'es-419' : 'en-GB';
}

export function formatInDisplayTimeZone(
  input: string | number | Date | null | undefined,
  timeZone: string,
  language: 'es' | 'en',
  withSeconds = false,
  dateFormat: DateFormatStyle = DEFAULT_DATE_FORMAT
): string {
  if (input == null || input === '') return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(dateFormatLocale(dateFormat, language), {
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
  language: 'es' | 'en',
  dateFormat: DateFormatStyle = DEFAULT_DATE_FORMAT
): string {
  if (input == null || input === '') return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(dateFormatLocale(dateFormat, language), {
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
  language: 'es' | 'en',
  dateFormat: DateFormatStyle = DEFAULT_DATE_FORMAT
): { timeStr: string; timeAxisLabel: string } {
  const locale = dateFormatLocale(dateFormat, language);
  const timeStr = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

  const sameDay = prev != null && dayKeyInZone(d, timeZone) === dayKeyInZone(prev, timeZone);
  if (sameDay) {
    const timeOnly = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return { timeStr, timeAxisLabel: timeOnly };
  }
  const withMonth = new Intl.DateTimeFormat(locale, {
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
