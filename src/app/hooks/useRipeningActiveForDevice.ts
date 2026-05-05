import useSWR from 'swr';
import {
  fetchActiveProcessForDevice,
  type ActiveDeviceSummary,
  type RipeningProcessRow,
} from '@/app/lib/ripeningProcessesApi';
import {
  buildSimulatedRipeningProcessRow,
  isSimulatedInkapackingDevice,
  shouldShowSimulatedInkapackingFleet,
  type SimInkapackingDeviceId,
} from '@/app/lib/simulatedInkapackingFleet';

function progressFromSchedule(startedAt: string, estimatedEndAt: string | null | undefined): number {
  if (!estimatedEndAt) return 0;
  const a = new Date(startedAt).getTime();
  const b = new Date(estimatedEndAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  const p = (now - a) / (b - a);
  return Math.min(100, Math.max(0, Math.round(p * 100)));
}

/** Proceso activo de la pestaña Seguimiento vinculado a este `deviceId` en el payload. */
export function useRipeningActiveForDevice(deviceId: string | undefined) {
  const key = deviceId ? `ripening-active-for-device:${deviceId}` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    async (): Promise<{ process: RipeningProcessRow; summary: ActiveDeviceSummary } | null> => {
      if (!deviceId) return null;
      if (isSimulatedInkapackingDevice(deviceId) && shouldShowSimulatedInkapackingFleet()) {
        const row = buildSimulatedRipeningProcessRow(deviceId as SimInkapackingDeviceId);
        const p = row.payload;
        const b = p.batch as Record<string, unknown> | undefined;
        const product = String(b?.product ?? 'Mango');
        const sched = p.scheduleSummary as { startedAt?: string; estimatedEndAt?: string | null } | undefined;
        const startedAt = String(sched?.startedAt ?? new Date().toISOString());
        const estimatedEndAt = sched?.estimatedEndAt ?? null;
        return {
          process: row,
          summary: {
            id: row.id,
            display_name: row.display_name,
            client: String((p.client as { name?: string })?.name ?? ''),
            product,
            deviceId,
            progress: progressFromSchedule(startedAt, estimatedEndAt),
            startedAt,
            estimatedEndAt: estimatedEndAt != null ? String(estimatedEndAt) : null,
          },
        };
      }
      return fetchActiveProcessForDevice(deviceId);
    },
    { revalidateOnFocus: true, refreshInterval: 45_000 }
  );

  return {
    activeTracking: data,
    isLoading,
    isError: error,
    mutate,
  };
}
