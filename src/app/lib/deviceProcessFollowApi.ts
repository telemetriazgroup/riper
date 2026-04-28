import { RIPENER_API_URL } from '@/app/config';
import type { Device } from '@/app/data';
import { authHeaders } from '@/app/lib/auth';

function apiRoot(): string {
  return RIPENER_API_URL.replace(/\/$/, '');
}

export interface DeviceProcessFollowPayload {
  device_id: string;
  proceso: string;
  id_proceso: number | null;
  fecha_inicio: string | null;
  hasta: string | null;
  progress: number | null;
  numero_alarma: number;
}

export function devicesToProcessFollowPayload(devices: Device[]): DeviceProcessFollowPayload[] {
  return devices.map((d) => ({
    device_id: d.id,
    proceso: d.procesoApi ?? d.process?.name ?? '',
    id_proceso: d.idProcesoApi ?? null,
    fecha_inicio: d.madurador?.fecha_inicio ?? d.process?.startTime ?? null,
    hasta: d.madurador?.hasta ?? d.process?.endTime ?? null,
    progress: d.process?.showProgressBar === false ? null : (d.process?.progress ?? null),
    numero_alarma: d.numeroAlarmaTotal ?? 0,
  }));
}

/** Guarda en servidor el seguimiento de proceso por dispositivo (snapshot del panel). */
export async function syncDeviceProcessFollow(items: DeviceProcessFollowPayload[]): Promise<void> {
  if (items.length === 0) return;
  const headers = new Headers(authHeaders());
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${apiRoot()}/api/v1/device-process-follow/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ items }),
  });
  if (!res.ok && res.status !== 401) {
    const t = await res.text();
    throw new Error(t || `sync process follow: ${res.status}`);
  }
}

/** Fila en servidor (`GET …/device-process-follow/device/:id`). */
export type DeviceProcessFollowRow = {
  device_id: string;
  proceso: string;
  id_proceso: number | null;
  fecha_inicio: string | null;
  hasta: string | null;
  progress: number | null;
  numero_alarma: number;
  updated_at?: string | null;
};

/** Seguimiento sincronizado para el usuario actual y este dispositivo (o null). */
export async function fetchDeviceProcessFollow(deviceId: string): Promise<DeviceProcessFollowRow | null> {
  const id = String(deviceId ?? '').trim();
  if (!id) return null;
  const res = await fetch(
    `${apiRoot()}/api/v1/device-process-follow/device/${encodeURIComponent(id)}`,
    { headers: authHeaders() }
  );
  if (res.status === 401) return null;
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `fetch process follow: ${res.status}`);
  }
  const json = (await res.json()) as { data: DeviceProcessFollowRow | null };
  return json.data ?? null;
}

/** Quita el seguimiento para poder iniciar procesos desde el panel de control. */
export async function cancelDeviceProcessFollow(deviceId: string): Promise<void> {
  const id = String(deviceId ?? '').trim();
  if (!id) return;
  const res = await fetch(`${apiRoot()}/api/v1/device-process-follow/device/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `cancel process follow: ${res.status}`);
  }
}

export const DEVICE_PROCESS_FOLLOW_SWR_KEY = (deviceId: string | undefined) =>
  deviceId ? `device-process-follow:${deviceId}` : null;

