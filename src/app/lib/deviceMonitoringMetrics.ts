import type { HistoryPoint } from '@/app/lib/api';
import { parseMaduradorMongoDate } from '@/app/lib/madurador';

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function rawRowTimestampMs(row: Record<string, unknown>): number {
  const f = row.fecha;
  const s =
    parseMaduradorMongoDate(f) ?? (typeof f === 'string' && f.trim() ? f.trim() : null);
  const t = s ? new Date(s).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Σ (minutos × CFM en avl) ≈ pies cúbicos ventilados según criterio pedido. */
export function cumulativeVentilationFt3FromRawRows(rows: Record<string, unknown>[]): number {
  if (!rows || rows.length < 2) return 0;
  const sorted = [...rows].sort((a, b) => rawRowTimestampMs(a) - rawRowTimestampMs(b));
  let totalFt3 = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const avl = toNum(sorted[i].avl);
    const cfm = avl != null && avl > 0 ? avl : 0;
    const dtMin = (rawRowTimestampMs(sorted[i + 1]) - rawRowTimestampMs(sorted[i])) / 60000;
    if (dtMin > 0 && dtMin < 7 * 24 * 60) {
      totalFt3 += dtMin * cfm;
    }
  }
  return totalFt3;
}

export function ft3ToM3(ft3: number): number {
  return ft3 * 0.0283168466;
}

/** Medidor acumulado: último − primer power_kwh válido en el rango. */
export function energyKwhDeltaFromPoints(points: HistoryPoint[]): number | null {
  const vals = points
    .map((p) => p.power_kwh)
    .filter((v): v is number => v != null && Number.isFinite(Number(v)))
    .map(Number);
  if (vals.length < 2) return null;
  const d = vals[vals.length - 1] - vals[0];
  return d >= 0 ? d : null;
}

export function lastRawRow(rows: Record<string, unknown>[] | undefined): Record<string, unknown> | null {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => rawRowTimestampMs(a) - rawRowTimestampMs(b));
  return sorted[sorted.length - 1] ?? null;
}

export function ventilationLabelFromAvlRaw(avlRaw: unknown): { closed: boolean; label: string } {
  const n = toNum(avlRaw);
  if (n == null || n <= 0) return { closed: true, label: '' };
  const rounded = Math.abs(n) <= 100 && Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  return { closed: false, label: `${rounded} CFM` };
}

export function freshAirModeLabel(mode: unknown): number {
  const m = Math.round(Number(toNum(mode)));
  if (!Number.isFinite(m)) return -1;
  return m;
}
