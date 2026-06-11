import type { HistoryPoint } from '@/app/lib/api';
import {
  sanitizeCo2PercentSeries,
  sanitizeEthylenePpmSeries,
} from '@/app/lib/historySeriesSanitize';
import {
  clampPruebaCaEthylenePpm,
  clampPruebaCaEthyleneSeries,
  isPruebaCaMonitoringDevice,
} from '@/app/lib/pruebaCaMonitoringOverrides';

export const CA_CHART_MAX_POINTS = 96;
export const CA_CO2_TOLERANCE_PCT = 0.5;
export const CA_O2_TOLERANCE_PCT = 0.5;
export const CA_TEMP_TOLERANCE_C = 0.6;
export const CA_ETHYLENE_TOLERANCE_PPM = 0.15;
export const CA_ETHYLENE_MAX_PPM_DEFAULT = 5;
/** % mínimo de lecturas en rango para considerar el día conforme. */
export const CA_DAY_IN_RANGE_MIN_PCT = 85;

const LIMA_TZ = 'America/Lima';

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function caDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function caDayLabel(dayKey: string, locale: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-PE', {
    timeZone: LIMA_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}

export type CaPreparedPoint = {
  timestamp: string;
  return_air: number | null;
  set_point: number | null;
  co2: number | null;
  o2: number | null;
  ethylene: number | null;
  set_point_co2: number | null;
  set_point_o2: number | null;
  sp_ethyleno: number | null;
};

export function prepareCaHistoryPoints(
  points: HistoryPoint[],
  deviceId: string
): CaPreparedPoint[] {
  const prueba = isPruebaCaMonitoringDevice(deviceId);
  const co2 = sanitizeCo2PercentSeries(points.map((p) => p.co2_reading));
  const rawEth = points.map((p) => p.ethylene);
  const eth = prueba
    ? clampPruebaCaEthyleneSeries(rawEth)
    : sanitizeEthylenePpmSeries(rawEth);

  return points.map((p, i) => ({
    timestamp: p.timestamp,
    return_air: toNum(p.return_air),
    set_point: toNum(p.set_point),
    co2: co2[i] ?? null,
    o2: toNum(p.o2_reading),
    ethylene: eth[i] ?? null,
    set_point_co2: toNum(p.set_point_co2),
    set_point_o2: toNum(p.set_point_o2),
    sp_ethyleno: toNum(p.sp_ethyleno),
  }));
}

type MetricExtractor = (p: CaPreparedPoint) => number | null;

const CA_METRIC_EXTRACTORS: MetricExtractor[] = [
  (p) => p.co2,
  (p) => p.o2,
  (p) => p.ethylene,
  (p) => p.return_air,
];

/** Selecciona índices representativos: extremos, cambios bruscos y anclas diarias. */
export function selectImportantCaIndices(
  prepared: CaPreparedPoint[],
  maxPoints = CA_CHART_MAX_POINTS
): number[] {
  const n = prepared.length;
  if (n <= maxPoints) return Array.from({ length: n }, (_, i) => i);
  const selected = new Set<number>([0, n - 1]);

  for (const extract of CA_METRIC_EXTRACTORS) {
    const vals = prepared.map(extract);
    let minI = -1;
    let maxI = -1;
    let minV = Infinity;
    let maxV = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = vals[i];
      if (v == null || !Number.isFinite(v)) continue;
      if (v < minV) {
        minV = v;
        minI = i;
      }
      if (v > maxV) {
        maxV = v;
        maxI = i;
      }
    }
    if (minI >= 0) selected.add(minI);
    if (maxI >= 0) selected.add(maxI);

    const finite = vals.filter((v): v is number => v != null && Number.isFinite(v));
    if (finite.length >= 3) {
      const range = Math.max(...finite) - Math.min(...finite);
      const threshold = Math.max(range * 0.06, range === 0 ? 0.01 : range * 0.02);
      for (let i = 1; i < n; i++) {
        const a = vals[i - 1];
        const b = vals[i];
        if (a != null && b != null && Math.abs(b - a) >= threshold) {
          selected.add(i);
          selected.add(i - 1);
        }
      }
    }
  }

  const byDay = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = caDayKey(prepared[i]!.timestamp);
    const list = byDay.get(key) ?? [];
    list.push(i);
    byDay.set(key, list);
  }
  for (const indices of byDay.values()) {
    selected.add(indices[Math.floor(indices.length / 2)]!);
    selected.add(indices[0]!);
    if (indices.length > 1) selected.add(indices[indices.length - 1]!);
  }

  let sorted = [...selected].sort((a, b) => a - b);
  if (sorted.length > maxPoints) {
    const step = (sorted.length - 1) / (maxPoints - 1);
    sorted = Array.from({ length: maxPoints }, (_, k) => sorted[Math.round(k * step)]!);
    return [...new Set(sorted)].sort((a, b) => a - b);
  }

  if (sorted.length < maxPoints) {
    const bucket = Math.ceil(n / maxPoints);
    for (let i = 0; i < n; i += bucket) {
      selected.add(i);
    }
    sorted = [...selected].sort((a, b) => a - b);
    if (sorted.length > maxPoints) {
      const step = (sorted.length - 1) / (maxPoints - 1);
      sorted = Array.from({ length: maxPoints }, (_, k) => sorted[Math.round(k * step)]!);
    }
  }

  return [...new Set(sorted)].sort((a, b) => a - b);
}

export function downsampleCaPreparedPoints(
  prepared: CaPreparedPoint[],
  maxPoints = CA_CHART_MAX_POINTS
): CaPreparedPoint[] {
  const indices = selectImportantCaIndices(prepared, maxPoints);
  return indices.map((i) => prepared[i]!);
}

export type CaMetricDayStats = {
  min: number | null;
  max: number | null;
  avg: number | null;
  target: number | null;
  tolerance: number | null;
  inRangePct: number | null;
  inRange: boolean;
  readings: number;
};

export type DailyCaAnalysis = {
  dayKey: string;
  dayLabel: string;
  samples: number;
  co2: CaMetricDayStats;
  o2: CaMetricDayStats;
  ethylene: CaMetricDayStats;
  returnAir: CaMetricDayStats;
  allInRange: boolean;
};

function buildMetricDayStatsFromPairs(
  pairs: { value: number; target: number | null }[],
  tolerance: number
): CaMetricDayStats {
  const values = pairs.map((p) => p.value);
  let ok = 0;
  let evaluated = 0;
  const targets: number[] = [];
  for (const { value, target } of pairs) {
    if (target == null || !Number.isFinite(target)) continue;
    targets.push(target);
    evaluated++;
    if (Math.abs(value - target) <= tolerance) ok++;
  }
  const target = median(targets);
  const pct = evaluated > 0 ? Math.round((ok / evaluated) * 100) : null;
  return {
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    target,
    tolerance,
    inRangePct: pct,
    inRange: pct != null && pct >= CA_DAY_IN_RANGE_MIN_PCT,
    readings: values.length,
  };
}

export function formatCaGasTargetLabel(
  target: number | null,
  tolerance: number,
  unit = '%'
): string | null {
  if (target == null || !Number.isFinite(target)) return null;
  return `${target}${unit} ±${tolerance}${unit}`;
}

function ethyleneTolerance(deviceId: string, target: number | null): number {
  if (isPruebaCaMonitoringDevice(deviceId)) return CA_ETHYLENE_TOLERANCE_PPM;
  if (target != null && target > 0) return Math.max(target * 0.2, 5);
  return CA_ETHYLENE_MAX_PPM_DEFAULT;
}

function ethyleneInRange(values: number[], deviceId: string, targets: number[]): CaMetricDayStats {
  const prueba = isPruebaCaMonitoringDevice(deviceId);
  const target = prueba ? 0.5 : median(targets.filter(Number.isFinite));
  const tol = ethyleneTolerance(deviceId, target);
  let ok = 0;
  for (const v of values) {
    const clamped = prueba ? clampPruebaCaEthylenePpm(v) : v;
    if (clamped == null) continue;
    if (prueba) {
      if (clamped >= 0 && clamped <= 1) ok++;
    } else if (target != null && Math.abs(clamped - target) <= tol) {
      ok++;
    }
  }
  const pct = values.length > 0 ? Math.round((ok / values.length) * 100) : null;
  return {
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    target: prueba ? 1 : target,
    tolerance: prueba ? 1 : tol,
    inRangePct: pct,
    inRange: pct != null && pct >= CA_DAY_IN_RANGE_MIN_PCT,
    readings: values.length,
  };
}

export function buildDailyCaAnalysis(
  prepared: CaPreparedPoint[],
  locale: string,
  deviceId: string
): DailyCaAnalysis[] {
  const byDay = new Map<string, CaPreparedPoint[]>();
  for (const p of prepared) {
    const key = caDayKey(p.timestamp);
    const list = byDay.get(key) ?? [];
    list.push(p);
    byDay.set(key, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, rows]) => {
      const co2Pairs = rows
        .filter((r) => r.co2 != null)
        .map((r) => ({ value: r.co2!, target: r.set_point_co2 }));
      const o2Pairs = rows
        .filter((r) => r.o2 != null)
        .map((r) => ({ value: r.o2!, target: r.set_point_o2 }));
      const tempPairs = rows
        .filter((r) => r.return_air != null)
        .map((r) => ({ value: r.return_air!, target: r.set_point }));

      const co2 = buildMetricDayStatsFromPairs(co2Pairs, CA_CO2_TOLERANCE_PCT);
      const o2 = buildMetricDayStatsFromPairs(o2Pairs, CA_O2_TOLERANCE_PCT);
      const ethVals = rows.map((r) => r.ethylene).filter((v): v is number => v != null);
      const ethylene = ethyleneInRange(
        ethVals,
        deviceId,
        rows.map((r) => r.sp_ethyleno).filter((v): v is number => v != null)
      );
      const returnAir = buildMetricDayStatsFromPairs(tempPairs, CA_TEMP_TOLERANCE_C);

      return {
        dayKey,
        dayLabel: caDayLabel(dayKey, locale),
        samples: rows.length,
        co2,
        o2,
        ethylene,
        returnAir,
        allInRange: co2.inRange && o2.inRange && ethylene.inRange && returnAir.inRange,
      };
    });
}

export type CaProcessSummary = {
  totalPoints: number;
  chartPoints: number;
  daysAnalyzed: number;
  daysInRange: number;
  co2GlobalInRangePct: number | null;
  o2GlobalInRangePct: number | null;
  ethyleneGlobalInRangePct: number | null;
  tempGlobalInRangePct: number | null;
};

export function buildCaProcessSummary(
  prepared: CaPreparedPoint[],
  daily: DailyCaAnalysis[],
  deviceId: string
): CaProcessSummary {
  const chartPoints = Math.min(prepared.length, selectImportantCaIndices(prepared).length);

  const pctAll = (extract: (p: CaPreparedPoint) => number | null, target: (p: CaPreparedPoint) => number | null, tol: number) => {
    let ok = 0;
    let total = 0;
    for (const p of prepared) {
      const v = extract(p);
      const t = target(p);
      if (v == null || t == null) continue;
      total++;
      if (Math.abs(v - t) <= tol) ok++;
    }
    return total > 0 ? Math.round((ok / total) * 100) : null;
  };

  return {
    totalPoints: prepared.length,
    chartPoints,
    daysAnalyzed: daily.length,
    daysInRange: daily.filter((d) => d.allInRange).length,
    co2GlobalInRangePct: pctAll(
      (p) => p.co2,
      (p) => p.set_point_co2,
      CA_CO2_TOLERANCE_PCT
    ),
    o2GlobalInRangePct: pctAll(
      (p) => p.o2,
      (p) => p.set_point_o2,
      CA_O2_TOLERANCE_PCT
    ),
    ethyleneGlobalInRangePct: (() => {
      const prueba = isPruebaCaMonitoringDevice(deviceId);
      let ok = 0;
      let total = 0;
      for (const p of prepared) {
        if (p.ethylene == null) continue;
        total++;
        const v = prueba ? clampPruebaCaEthylenePpm(p.ethylene) : p.ethylene;
        if (v == null) continue;
        if (prueba) {
          if (v >= 0 && v <= 1) ok++;
        } else {
          const t = p.sp_ethyleno;
          if (t != null && Math.abs(v - t) <= ethyleneTolerance(deviceId, t)) ok++;
        }
      }
      return total > 0 ? Math.round((ok / total) * 100) : null;
    })(),
    tempGlobalInRangePct: pctAll(
      (p) => p.return_air,
      (p) => p.set_point,
      CA_TEMP_TOLERANCE_C
    ),
  };
}
