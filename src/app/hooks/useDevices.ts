import useSWR from 'swr';
import { fetchDevices, fetchDevice, fetchDeviceHistory, type FetchHistoryOptions } from '@/app/lib/api';
import { Device } from '@/app/data';
import { isGourmetSession } from '@/app/lib/gourmet';

export function useDevices() {
  const gourmet = isGourmetSession();
  const { data, error, isLoading, mutate } = useSWR<Device[]>(
    gourmet ? 'gourmet:/api/devices' : '/api/devices',
    fetchDevices,
    { refreshInterval: gourmet ? 0 : 5000 }
  );

  return {
    devices: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useDevice(id: string | null) {
  const gourmet = isGourmetSession();
  const { data, error, isLoading, mutate } = useSWR<Device>(
    id ? (gourmet ? `gourmet:/api/devices/${id}` : `/api/devices/${id}`) : null,
    () => fetchDevice(id!),
    { refreshInterval: gourmet ? 0 : 5000 }
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
  const key =
    id && options
      ? gourmet
        ? `gourmet:/api/devices/${id}/history?${encodeURIComponent(JSON.stringify(options))}`
        : `/api/devices/${id}/history?fecha_inicio=${options.fecha_inicio ?? ''}&fecha_fin=${options.fecha_fin ?? ''}`
      : id
        ? gourmet
          ? `gourmet:/api/devices/${id}/history`
          : `/api/devices/${id}/history`
        : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchDeviceHistory(id!, options ?? {}),
    { refreshInterval: gourmet ? 0 : 60000 }
  );

  return {
    history: data,
    isLoading,
    isError: error,
    mutate,
  };
}
