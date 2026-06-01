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
