import { useMemo } from 'react';
import useSWR, { mutate as swrMutate } from 'swr';
import { listControlSessions } from '@/app/lib/deviceControlProcessApi';
import { indexControlSessionsByDevice } from '@/app/lib/fleetControlSessions';
import { isGreenyardSession, isUltraorganicsSession } from '@/app/lib/fleetDemo';
import { isGourmetSession } from '@/app/lib/gourmet';

export const FLEET_ACTIVE_CONTROL_SESSIONS_KEY = 'fleet-active-control-sessions';

/** Tras iniciar/cancelar/completar una sesión de control desde cualquier vista. */
export function revalidateFleetActiveControlSessions() {
  return swrMutate(FLEET_ACTIVE_CONTROL_SESSIONS_KEY);
}

function fleetSessionRefreshMs(): number {
  return isUltraorganicsSession() || isGreenyardSession() || isGourmetSession() ? 30_000 : 60_000;
}

/**
 * Un solo listado de sesiones de control; se filtra por `status === 'active'`
 * y se indexa por `device_id` para la vista de flota.
 */
export function useFleetActiveControlMap() {
  const refreshInterval = fleetSessionRefreshMs();
  const { data, error, isLoading } = useSWR(
    FLEET_ACTIVE_CONTROL_SESSIONS_KEY,
    listControlSessions,
    { revalidateOnFocus: true, refreshInterval }
  );
  const byDeviceId = useMemo(() => indexControlSessionsByDevice(data ?? []), [data]);
  return { byDeviceId, isLoading, isError: error };
}
