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
