import { roundUiNumber, formatUiDecimal, UI_MAX_DECIMALS } from '@/app/lib/formatUiNumber';

export type TempUnit = 'C' | 'F';
export function celsiusFromDisplayValue(value: number, unit: TempUnit): number {
  if (!Number.isFinite(value)) return value;
  if (unit === 'C') return roundUiNumber(value, UI_MAX_DECIMALS);
  return roundUiNumber(((value - 32) * 5) / 9, UI_MAX_DECIMALS);
}

/** Formatea °C almacenados para mostrar en la unidad del usuario. */
export function formatStoredCelsius(
  celsius: number,
  convertTemp: (c: number) => number,
  unit: TempUnit,
  decimals = UI_MAX_DECIMALS
): string {
  if (!Number.isFinite(celsius)) return '—';
  return `${formatUiDecimal(convertTemp(celsius), decimals)}°${unit}`;
}

export type TempDisplayOpts = {
  convertTemp: (c: number) => number;
  tempUnit: TempUnit;
};
