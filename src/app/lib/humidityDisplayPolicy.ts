import type { Device } from '@/app/data';
import type { HistoryPoint } from '@/app/lib/api';
import { showsUnfilteredTelemetry, type TelemetryViewOptions } from '@/app/lib/telemetryViewPolicy';

const HUMIDITY_DISPLAY_DECIMALS = 1;

function roundHumidityDisplay(value: number): number {
  return Number(value.toFixed(HUMIDITY_DISPLAY_DECIMALS));
}

/**
 * Usuario normal: ignorar 0; 1–50 → 50–70 proporcional; 51–90 → 71–90; >90 sin filtro.
 * Ej. lectura 40 → ~65,9 %; lectura 1 → 50,0 %.
 */
export function modulateHumidityDisplayPct(
  rawPct: number | null | undefined,
  opts?: TelemetryViewOptions
): number | null {
  if (rawPct == null || !Number.isFinite(Number(rawPct))) return null;
  const raw = Number(rawPct);
  if (showsUnfilteredTelemetry(opts)) return roundHumidityDisplay(raw);

  if (raw <= 0) return null;
  if (raw > 90) return roundHumidityDisplay(raw);

  if (raw <= 50) {
    const mapped = 50 + ((raw - 1) / 49) * 20;
    return roundHumidityDisplay(mapped);
  }

  const mapped = 71 + ((raw - 51) / 39) * 19;
  return roundHumidityDisplay(Math.min(90, Math.max(71, mapped)));
}

export function applyHumidityDisplayPolicyToDevice(
  device: Device,
  opts?: TelemetryViewOptions
): Device {
  const raw = device.telemetry.relative_humidity;
  const display = modulateHumidityDisplayPct(raw, opts);
  const filtered = !showsUnfilteredTelemetry(opts);
  return {
    ...device,
    telemetry: {
      ...device.telemetry,
      relative_humidity:
        display != null
          ? display
          : filtered && raw <= 0
            ? Number.NaN
            : device.telemetry.relative_humidity,
      relative_humidity_raw: raw,
    },
  };
}

export function applyHumidityDisplayPolicyToHistory(
  points: HistoryPoint[],
  opts?: TelemetryViewOptions
): HistoryPoint[] {
  if (showsUnfilteredTelemetry(opts)) return points;
  return points.map((p) => {
    const display = modulateHumidityDisplayPct(p.relative_humidity, opts);
    return {
      ...p,
      relative_humidity: display ?? (Number(p.relative_humidity) <= 0 ? null : p.relative_humidity),
    };
  });
}
