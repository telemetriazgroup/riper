import useSWR from 'swr';
import {
  fetchActiveProcessForDevice,
  type ActiveDeviceSummary,
  type RipeningProcessRow,
} from '@/app/lib/ripeningProcessesApi';
import {
  buildSimulatedRipeningProcessRow,
  isSimulatedInkapackingDevice,
  isSimulatedRipeningTrackingActive,
  shouldShowSimulatedInkapackingFleet,
  type SimInkapackingDeviceId,
} from '@/app/lib/simulatedInkapackingFleet';

import { progressFromTrackingPayload } from '@/app/lib/ripeningSchedule';
export function useRipeningActiveForDevice(deviceId: string | undefined) {
  const key = deviceId ? `ripening-active-for-device:${deviceId}` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    async (): Promise<{ process: RipeningProcessRow; summary: ActiveDeviceSummary } | null> => {
      if (!deviceId) return null;
      if (isSimulatedInkapackingDevice(deviceId) && shouldShowSimulatedInkapackingFleet()) {
        const row = buildSimulatedRipeningProcessRow(deviceId as SimInkapackingDeviceId);
        if (!isSimulatedRipeningTrackingActive(row.status)) return null;
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
            progress: progressFromTrackingPayload(p, row.status),
            startedAt,
            estimatedEndAt: estimatedEndAt != null ? String(estimatedEndAt) : null,
            status: row.status,
            paused: row.status === 'paused',
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
