import { useMemo } from 'react';
import { useControlSessionsList, revalidateControlSessionsList } from '@/app/hooks/useControlSessionsList';
import { indexControlSessionsByDevice } from '@/app/lib/fleetControlSessions';

/** @deprecated Alias: flota y panel comparten la misma clave SWR. */
export const FLEET_ACTIVE_CONTROL_SESSIONS_KEY = 'fleet-active-control-sessions';

export function revalidateFleetActiveControlSessions() {
  return revalidateControlSessionsList();
}

/**
 * Misma fuente SWR que el panel (`device-control-sessions`) para no duplicar
 * GET /sessions. Filtra activos e indexa por `device_id`.
 */
export function useFleetActiveControlMap() {
  const { sessions, isLoading, isError } = useControlSessionsList(false);
  const byDeviceId = useMemo(() => indexControlSessionsByDevice(sessions), [sessions]);
  return { byDeviceId, isLoading, isError };
}
