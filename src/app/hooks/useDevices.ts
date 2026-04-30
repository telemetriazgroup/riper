import useSWR from 'swr';
import { useEffect } from 'react';
import { fetchDevices, fetchDevice, fetchDeviceHistory, type FetchHistoryOptions } from '@/app/lib/api';
import { Device } from '@/app/data';
import { isGourmetSession } from '@/app/lib/gourmet';
import { isFleetDemoSession, isUltraorganicsSession } from '@/app/lib/fleetDemo';
import { getToken } from '@/app/lib/auth';
import { devicesToProcessFollowPayload, syncDeviceProcessFollow } from '@/app/lib/deviceProcessFollowApi';

function devicesSwrKey(): string {
  if (isFleetDemoSession()) return 'fleetDemo:/api/devices';
  if (isGourmetSession()) return 'gourmet:/api/devices';
  return '/api/devices';
}

function deviceSwrKey(id: string | null): string | null {
  if (!id) return null;
  if (isFleetDemoSession()) return `fleetDemo:/api/devices/${id}`;
  if (isGourmetSession()) return `gourmet:/api/devices/${id}`;
  return `/api/devices/${id}`;
}

function historySwrKey(id: string | null, options: unknown): string | null {
  if (!id) return null;
  if (isFleetDemoSession()) return `fleetDemo:/api/devices/${id}/history?${encodeURIComponent(JSON.stringify(options ?? {}))}`;
  if (isGourmetSession()) return `gourmet:/api/devices/${id}/history?${encodeURIComponent(JSON.stringify(options ?? {}))}`;
  if (options && typeof options === 'object' && options !== null && 'fecha_inicio' in options) {
    const o = options as { fecha_inicio?: string; fecha_fin?: string };
    return `/api/devices/${id}/history?fecha_inicio=${o.fecha_inicio ?? ''}&fecha_fin=${o.fecha_fin ?? ''}`;
  }
  return `/api/devices/${id}/history`;
}

export function useDevices() {
  const showcase = isFleetDemoSession() || isGourmetSession() || isUltraorganicsSession();
  const { data, error, isLoading, mutate } = useSWR<Device[]>(
    devicesSwrKey(),
    fetchDevices,
    { refreshInterval: showcase ? 30000 : 5000 }
  );

  useEffect(() => {
    const list = data;
    if (!list?.length || !getToken()) return;
    const t = setTimeout(() => {
      void syncDeviceProcessFollow(devicesToProcessFollowPayload(list)).catch(() => {
        /* sin sesión o red: ignorar */
      });
    }, 700);
    return () => clearTimeout(t);
  }, [data]);

  return {
    devices: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useDevice(id: string | null) {
  const showcase = isFleetDemoSession() || isGourmetSession() || isUltraorganicsSession();
  const { data, error, isLoading, mutate } = useSWR<Device>(
    deviceSwrKey(id),
    () => fetchDevice(id!),
    { refreshInterval: showcase ? 30000 : 5000 }
  );

  return {
    device: data,
    isLoading,
    isError: error,
    mutate,
  };
}

/** Historial: por defecto últimas 12h. Opcionalmente pasa fecha_inicio/fecha_fin para rango personalizado (máx 7 días). */
export function useDeviceHistory(id: string | null, options: FetchHistoryOptions | null = null) {
  const gourmet = isGourmetSession();
  const fleetDemo = isFleetDemoSession();
  const key = id ? historySwrKey(id, options) : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchDeviceHistory(id!, options ?? {}),
    { refreshInterval: gourmet || fleetDemo ? 0 : 60000 }
  );

  return {
    history: Array.isArray(data) ? data : [],
    isLoading,
    isError: error,
    mutate,
  };
}
