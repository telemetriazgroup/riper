import useSWR from 'swr';
import { fetchActiveControlSession, type DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import { isAutomatedControlDevice } from '@/app/lib/fleetDemo';

export function useDeviceControlSession(deviceId: string | undefined, refreshIntervalMs = 30000) {
  const interval =
    deviceId && isAutomatedControlDevice(deviceId) ? Math.min(refreshIntervalMs, 10000) : refreshIntervalMs;
  const key = deviceId ? `device-control-active:${deviceId}` : null;
  const { data, error, isLoading, mutate } = useSWR<DeviceControlSessionRow | null>(
    key,
    () => fetchActiveControlSession(deviceId!),
    { refreshInterval: interval }
  );
  return { session: data ?? null, isLoading, isError: error, mutate };
}
