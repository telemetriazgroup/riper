import useSWR from 'swr';
import { fetchActiveControlSession, type DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';

export function useDeviceControlSession(deviceId: string | undefined, refreshIntervalMs = 30000) {
  const key = deviceId ? `device-control-active:${deviceId}` : null;
  const { data, error, isLoading, mutate } = useSWR<DeviceControlSessionRow | null>(
    key,
    () => fetchActiveControlSession(deviceId!),
    { refreshInterval: refreshIntervalMs }
  );
  return { session: data ?? null, isLoading, isError: error, mutate };
}
