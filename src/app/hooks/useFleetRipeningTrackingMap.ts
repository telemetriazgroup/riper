import { useMemo } from 'react';
import useSWR from 'swr';
import { fetchRipeningProcesses, type RipeningProcessRow } from '@/app/lib/ripeningProcessesApi';

/** Una sola petición: procesos de seguimiento (pestaña Seguimiento) indexados por equipo (`payload.deviceId`). */
export const RIPENING_PROCESSES_FLEET_SWR_KEY = 'ripening-processes-fleet-map';

export function useFleetRipeningTrackingMap() {
  const { data, error, isLoading, mutate } = useSWR(RIPENING_PROCESSES_FLEET_SWR_KEY, fetchRipeningProcesses, {
    revalidateOnFocus: true,
    refreshInterval: 60_000,
  });

  const byDeviceId = useMemo(() => {
    const m = new Map<string, RipeningProcessRow>();
    const actives = (data ?? []).filter((r) => r.status === 'active');
    const sorted = [...actives].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    for (const row of sorted) {
      const did = String((row.payload as { deviceId?: string })?.deviceId ?? '').trim();
      if (!did || m.has(did)) continue;
      m.set(did, row);
    }
    return m;
  }, [data]);

  return { byDeviceId, isLoading, isError: error, mutate };
}
