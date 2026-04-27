import useSWR from 'swr';
import { fetchActiveControlSession, type DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';

export function useDeviceControlSession(deviceId: string | undefined) {
  const key = deviceId ? `device-control-active:${deviceId}` : null;
  const { data, error, isLoading, mutate } = useSWR<DeviceControlSessionRow | null>(
    key,
    () => fetchActiveControlSession(deviceId!),
    { refreshInterval: 30000 }
  );
  return { session: data ?? null, isLoading, isError: error, mutate };
}
