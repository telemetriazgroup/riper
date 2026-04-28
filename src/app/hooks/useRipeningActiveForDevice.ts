import useSWR from 'swr';
import { fetchActiveProcessForDevice } from '@/app/lib/ripeningProcessesApi';

/** Proceso activo de la pestaña Seguimiento vinculado a este `deviceId` en el payload. */
export function useRipeningActiveForDevice(deviceId: string | undefined) {
  const key = deviceId ? `ripening-active-for-device:${deviceId}` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchActiveProcessForDevice(deviceId!),
    { revalidateOnFocus: true, refreshInterval: 45_000 }
  );

  return {
    activeTracking: data,
    isLoading,
    isError: error,
    mutate,
  };
}
