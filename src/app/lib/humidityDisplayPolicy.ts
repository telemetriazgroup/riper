import type { Device } from '@/app/data';
import type { HistoryPoint } from '@/app/lib/api';
import { showsUnfilteredTelemetry, type TelemetryViewOptions } from '@/app/lib/telemetryViewPolicy';

/**
 * Usuario normal: 0–50 → 50–70 proporcional; 51–90 → 71–90; >90 sin filtro.
 * Ej. lectura 40 → ~66 %.
 */
export function modulateHumidityDisplayPct(
  rawPct: number | null | undefined,
  opts?: TelemetryViewOptions
): number | null {
  if (rawPct == null || !Number.isFinite(Number(rawPct))) return null;
  const raw = Number(rawPct);
  if (showsUnfilteredTelemetry(opts)) return Number(raw.toFixed(1));

  if (raw > 90) return Number(raw.toFixed(1));
  if (raw <= 50) {
    const mapped = 50 + (Math.max(0, raw) / 50) * 20;
    return Number(mapped.toFixed(1));
  }
  const mapped = 71 + ((raw - 51) / 39) * 19;
  return Number(Math.min(90, Math.max(71, mapped)).toFixed(1));
}

export function applyHumidityDisplayPolicyToDevice(
  device: Device,
  opts?: TelemetryViewOptions
): Device {
  const raw = device.telemetry.relative_humidity;
  const display = modulateHumidityDisplayPct(raw, opts);
  return {
    ...device,
    telemetry: {
      ...device.telemetry,
      relative_humidity: display ?? device.telemetry.relative_humidity,
      relative_humidity_raw: raw,
    },
  };
}

export function applyHumidityDisplayPolicyToHistory(
  points: HistoryPoint[],
  opts?: TelemetryViewOptions
): HistoryPoint[] {
  if (showsUnfilteredTelemetry(opts)) return points;
  return points.map((p) => ({
    ...p,
    relative_humidity: modulateHumidityDisplayPct(p.relative_humidity, opts),
  }));
}
