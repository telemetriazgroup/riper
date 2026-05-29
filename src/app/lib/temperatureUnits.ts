export type TempUnit = 'C' | 'F';

/** Convierte valor ingresado en la unidad de visualización a °C (almacenamiento interno). */
export function celsiusFromDisplayValue(value: number, unit: TempUnit): number {
  if (!Number.isFinite(value)) return value;
  if (unit === 'C') return parseFloat(value.toFixed(2));
  return parseFloat((((value - 32) * 5) / 9).toFixed(2));
}

/** Formatea °C almacenados para mostrar en la unidad del usuario. */
export function formatStoredCelsius(
  celsius: number,
  convertTemp: (c: number) => number,
  unit: TempUnit,
  decimals = 1
): string {
  if (!Number.isFinite(celsius)) return '—';
  return `${convertTemp(celsius).toFixed(decimals)}°${unit}`;
}

export type TempDisplayOpts = {
  convertTemp: (c: number) => number;
  tempUnit: TempUnit;
};
