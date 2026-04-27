import { FLEET_DEMO_IDENTIFICADOR, MADURADOR_DEMO_API_URL } from '@/app/config';
import type { Device } from '@/app/data';
import { authHeaders } from '@/app/lib/auth';
import { filterDevicesToIdentificadorImeiSuffix, mapMaduradorRowToDevice } from '@/app/lib/madurador';

function apiRoot(): string {
  return MADURADOR_DEMO_API_URL.replace(/\/$/, '');
}

async function parseJsonArray(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  if (!text.trim()) return [];
  const json = JSON.parse(text) as unknown;
  return Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
}

/** Lista: GET …/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador= */
export async function fetchFleetDemoMaduradorList(): Promise<Device[]> {
  const base = apiRoot();
  const url = `${base}/Madurador/listar_dispositivos_proceso_identificador_empresa/?identificador=${encodeURIComponent(FLEET_DEMO_IDENTIFICADOR)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`madurador_list: ${res.status} ${res.statusText}`);
  const rows = await parseJsonArray(res);
  const list = rows.map((r) => mapMaduradorRowToDevice(r));
  return filterDevicesToIdentificadorImeiSuffix(list, FLEET_DEMO_IDENTIFICADOR);
}

/** Detalle: GET …/Madurador/buscar_datos_madurador_rango/?imei= */
export async function fetchFleetDemoMaduradorDetail(imei: string): Promise<Device> {
  const base = apiRoot();
  const url = `${base}/Madurador/buscar_datos_madurador_rango/?imei=${encodeURIComponent(imei)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`madurador_detail: ${res.status} ${res.statusText}`);
  const rows = await parseJsonArray(res);
  const row = rows.find((r) => String(r.imei ?? '') === imei) ?? rows[0];
  if (!row) throw new Error('madurador_detail: empty');
  return mapMaduradorRowToDevice(row);
}
