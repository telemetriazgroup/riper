import { RIPENER_API_URL } from '@/app/config';
import { authHeaders } from '@/app/lib/auth';
import {
  applySobrenombresToDevice,
  deviceNameStorageKey,
  mergeDevicesWithSobrenombres,
  resolveDeviceDisplayName,
} from '@/app/lib/deviceLocalNames';
import {
  getCachedDeviceNameMap,
  getDeviceNameCacheEpoch,
  invalidateDeviceNameCache,
  setCachedDeviceNameMap,
} from '@/app/lib/deviceNamesCache';

function apiRoot(): string {
  return RIPENER_API_URL.replace(/\/$/, '');
}

export { invalidateDeviceNameCache };

/** Mapa device_id (IMEI) → nombre personalizado del usuario actual. */
export async function fetchDeviceNameMap(): Promise<Record<string, string>> {
  const now = Date.now();
  const hit = getCachedDeviceNameMap(now);
  if (hit) return hit;

  const fetchEpoch = getDeviceNameCacheEpoch();
  const res = await fetch(`${apiRoot()}/api/v1/device-names`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('unauthorized');
    throw new Error(`device-names: ${res.status}`);
  }
  const body = (await res.json()) as { data?: Record<string, string> };
  const raw = body.data && typeof body.data === 'object' ? body.data : {};
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = deviceNameStorageKey(k);
    if (nk) map[nk] = String(v);
  }
  setCachedDeviceNameMap(map, Date.now(), fetchEpoch);
  return map;
}

export async function putDeviceDisplayName(deviceId: string, displayName: string): Promise<void> {
  const key = deviceNameStorageKey(deviceId) || deviceId;
  const headers = new Headers(authHeaders());
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${apiRoot()}/api/v1/device-names/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `save name: ${res.status}`);
  }
  const now = Date.now();
  const prev = getCachedDeviceNameMap(now) ?? {};
  invalidateDeviceNameCache();
  if (Object.keys(prev).length > 0) {
    const epoch = getDeviceNameCacheEpoch();
    setCachedDeviceNameMap({ ...prev, [key]: displayName }, Date.now(), epoch);
  } else {
    void fetchDeviceNameMap().catch(() => {
      /* red / 401: la siguiente lista refrescará */
    });
  }
}

export { applySobrenombresToDevice, deviceNameStorageKey, mergeDevicesWithSobrenombres, resolveDeviceDisplayName };

/** @deprecated use applySobrenombresToDevice */
export const applyDisplayNameToDevice = applySobrenombresToDevice;
/** @deprecated use mergeDevicesWithSobrenombres */
export const mergeDevicesWithDisplayNames = mergeDevicesWithSobrenombres;
