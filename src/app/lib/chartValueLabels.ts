/**
 * Selección ordenada de índices para etiquetas «Valores» en gráficas históricas.
 * Prioriza extremos locales + muestreo uniforme, con separación mínima y tope.
 */

export type SelectChartLabelIndicesOpts = {
  /** Máximo de etiquetas a mostrar (incluye extremos del rango). */
  maxLabels?: number;
  /** Separación mínima entre índices etiquetados. */
  minIndexGap?: number;
  /** Ventana (a cada lado) para detectar pico/valle local. */
  extremumWindow?: number;
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function localExtremumIndices(
  values: (number | null | undefined)[],
  window: number
): number[] {
  const n = values.length;
  if (n === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (!isFiniteNum(v)) continue;
    let isPeak = true;
    let isValley = true;
    let hasNeighbor = false;
    for (let d = 1; d <= window; d++) {
      const left = i - d >= 0 ? values[i - d] : null;
      const right = i + d < n ? values[i + d] : null;
      if (isFiniteNum(left)) {
        hasNeighbor = true;
        if (left > v) isPeak = false;
        if (left < v) isValley = false;
      }
      if (isFiniteNum(right)) {
        hasNeighbor = true;
        if (right > v) isPeak = false;
        if (right < v) isValley = false;
      }
    }
    if (hasNeighbor && (isPeak || isValley)) out.push(i);
  }
  return out;
}

function uniformSampleIndices(length: number, count: number): number[] {
  if (length <= 0 || count <= 0) return [];
  if (count >= length) return Array.from({ length }, (_, i) => i);
  if (count === 1) return [0];
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    out.push(Math.round((k * (length - 1)) / (count - 1)));
  }
  return out;
}

/**
 * Elige índices a etiquetar: extremos locales + muestreo uniforme,
 * filtrados por gap mínimo y acotados a maxLabels.
 */
export function selectChartLabelIndices(
  values: (number | null | undefined)[],
  opts: SelectChartLabelIndicesOpts = {}
): Set<number> {
  const n = values.length;
  const maxLabels = Math.max(2, opts.maxLabels ?? 14);
  const minIndexGap = Math.max(1, opts.minIndexGap ?? 3);
  const extremumWindow = Math.max(1, opts.extremumWindow ?? 2);

  if (n === 0) return new Set();

  const validIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (isFiniteNum(values[i])) validIdx.push(i);
  }
  if (validIdx.length === 0) return new Set();
  if (validIdx.length <= maxLabels) {
    return enforceMinGap(validIdx, minIndexGap, maxLabels);
  }

  const first = validIdx[0];
  const last = validIdx[validIdx.length - 1];
  const extrema = localExtremumIndices(values, extremumWindow);
  const uniformCount = Math.max(4, Math.ceil(maxLabels * 0.55));
  const uniform = uniformSampleIndices(n, uniformCount).filter((i) => isFiniteNum(values[i]));

  /** Prioridad: extremos de rango → extremos locales → muestreo. */
  const ranked: number[] = [];
  const pushUnique = (arr: number[]) => {
    for (const i of arr) {
      if (!ranked.includes(i) && isFiniteNum(values[i])) ranked.push(i);
    }
  };
  pushUnique([first, last]);
  pushUnique(extrema);
  pushUnique(uniform);

  return enforceMinGap(ranked, minIndexGap, maxLabels);
}

function enforceMinGap(ranked: number[], minIndexGap: number, maxLabels: number): Set<number> {
  const selected: number[] = [];
  for (const i of ranked) {
    if (selected.length >= maxLabels) break;
    if (selected.every((s) => Math.abs(s - i) >= minIndexGap)) {
      selected.push(i);
    }
  }
  /** Si quedaron huecos y aún hay cupo, rellenar con muestreo del ranking descartado. */
  if (selected.length < maxLabels) {
    const sortedAll = [...ranked].sort((a, b) => a - b);
    for (const i of sortedAll) {
      if (selected.length >= maxLabels) break;
      if (selected.includes(i)) continue;
      if (selected.every((s) => Math.abs(s - i) >= Math.max(1, Math.floor(minIndexGap / 2)))) {
        selected.push(i);
      }
    }
  }
  return new Set(selected);
}

/**
 * Presupuesto de etiquetas por serie cuando varias tienen «Valores» activos.
 * Total objetivo ~18; mínimo 6 por serie.
 */
export function labelBudgetPerSeries(activeLabelSeriesCount: number, visibleLen: number): {
  maxLabels: number;
  minIndexGap: number;
} {
  const series = Math.max(1, activeLabelSeriesCount);
  const totalBudget = visibleLen > 80 ? 18 : visibleLen > 40 ? 16 : 12;
  const maxLabels = Math.max(6, Math.floor(totalBudget / series));
  const minIndexGap = Math.max(2, Math.floor(visibleLen / (maxLabels * 1.4)));
  return { maxLabels, minIndexGap };
}
