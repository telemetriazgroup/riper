/** Máximo de decimales en valores mostrados al usuario. */
export const UI_MAX_DECIMALS = 2;

/** Redondeo numérico para presentación (máx. 2 decimales). */
export function roundUiNumber(value: number, maxDecimals = UI_MAX_DECIMALS): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** maxDecimals;
  return Math.round(value * factor) / factor;
}

/**
 * Formato legible con hasta `maxDecimals` decimales (sin ceros trailing innecesarios
 * salvo cuando hay fracción significativa).
 */
export function formatUiDecimal(
  value: number | null | undefined,
  maxDecimals = UI_MAX_DECIMALS
): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = roundUiNumber(Number(value), maxDecimals);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(maxDecimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function formatUiPercent(
  value: number | null | undefined,
  maxDecimals = UI_MAX_DECIMALS
): string {
  const s = formatUiDecimal(value, maxDecimals);
  return s === '—' ? s : `${s} %`;
}

export function formatUiPpm(
  value: number | null | undefined,
  maxDecimals = UI_MAX_DECIMALS
): string {
  const s = formatUiDecimal(value, maxDecimals);
  return s === '—' ? s : `${s} ppm`;
}
