import type { HistoryPoint } from '@/app/lib/api';
import { CHART_ETHYLENE_MAX_PPM } from '@/app/lib/historySeriesSanitize';
import { rawRowTimestampMs } from '@/app/lib/deviceMonitoringMetrics';

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type PhaseTimeWindow = {
  order: number;
  label: string;
  type: string;
  startMs: number;
  endMs: number;
  rawPhase: Record<string, unknown>;
};

/** Ventanas de tiempo por fase habilitada (misma lógica acumulada que el modal de receta). */
export function buildPhaseTimeWindows(
  plannedRows: { order: number; label: string; plannedEndAt: string | null }[],
  enabledRawPhases: Record<string, unknown>[],
  startedAtIso: string | null
): PhaseTimeWindow[] {
  const t0 = startedAtIso ? new Date(startedAtIso).getTime() : NaN;

  return plannedRows.map((row, i) => {
    const startMs =
      i === 0
        ? t0
        : plannedRows[i - 1]?.plannedEndAt
          ? new Date(plannedRows[i - 1].plannedEndAt!).getTime()
          : NaN;
    const endMs = row.plannedEndAt ? new Date(row.plannedEndAt).getTime() : NaN;
    return {
      order: row.order,
      label: row.label,
      type: String(enabledRawPhases[i]?.type ?? ''),
      startMs,
      endMs,
      rawPhase: (enabledRawPhases[i] ?? {}) as Record<string, unknown>,
    };
  });
}

export function filterHistoryPointsInRange(
  points: HistoryPoint[],
  startMs: number,
  endMs: number
): HistoryPoint[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
  return points.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return t >= startMs && t <= endMs;
  });
}

export function filterRawDatosInRange(
  rows: Record<string, unknown>[] | undefined,
  startMs: number,
  endMs: number
): Record<string, unknown>[] {
  if (!Array.isArray(rows) || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];
  return rows.filter((r) => {
    const t = rawRowTimestampMs(r);
    return t >= startMs && t <= endMs;
  });
}

export type TempHumidityStats = {
  avgTemp: number | null;
  minTemp: number | null;
  maxTemp: number | null;
  avgRh: number | null;
  minRh: number | null;
  maxRh: number | null;
  minutesToSetpoint: number | null;
  setpointReached: boolean;
};

const DEF_TEMP_TOL = 0.6;
const DEF_RH_TOL = 2.5;

export function computeTempHumidityStats(
  points: HistoryPoint[],
  tempTarget?: number | null,
  rhTarget?: number | null
): TempHumidityStats {
  const empty: TempHumidityStats = {
    avgTemp: null,
    minTemp: null,
    maxTemp: null,
    avgRh: null,
    minRh: null,
    maxRh: null,
    minutesToSetpoint: null,
    setpointReached: false,
  };
  if (!points.length) return empty;

  const temps = points.map((p) => p.return_air).filter((x): x is number => x != null && Number.isFinite(x));
  const rhs = points.map((p) => p.relative_humidity).filter((x): x is number => x != null && Number.isFinite(x));

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  let minutesToSetpoint: number | null = null;
  let setpointReached = false;
  const wantT = tempTarget != null && Number.isFinite(tempTarget);
  const wantH = rhTarget != null && Number.isFinite(rhTarget);

  if (wantT || wantH) {
    const t0 = new Date(points[0].timestamp).getTime();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const okT = !wantT || Math.abs(p.return_air - (tempTarget as number)) <= DEF_TEMP_TOL;
      const okH = !wantH || Math.abs(p.relative_humidity - (rhTarget as number)) <= DEF_RH_TOL;
      if (okT && okH) {
        const t1 = new Date(p.timestamp).getTime();
        minutesToSetpoint = (t1 - t0) / 60000;
        setpointReached = true;
        break;
      }
    }
  }

  return {
    avgTemp: avg(temps),
    minTemp: temps.length ? Math.min(...temps) : null,
    maxTemp: temps.length ? Math.max(...temps) : null,
    avgRh: avg(rhs),
    minRh: rhs.length ? Math.min(...rhs) : null,
    maxRh: rhs.length ? Math.max(...rhs) : null,
    minutesToSetpoint,
    setpointReached,
  };
}

/** Σ min × avl × (co2%/100) en tramos con avl ≠ 0. */
export function cumulativeCo2WeightedVentilation(rawRows: Record<string, unknown>[]): number {
  if (!rawRows?.length) return 0;
  const sorted = [...rawRows].sort((a, b) => rawRowTimestampMs(a) - rawRowTimestampMs(b));
  let sum = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const avl = toNum(sorted[i].avl);
    const cfm = avl != null && avl > 0 ? avl : 0;
    const co2 = toNum(sorted[i].co2_reading);
    const pct = co2 != null && Number.isFinite(co2) ? Math.max(0, Math.min(100, co2)) / 100 : 0;
    const dtMin = (rawRowTimestampMs(sorted[i + 1]) - rawRowTimestampMs(sorted[i])) / 60000;
    if (dtMin > 0 && dtMin < 7 * 24 * 60 && cfm > 0) {
      sum += dtMin * cfm * pct;
    }
  }
  return sum;
}

export function averageAvlRaw(rawRows: Record<string, unknown>[]): number | null {
  const vals = rawRows.map((r) => toNum(r.avl)).filter((v): v is number => v != null && v > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function deltaFirstLast(
  points: HistoryPoint[],
  key: 'ethylene' | 'co2_reading'
): { first: number | null; last: number | null; delta: number | null } {
  const pick =
    key === 'ethylene'
      ? (p: HistoryPoint) => {
          if (p.ethylene == null) return null;
          const n = Number(p.ethylene);
          if (!Number.isFinite(n) || n > CHART_ETHYLENE_MAX_PPM) return null;
          return n;
        }
      : (p: HistoryPoint) => (p.co2_reading != null ? Number(p.co2_reading) : null);
  const vals = points.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length < 2) return { first: vals[0] ?? null, last: vals[vals.length - 1] ?? null, delta: null };
  const first = vals[0]!;
  const last = vals[vals.length - 1]!;
  return { first, last, delta: last - first };
}

export function yDomainPadded(values: (number | null | undefined)[], padRatio = 0.08): [number, number] {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  if (!v.length) return [0, 1];
  let lo = Math.min(...v);
  let hi = Math.max(...v);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * padRatio;
  return [lo - pad, hi + pad];
}

export function processReportRangeEndMs(view: {
  status?: string;
  cancelledMeta?: { at?: string | null } | null;
  scheduleSummary?: { estimatedEndAt?: string | null; startedAt?: string; totalDurationHours?: number };
}): number {
  const st = String(view.status || '').toLowerCase();
  if (st === 'cancelled' && view.cancelledMeta?.at) {
    const t = new Date(view.cancelledMeta.at).getTime();
    if (Number.isFinite(t)) return t;
  }
  const sch = view.scheduleSummary || {};
  if (sch.estimatedEndAt) {
    const t = new Date(String(sch.estimatedEndAt)).getTime();
    if (Number.isFinite(t)) return t;
  }
  const start = sch.startedAt ? new Date(String(sch.startedAt)).getTime() : NaN;
  const h = Number(sch.totalDurationHours) || 0;
  if (Number.isFinite(start) && h > 0) return start + h * 3600 * 1000;
  return Date.now();
}

export function numFromPhase(raw: Record<string, unknown>, key: string): number | null {
  return toNum(raw[key]);
}
