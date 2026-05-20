/**
 * Reglas de saneamiento para series telemetría en gráficas (omitir 0, picos cortos, AVL fuera de rango).
 * Los datos crudos de API no se modifican; esto aplica al construir filas para Recharts (null = sin trazo).
 */

export const CHART_AVL_MAX_CFM = 200;

/** campo_1 (etileno ppm): lecturas mayores no se grafican (telemetría errónea / fuera de rango operativo). */
export const CHART_ETHYLENE_MAX_PPM = 200;

export function chartNullIfZero(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

/** Lecturas CO₂/O₂ en gráficas: 0 tratado como “sin dato” (sin punto). */
function nullReadingIfZero(rows: Record<string, unknown>[], key: string): void {
  for (const row of rows) {
    const v = row[key];
    if (typeof v === 'number' && !Number.isNaN(v) && v === 0) row[key] = null;
  }
}

function median3(a: number, b: number, c: number): number {
  return [a, b, c].sort((x, y) => x - y)[1];
}

/**
 * Etileno (ppm) — campo_1 en telemetría: lecturas > {@link CHART_ETHYLENE_MAX_PPM} se omiten;
 * picos que se alejan de vecinos inmediatos y vuelven al rango → reemplazo por tendencia local.
 * Ej. 100,102,202,102 → 100,102,102,102; pasa mediana 3 cuando el centro desentona.
 */
export function sanitizeEthylenePpmSeries(values: (number | null | undefined)[]): (number | null)[] {
  const x: (number | null)[] = values.map((v) => {
    if (v == null || v === '' || !Number.isFinite(Number(v))) return null;
    const n = Number(v);
    if (n > CHART_ETHYLENE_MAX_PPM) return null;
    return n;
  });
  const n = x.length;
  if (n === 0) return x;

  const absSpike = 42;
  const neighClose = 38;

  const out = [...x];

  for (let i = 1; i < n - 1; i++) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    if (a == null || b == null || c == null) continue;
    const mid = (a + c) / 2;
    const spread = Math.abs(a - c);
    if (
      Math.abs(b - mid) > absSpike &&
      Math.abs(b - a) > neighClose &&
      Math.abs(b - c) > neighClose &&
      spread < absSpike * 1.15
    ) {
      out[i] = mid;
    }
  }

  for (let i = 1; i < n - 1; i++) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    if (a == null || b == null || c == null) continue;
    const m = median3(a, b, c);
    if (Math.abs(b - m) > 48 && Math.abs(a - c) < 40) {
      out[i] = m;
    }
  }

  if (n >= 2) {
    const a = out[n - 2];
    const b = out[n - 1];
    if (a != null && b != null && a > 45 && b < 8 && a - b > 40) out[n - 1] = null;
    const c0 = out[0];
    const c1 = out[1];
    if (c0 != null && c1 != null && c1 > 45 && c0 < 8 && c1 - c0 > 40) out[0] = null;
  }

  return out;
}

/**
 * CO₂ (%): ceros improbables entre lecturas coherentes → null; picos cortos similares al etileno (escala %).
 */
export function sanitizeCo2PercentSeries(values: (number | null | undefined)[]): (number | null)[] {
  const x: (number | null)[] = values.map((v) =>
    v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)
  );
  const n = x.length;
  if (n === 0) return x;
  const out = [...x];

  for (let i = 0; i < n; i++) {
    if (out[i] !== 0) continue;
    const prev = out[i - 1];
    const next = out[i + 1];
    if (
      prev != null &&
      next != null &&
      prev > 0.35 &&
      next > 0.35 &&
      Math.abs(prev - next) < 1.2
    ) {
      out[i] = null;
    }
  }

  const absSpike = 0.95;
  const neighClose = 0.75;

  for (let i = 1; i < n - 1; i++) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    if (a == null || b == null || c == null) continue;
    const mid = (a + c) / 2;
    const spread = Math.abs(a - c);
    if (
      Math.abs(b - mid) > absSpike &&
      Math.abs(b - a) > neighClose &&
      Math.abs(b - c) > neighClose &&
      spread < 1.0
    ) {
      out[i] = mid;
    }
  }

  for (let i = 1; i < n - 1; i++) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    if (a == null || b == null || c == null) continue;
    const m = median3(a, b, c);
    if (Math.abs(b - m) > 0.9 && Math.abs(a - c) < 0.65) {
      out[i] = m;
    }
  }

  if (n >= 2) {
    const a = out[n - 2];
    const b = out[n - 1];
    if (a != null && b != null && a > 0.9 && b < 0.35 && a - b > 0.55) out[n - 1] = null;
    const c0 = out[0];
    const c1 = out[1];
    if (c0 != null && c1 != null && c1 > 0.9 && c0 < 0.35 && c1 - c0 > 0.55) out[0] = null;
  }

  return out;
}

export function sanitizeAvlPctForChart(avl_pct: number, avl_raw?: number | null): number | null {
  const p = Number(avl_pct);
  if (!Number.isFinite(p)) return null;
  if (avl_raw != null && Number.isFinite(avl_raw) && avl_raw > CHART_AVL_MAX_CFM) return null;
  if (p > 100) return null;
  return p;
}

const TEMP_KEYS_ZERO_NULL = ['set_point', 'return_air', 'temp_supply_1'] as const;

/** Post-proceso filas del modal histórico (mismas claves que CHART_METRIC_KEYS + avl_raw). */
export function postProcessHistoricalChartRows(
  rows: Record<string, unknown>[],
  opts?: { nullZeroCo2O2Readings?: boolean }
): void {
  if (!rows.length) return;
  for (const row of rows) {
    row.relative_humidity = chartNullIfZero(row.relative_humidity);
    row.set_point_co2 = chartNullIfZero(row.set_point_co2);
    for (const k of TEMP_KEYS_ZERO_NULL) {
      row[k] = chartNullIfZero(row[k]);
    }

    const rawAvl = row.avl_raw != null ? Number(row.avl_raw) : null;
    row.avl_pct = sanitizeAvlPctForChart(Number(row.avl_pct ?? NaN), Number.isFinite(rawAvl as number) ? rawAvl : null);
  }

  const eth = sanitizeEthylenePpmSeries(rows.map((r) => r.ethylene as number | null));
  const co2 = sanitizeCo2PercentSeries(rows.map((r) => r.co2_reading as number | null));
  rows.forEach((r, i) => {
    r.ethylene = eth[i];
    r.co2_reading = co2[i];
  });

  if (opts?.nullZeroCo2O2Readings) {
    nullReadingIfZero(rows, 'co2_reading');
    nullReadingIfZero(rows, 'o2_reading');
  }
}
export type Last12hChartPoint = {
  rawDate: Date;
  time: string;
  temp: number | null;
  humidity: number | null;
  ethylene: number | null;
  co2: number | null;
};

/**
 * Últimas 12 h (tarjeta principal): temp = retorno si válido y ≠0, si no suministro ≠0; sin rellenar huecos con 85.
 */
export function buildLast12hChartData(
  history: {
    timestamp: string;
    return_air?: number;
    temp_supply_1?: number;
    relative_humidity?: number;
    ethylene?: number | null;
    co2_reading?: number | null;
  }[],
  convertTemp: (c: number) => number
): Last12hChartPoint[] {
  const rawTempC = history.map((h) => {
    const ret = h.return_air;
    const sup = h.temp_supply_1;
    let t: number | null = null;
    if (ret != null && Number.isFinite(ret) && ret !== 0) t = ret;
    else if (sup != null && Number.isFinite(sup) && sup !== 0) t = sup;
    return t != null ? convertTemp(t) : null;
  });

  const humidity = history.map((h) => chartNullIfZero(h.relative_humidity));

  const ethRaw = history.map((h) => (h.ethylene == null ? null : Number(h.ethylene)));
  const co2Raw = history.map((h) => (h.co2_reading == null ? null : Number(h.co2_reading)));

  const ethylene = sanitizeEthylenePpmSeries(ethRaw);
  const co2 = sanitizeCo2PercentSeries(co2Raw);

  return history.map((h, i) => {
    const c = co2[i];
    const coVal = c != null && c === 0 ? null : c;
    return {
      rawDate: new Date(h.timestamp),
      time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: rawTempC[i] != null ? Number(rawTempC[i]!.toFixed(2)) : null,
      humidity: humidity[i] != null ? Number(humidity[i]!.toFixed(2)) : null,
      ethylene: ethylene[i] != null ? Number(ethylene[i]!.toFixed(2)) : null,
      co2: coVal != null ? Number(coVal.toFixed(2)) : null,
    };
  });
}
