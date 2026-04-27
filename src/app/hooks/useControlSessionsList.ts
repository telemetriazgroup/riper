import useSWR, { mutate as swrMutate } from 'swr';
import { listControlSessions, CONTROL_SESSIONS_LIST_SWR_KEY, type DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';

const fetcher = () => listControlSessions();

export function useControlSessionsList() {
  const { data, error, isLoading, mutate } = useSWR<DeviceControlSessionRow[]>(
    CONTROL_SESSIONS_LIST_SWR_KEY,
    fetcher,
    { revalidateOnFocus: true }
  );
  return { sessions: data ?? [], isLoading, isError: error, mutate };
}

/** Llamar tras crear/editar/eliminar una sesión desde el panel. */
export function revalidateControlSessionsList() {
  return swrMutate(CONTROL_SESSIONS_LIST_SWR_KEY, listControlSessions());
}
