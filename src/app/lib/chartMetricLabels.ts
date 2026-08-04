/** Claves de métricas en gráficas/tablas históricas (orden estable). */
export const CHART_METRIC_KEYS = [
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
  'condensation_coil',
  'compress_coil_1',
  'ambient_air',
  'cargo_1_temp',
  'cargo_2_temp',
  'cargo_3_temp',
  'cargo_4_temp',
  'relative_humidity',
  'avl_pct',
  'line_voltage',
  'line_frequency',
  'co2_reading',
  'o2_reading',
  'set_point',
  'capacity_load',
  'humidity_set_point',
  'set_point_o2',
  'set_point_co2',
  'sp_ethyleno',
  'ethylene',
] as const;

export type ChartMetricKey = (typeof CHART_METRIC_KEYS)[number];

export function chartMetricLabel(key: string, t: (k: string) => string): string {
  const trKey = `chart_metric_${key}`;
  const v = t(trKey);
  return v !== trKey ? v : key;
}

export function buildChartMetricLabels(t: (k: string) => string): Record<string, string> {
  return Object.fromEntries(CHART_METRIC_KEYS.map((k) => [k, chartMetricLabel(k, t)]));
}

const TEMP_METRIC_KEYS = new Set<string>([
  'temp_supply_1',
  'return_air',
  'evaporation_coil',
  'condensation_coil',
  'compress_coil_1',
  'ambient_air',
  'cargo_1_temp',
  'cargo_2_temp',
  'cargo_3_temp',
  'cargo_4_temp',
  'set_point',
]);

const PCT_METRIC_KEYS = new Set<string>([
  'relative_humidity',
  'avl_pct',
  'capacity_load',
  'humidity_set_point',
  'co2_reading',
  'o2_reading',
  'set_point_o2',
  'set_point_co2',
]);

const PPM_METRIC_KEYS = new Set<string>(['ethylene', 'sp_ethyleno']);

/** Unidad de medida para tooltip / etiquetas de gráfica histórica. */
export function chartMetricUnit(key: string, tempUnit: 'C' | 'F' = 'C'): string {
  const k = String(key || '').trim();
  if (TEMP_METRIC_KEYS.has(k)) return tempUnit === 'F' ? '°F' : '°C';
  if (PCT_METRIC_KEYS.has(k)) return '%';
  if (PPM_METRIC_KEYS.has(k)) return 'ppm';
  if (k === 'line_voltage') return 'V';
  if (k === 'line_frequency') return 'Hz';
  return '';
}

export function formatChartMetricValueWithUnit(
  key: string,
  value: number | null | undefined,
  tempUnit: 'C' | 'F',
  formatNumber: (n: number) => string
): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const formatted = formatNumber(n);
  const unit = chartMetricUnit(key, tempUnit);
  return unit ? `${formatted} ${unit}` : formatted;
}
