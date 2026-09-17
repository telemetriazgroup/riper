import useSWR from 'swr';
import {
  DEVICE_BITACORA_SWR_KEY,
  listDeviceBitacora,
  type ControlBitacoraRow,
} from '@/app/lib/controlBitacoraApi';
import { isGreenyardSession, isUltraorganicsSession } from '@/app/lib/fleetDemo';
import { isGourmetSession } from '@/app/lib/gourmet';

function refreshMs(): number {
  return isUltraorganicsSession() || isGreenyardSession() || isGourmetSession() ? 30_000 : 60_000;
}

export function useDeviceBitacora(deviceId: string, hours = 12) {
  const id = String(deviceId || '').trim();
  const key = id ? ([DEVICE_BITACORA_SWR_KEY, id, hours] as const) : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => listDeviceBitacora(id, { hours, includePayload: true }),
    { revalidateOnFocus: true, refreshInterval: refreshMs() }
  );
  return {
    rows: (data?.data ?? []) as ControlBitacoraRow[],
    nextCursor: data?.nextCursor ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}
