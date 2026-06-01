import { DEFAULT_DATE_FORMAT, DEFAULT_DISPLAY_TIMEZONE, type DateFormatStyle } from '@/app/lib/displayTimeZone';
import { detectSystemLocalePreferences } from '@/app/lib/systemLocale';
import { updateUser } from '@/app/lib/usersApi';
import { getStoredUser, setStoredUser } from '@/app/lib/auth';

export type Language = 'es' | 'en';
export type Theme = 'light' | 'dark';
export type TempUnit = 'C' | 'F';

export type UiPreferences = {
  language?: Language;
  theme?: Theme;
  temp_unit?: TempUnit;
  display_timezone?: string;
  date_format?: DateFormatStyle;
};

export type ResolvedUiPreferences = {
  language: Language;
  theme: Theme;
  temp_unit: TempUnit;
  display_timezone: string;
  date_format: DateFormatStyle;
};

const LS_LANG = 'app_language';
const LS_THEME = 'app_theme';
const LS_UNIT = 'app_temp_unit';
const LS_TZ = 'app_display_timezone';
const LS_DATE_FMT = 'app_date_format';

export function readLocalUiPreferences(): Partial<ResolvedUiPreferences> {
  try {
    const out: Partial<ResolvedUiPreferences> = {};
    const lang = localStorage.getItem(LS_LANG);
    if (lang === 'es' || lang === 'en') out.language = lang;
    const theme = localStorage.getItem(LS_THEME);
    if (theme === 'light' || theme === 'dark') out.theme = theme;
    const unit = localStorage.getItem(LS_UNIT);
    if (unit === 'C' || unit === 'F') out.temp_unit = unit;
    const tz = localStorage.getItem(LS_TZ)?.trim();
    if (tz) out.display_timezone = tz;
    const df = localStorage.getItem(LS_DATE_FMT);
    if (df === 'dmy' || df === 'mdy') out.date_format = df;
    return out;
  } catch {
    return {};
  }
}

export function writeLocalUiPreferences(prefs: ResolvedUiPreferences) {
  try {
    localStorage.setItem(LS_LANG, prefs.language);
    localStorage.setItem(LS_THEME, prefs.theme);
    localStorage.setItem(LS_UNIT, prefs.temp_unit);
    localStorage.setItem(LS_TZ, prefs.display_timezone);
    localStorage.setItem(LS_DATE_FMT, prefs.date_format);
  } catch {
    /* ignore */
  }
}

export function hasServerUiPreferences(raw?: UiPreferences | null): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return Boolean(
    raw.language ||
      raw.theme ||
      raw.temp_unit ||
      raw.display_timezone ||
      raw.date_format
  );
}

export function resolveUiPreferences(
  fromServer?: UiPreferences | null,
  fromLocal?: Partial<ResolvedUiPreferences>
): ResolvedUiPreferences {
  const local = fromLocal ?? readLocalUiPreferences();
  const s = fromServer ?? {};
  const bootstrap = detectSystemLocalePreferences();
  const df = s.date_format ?? (s as { dateFormat?: string }).dateFormat;
  return {
    language:
      s.language === 'en' ? 'en' : s.language === 'es' ? 'es' : local.language ?? bootstrap.language,
    theme: s.theme === 'dark' ? 'dark' : s.theme === 'light' ? 'light' : local.theme ?? 'light',
    temp_unit: s.temp_unit === 'F' ? 'F' : s.temp_unit === 'C' ? 'C' : local.temp_unit ?? 'C',
    display_timezone:
      typeof s.display_timezone === 'string' && s.display_timezone.trim()
        ? s.display_timezone.trim()
        : local.display_timezone ?? bootstrap.display_timezone ?? DEFAULT_DISPLAY_TIMEZONE,
    date_format:
      df === 'mdy' ? 'mdy' : df === 'dmy' ? 'dmy' : local.date_format ?? bootstrap.date_format,
  };
}

export function toUiPreferencesPayload(prefs: ResolvedUiPreferences): UiPreferences {
  return {
    language: prefs.language,
    theme: prefs.theme,
    temp_unit: prefs.temp_unit,
    display_timezone: prefs.display_timezone,
    date_format: prefs.date_format,
  };
}

export async function persistUserUiPreferences(
  userId: string,
  prefs: ResolvedUiPreferences
): Promise<UiPreferences> {
  const payload = toUiPreferencesPayload(prefs);
  const updated = await updateUser(userId, { ui_preferences: payload });
  const stored = getStoredUser();
  if (stored && stored.id === userId) {
    setStoredUser({ ...stored, ui_preferences: updated.ui_preferences ?? payload });
  }
  return updated.ui_preferences ?? payload;
}
