import { useMemo } from 'react';
import useSWR, { mutate as swrMutate } from 'swr';
import { listControlSessions, type DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';

export const FLEET_ACTIVE_CONTROL_SESSIONS_KEY = 'fleet-active-control-sessions';

/** Tras iniciar/cancelar/completar una sesión de control desde cualquier vista. */
export function revalidateFleetActiveControlSessions() {
  return swrMutate(FLEET_ACTIVE_CONTROL_SESSIONS_KEY);
}

/**
 * Un solo listado de sesiones de control; se filtra por `status === 'active'`
 * y se indexa por `device_id` para la vista de flota.
 */
export function useFleetActiveControlMap() {
  const { data, error, isLoading } = useSWR(
    FLEET_ACTIVE_CONTROL_SESSIONS_KEY,
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
