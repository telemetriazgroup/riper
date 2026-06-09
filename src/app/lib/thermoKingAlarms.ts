import type { AlarmCodeRecord } from '@/app/lib/alarmCodesApi';
import { fetchAlarmCodes } from '@/app/lib/alarmCodesApi';
import fallbackJson from '@/app/data/thermoKingMp4000Alarms.json';

export type AppLanguage = 'es' | 'en';

export interface DeviceAlarmOccurrence {
  /** Nombre del campo API (alarma_01, alarma_02…) — no es el código. */
  slot?: string;
  code: number;
  desde?: string;
  hasta?: string;
  isActive?: boolean;
}

const ALARM_FIELD_RE = /^alarma_\d{2}$/i;

let catalogCache: AlarmCodeRecord[] | null = null;
let catalogByCode = new Map<number, AlarmCodeRecord>();
let loadPromise: Promise<AlarmCodeRecord[]> | null = null;

function mapFallbackRow(a: (typeof fallbackJson.alarms)[number]): AlarmCodeRecord {
  return {
    id: `seed-${a.code}`,
    code: a.code,
    titleEs: a.titleEs,
    titleEn: a.titleEn,
    descriptionEs: a.descriptionEs,
    descriptionEn: a.descriptionEn,
    correctiveActionEs: a.correctiveActionEs,
    correctiveActionEn: a.correctiveActionEn,
    model: a.model ?? 'MP4000',
  };
}

function rebuildIndex(list: AlarmCodeRecord[]) {
  catalogCache = list.filter((a) => !a.archived);
  catalogByCode = new Map(catalogCache.map((a) => [a.code, a]));
}

export function setAlarmCatalog(list: AlarmCodeRecord[]) {
  rebuildIndex(list);
}

export async function loadAlarmCatalog(opts?: { includeArchived?: boolean }): Promise<AlarmCodeRecord[]> {
  if (!opts?.includeArchived && catalogCache) return catalogCache;
  if (!loadPromise) {
    loadPromise = fetchAlarmCodes(opts)
      .then((list) => {
        if (!opts?.includeArchived) rebuildIndex(list);
        return list;
      })
      .catch(() => {
        const fallback = fallbackJson.alarms.map(mapFallbackRow);
        if (!opts?.includeArchived) rebuildIndex(fallback);
        return fallback;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export function getAllAlarmCodes(): AlarmCodeRecord[] {
  if (catalogCache) return catalogCache;
  const fallback = fallbackJson.alarms.map(mapFallbackRow);
  rebuildIndex(fallback);
  return catalogCache!;
}

export function getAlarmCodeByNumber(code: number): AlarmCodeRecord | null {
  if (!catalogCache) getAllAlarmCodes();
  return catalogByCode.get(code) ?? null;
}

export function parseThermoKingAlarmCode(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.round(raw);
    return n >= 0 && n <= 999 ? n : null;
  }
  const s = String(raw).trim();
  if (/^E\d+/i.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const code = Math.round(n);
  return code >= 0 && code <= 999 ? code : null;
}

export function parseAlarmCount(raw: unknown): number | null {
  const n = parseThermoKingAlarmCode(raw);
  if (n == null) return null;
  return n;
}

function extractCodeFromFieldValue(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'object' && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    return parseThermoKingAlarmCode(o.numero ?? o.code ?? o.valor);
  }
  return parseThermoKingAlarmCode(val);
}

export function formatThermoKingAlarmCode(code: number): string {
  return String(code).padStart(2, '0');
}

export function getAlarmTitle(
  record: AlarmCodeRecord | null,
  code: number,
  language: AppLanguage
): string {
  if (!record) {
    return language === 'es' ? `Alarma ${formatThermoKingAlarmCode(code)}` : `Alarm ${formatThermoKingAlarmCode(code)}`;
  }
  return language === 'es' ? record.titleEs : record.titleEn;
}

export function getAlarmDescription(record: AlarmCodeRecord, language: AppLanguage): string {
  return language === 'es' ? record.descriptionEs : record.descriptionEn;
}

export function getAlarmCorrectiveAction(record: AlarmCodeRecord, language: AppLanguage): string {
  return language === 'es' ? record.correctiveActionEs : record.correctiveActionEn;
}

export function searchAlarmCodes(
  list: AlarmCodeRecord[],
  query: string,
  language: AppLanguage
): AlarmCodeRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((a) => {
    const title = language === 'es' ? a.titleEs : a.titleEn;
    const desc = language === 'es' ? a.descriptionEs : a.descriptionEn;
    return (
      String(a.code).includes(q) ||
      formatThermoKingAlarmCode(a.code).includes(q) ||
      title.toLowerCase().includes(q) ||
      desc.toLowerCase().includes(q) ||
      a.titleEn.toLowerCase().includes(q) ||
      a.titleEs.toLowerCase().includes(q)
    );
  });
}

/**
 * Extrae alarmas desde bloque `alarmas` de Madurador.
 * `alarma_01`, `alarma_02`… son nombres de campo; el código está en su valor (`numero` o escalar).
 * `numero_alarma` es la cantidad de alarmas activas, no un código.
 */
export function parseMaduradorAlarmOccurrences(alarmas: unknown): DeviceAlarmOccurrence[] {
  if (!alarmas || typeof alarmas !== 'object') return [];
  const block = alarmas as Record<string, unknown>;
  const out: DeviceAlarmOccurrence[] = [];
  const seen = new Set<string>();

  const push = (occ: DeviceAlarmOccurrence) => {
    const key = `${occ.code}|${occ.desde ?? ''}|${occ.hasta ?? ''}|${occ.isActive ? '1' : '0'}|${occ.slot ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(occ);
  };

  for (const [key, val] of Object.entries(block)) {
    if (!ALARM_FIELD_RE.test(key)) continue;
    const code = extractCodeFromFieldValue(val);
    if (code != null) push({ slot: key, code, isActive: true });
  }

  const activas = block.activas;
  if (Array.isArray(activas)) {
    for (const item of activas) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const [key, val] of Object.entries(item as Record<string, unknown>)) {
          if (ALARM_FIELD_RE.test(key)) {
            const code = extractCodeFromFieldValue(val);
            if (code != null) push({ slot: key, code, isActive: true });
            continue;
          }
        }
        const o = item as Record<string, unknown>;
        const code = extractCodeFromFieldValue(o.numero ?? o.code ?? o.valor);
        if (code != null) push({ code, isActive: true, desde: typeof o.desde === 'string' ? o.desde : undefined, hasta: typeof o.hasta === 'string' ? o.hasta : undefined });
      } else {
        const code = extractCodeFromFieldValue(item);
        if (code != null) push({ code, isActive: true });
      }
    }
  }

  const ultima = block.ultima_alarmas;
  const ultimaList = Array.isArray(ultima) ? ultima : ultima != null && typeof ultima === 'object' ? [ultima] : [];
  for (const entry of ultimaList) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [slot, val] of Object.entries(entry as Record<string, unknown>)) {
      const code = extractCodeFromFieldValue(val);
      if (code == null) continue;
      const o = val && typeof val === 'object' && !Array.isArray(val) ? (val as { desde?: string; hasta?: string }) : {};
      push({
        slot,
        code,
        desde: o.desde,
        hasta: o.hasta,
        isActive: false,
      });
    }
  }

  return out.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.code - b.code;
  });
}

// Compatibilidad con imports anteriores
export type ThermoKingAlarmRecord = AlarmCodeRecord;
export const getThermoKingAlarmByCode = getAlarmCodeByNumber;
export const getAllThermoKingAlarms = getAllAlarmCodes;
export const getThermoKingAlarmTitle = getAlarmTitle;
export const getThermoKingAlarmDescription = getAlarmDescription;
export const getThermoKingAlarmCorrectiveAction = getAlarmCorrectiveAction;
export const searchThermoKingAlarms = (query: string, language: AppLanguage) =>
  searchAlarmCodes(getAllAlarmCodes(), query, language);
