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

/** Incluye el valor guardado si no está en la lista estándar (p. ej. zona IANA del navegador). */
export function gmtTimezoneOptionsForSelect(currentValue?: string): GmtTimezoneOption[] {
  const v = String(currentValue || '').trim();
  if (!v || ALL_GMT_TIMEZONE_OPTIONS.some((o) => o.value === v)) {
    return ALL_GMT_TIMEZONE_OPTIONS;
  }
  const label = isValidDisplayTimeZone(v) ? `${formatGmtLabelForTimeZone(v)} (${v})` : v;
  return [{ value: v, label }, ...ALL_GMT_TIMEZONE_OPTIONS];
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
  if (ALL_GMT_TIMEZONE_OPTIONS.some((o) => o.value === v)) return true;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

/** Offset fijo Etc/GMT o UTC en minutos al este de UTC. */
export function etcGmtToOffsetMinutes(etcTz: string): number | null {
  const v = String(etcTz || '').trim();
  if (v === 'UTC') return 0;
  const m = /^Etc\/GMT([+-])(\d+)$/.exec(v);
  if (!m) return null;
  const h = Number(m[2]);
  return m[1] === '+' ? -h * 60 : h * 60;
}

/** Offset en minutos al este de UTC para cualquier zona IANA o Etc/GMT. */
export function getOffsetMinutesEastOfUtc(timeZone: string, at: Date = new Date()): number | null {
  const v = String(timeZone || '').trim();
  if (!v) return null;
  const etc = etcGmtToOffsetMinutes(v);
  if (etc != null) return etc;
  try {
    const part = new Intl.DateTimeFormat('en-US', {
      timeZone: v,
      timeZoneName: 'longOffset',
    })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!part) return null;
    const m = /(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/.exec(part);
    if (!m) return part.includes('0') ? 0 : null;
    const sign = m[1] === '+' ? 1 : -1;
    const hours = Number(m[2]);
    const mins = m[3] ? Number(m[3]) : 0;
    return sign * (hours * 60 + mins);
  } catch {
    return null;
  }
}

/** Etiqueta coloquial GMT±N (respeta DST en zonas IANA regionales). */
export function formatGmtLabelForTimeZone(timeZone: string, at: Date = new Date()): string {
  const offset = getOffsetMinutesEastOfUtc(timeZone, at);
  if (offset == null) return timeZone;
  if (offset === 0) return 'GMT+0';
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `GMT${sign}${h}`;
  return `GMT${sign}${h}:${String(m).padStart(2, '0')}`;
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
