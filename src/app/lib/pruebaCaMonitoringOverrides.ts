import { getThermoKingPinnedImei } from '@/app/lib/fleetDemo';

/** Equipo demo sin ventilación física; telemetría avl/CFM no es fiable. */
export function isPruebaCaMonitoringDevice(deviceId: string | null | undefined): boolean {
  const id = String(deviceId || '').trim();
  if (!id) return false;
  return id === getThermoKingPinnedImei() || id === 'PRUEBA_CA000001';
}

/** Etileno (ppm): lecturas válidas 0–1; valores fuera se acotan. */
export function clampPruebaCaEthylenePpm(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (n <= 0) return 0;
  return Math.min(n, 1);
}

export function clampPruebaCaEthyleneSeries(
  values: (number | null | undefined)[]
): (number | null)[] {
  return values.map((v) => (v == null ? null : clampPruebaCaEthylenePpm(v)));
}
