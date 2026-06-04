import type { Device } from '@/app/data';
import type { HistoryPoint } from '@/app/lib/api';
import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import type { RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';
import {
  applyEthyleneDisplayPolicyToDevice,
  applyEthyleneDisplayPolicyToHistory,
  type EthyleneDisplayPolicyContext,
} from '@/app/lib/ethyleneDisplayPolicy';
import {
  applyHumidityDisplayPolicyToDevice,
  applyHumidityDisplayPolicyToHistory,
} from '@/app/lib/humidityDisplayPolicy';
import type { TelemetryViewOptions } from '@/app/lib/telemetryViewPolicy';

export type TelemetryDisplayContext = EthyleneDisplayPolicyContext;

export function applyTelemetryDisplayPolicyToDevice(
  device: Device,
  ctx?: TelemetryDisplayContext
): Device {
  const withEth = applyEthyleneDisplayPolicyToDevice(device, ctx);
  return applyHumidityDisplayPolicyToDevice(withEth, ctx?.view);
}

export function applyTelemetryDisplayPolicyToHistory(
  points: HistoryPoint[],
  opts: EthyleneDisplayPolicyContext
): HistoryPoint[] {
  const withEth = applyEthyleneDisplayPolicyToHistory(points, opts);
  return applyHumidityDisplayPolicyToHistory(withEth, opts.view);
}
