import useSWR from 'swr';
import { fetchDevices, fetchDevice, fetchDeviceHistory, type FetchHistoryOptions } from '@/app/lib/api';
import { Device } from '@/app/data';

const DEVICES_KEY = '/api/devices';

export function useDevices() {
  const { data, error, isLoading, mutate } = useSWR<Device[]>(
    DEVICES_KEY,
    fetchDevices,
    { refreshInterval: 5000 }
  );

  return {
    devices: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useDevice(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Device>(
    id ? `/api/devices/${id}` : null,
    () => fetchDevice(id!),
    { refreshInterval: 5000 }
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
  const key =
    id && options
      ? `/api/devices/${id}/history?fecha_inicio=${options.fecha_inicio ?? ''}&fecha_fin=${options.fecha_fin ?? ''}`
      : id
        ? `/api/devices/${id}/history`
        : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetchDeviceHistory(id!, options ?? {}),
    { refreshInterval: 60000 }
  );

  return {
    history: data,
    isLoading,
    isError: error,
    mutate,
  };
}
