import useSWR from 'swr';
import { fetchDevices, fetchDevice, fetchDeviceHistory } from '@/app/lib/api';
import { Device } from '@/app/data';

// SWR key can be the function name or a string key
const DEVICES_KEY = '/api/devices';

export function useDevices() {
  const { data, error, isLoading, mutate } = useSWR<Device[]>(
    DEVICES_KEY, 
    fetchDevices, 
    { 
      refreshInterval: 5000 // Poll every 5 seconds for "real-time" telemetry
    }
  );

  return {
    devices: data || [],
    isLoading,
    isError: error,
    mutate
  };
}

export function useDevice(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Device>(
    id ? `/api/devices/${id}` : null,
    () => fetchDevice(id!),
    {
      refreshInterval: 5000
    }
  );

  return {
    device: data,
    isLoading,
    isError: error,
    mutate
  };
}

export function useDeviceHistory(id: string | null, days: number = 1) {
  const { data, error, isLoading } = useSWR(
    id ? `/api/devices/${id}/history?days=${days}` : null,
    () => fetchDeviceHistory(id!, days),
    { refreshInterval: 10000 }
  );

  return {
    history: data,
    isLoading,
    isError: error
  };
}
