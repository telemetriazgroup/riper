import useSWR, { mutate as swrMutate } from 'swr';
import {
  listControlSessions,
  CONTROL_SESSIONS_LIST_SWR_KEY,
  type DeviceControlSessionRow,
} from '@/app/lib/deviceControlProcessApi';

function keyFor(includeArchived: boolean) {
  return [CONTROL_SESSIONS_LIST_SWR_KEY, includeArchived] as const;
}

export function useControlSessionsList(includeArchived = false) {
  const k = keyFor(includeArchived);
  const fetcher = () => listControlSessions({ includeArchived });
  const { data, error, isLoading, mutate } = useSWR<DeviceControlSessionRow[]>(
    k,
    fetcher,
    { revalidateOnFocus: true }
  );
  return { sessions: data ?? [], isLoading, isError: error, mutate };
}

/** Tras crear/editar/archivar/restaurar — revalidar todas las variantes del listado. */
export function revalidateControlSessionsList() {
  return swrMutate(
    (key) =>
      Array.isArray(key) && key.length >= 2 && key[0] === CONTROL_SESSIONS_LIST_SWR_KEY
  );
}
