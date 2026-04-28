import useSWR from 'swr';
import {
  DEVICE_PROCESS_FOLLOW_SWR_KEY,
  fetchDeviceProcessFollow,
  type DeviceProcessFollowRow,
} from '@/app/lib/deviceProcessFollowApi';

export function useDeviceProcessFollow(deviceId: string | undefined) {
  const key = DEVICE_PROCESS_FOLLOW_SWR_KEY(deviceId);
  const { data, error, isLoading, mutate } = useSWR<DeviceProcessFollowRow | null>(
    key,
    () => fetchDeviceProcessFollow(deviceId!),
    { revalidateOnFocus: true, refreshInterval: 45_000 }
  );

  return {
    follow: data ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}
