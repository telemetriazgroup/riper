import { useMemo } from 'react';
import useSWR from 'swr';
import { listControlSessions, type DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';

const KEY = 'fleet-active-control-sessions';

/**
 * Un solo listado de sesiones de control; se filtra por `status === 'active'`
 * y se indexa por `device_id` para la vista de flota.
 */
export function useFleetActiveControlMap() {
  const { data, error, isLoading } = useSWR(
    KEY,
    listControlSessions,
    { revalidateOnFocus: true, refreshInterval: 60_000 }
  );
  const byDeviceId = useMemo(() => {
    const m = new Map<string, DeviceControlSessionRow>();
    (data ?? []).forEach((s) => {
      if (s.status === 'active') m.set(s.device_id, s);
    });
    return m;
  }, [data]);
  return { byDeviceId, isLoading, isError: error };
}
