import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/device-ethylene-config`;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) clearAuth();
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!res.ok) {
    const o = body as { message?: string; error?: string } | null;
    throw new Error(o?.message || o?.error || res.statusText || `HTTP ${res.status}`);
  }
  return body as T;
}

export type DeviceEthyleneConfigRow = {
  device_id: string;
  injection_multiplier: number;
  updated_at: string | null;
  updated_by: string | null;
};

export async function fetchDeviceEthyleneConfigs(): Promise<DeviceEthyleneConfigRow[]> {
  const res = await fetch(base(), { headers: authHeaders() });
  const json = await handle<{ data: DeviceEthyleneConfigRow[] }>(res);
  return json.data ?? [];
}

export async function upsertDeviceEthyleneConfig(
  deviceId: string,
  injectionMultiplier: number
): Promise<DeviceEthyleneConfigRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ injection_multiplier: injectionMultiplier }),
  });
  const json = await handle<{ data: DeviceEthyleneConfigRow }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function deleteDeviceEthyleneConfig(deviceId: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok: boolean }>(res);
}
