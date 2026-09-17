import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth, getToken } from '@/app/lib/auth';

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/ethylene-installations`;
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

export type EthyleneInstallPhoto = {
  id: string;
  kind: string;
  original_name?: string | null;
  url: string;
  created_at?: string | null;
};

export type EthyleneInstallDose = {
  id: string;
  occurred_at: string | null;
  dose_ppm: number | null;
  physical_dato?: number | null;
  reading_before?: number | null;
  reading_after?: number | null;
  injection_seconds?: number | null;
};

export type EthyleneInstallation = {
  id: string;
  device_id: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  status: string;
  notes?: string | null;
  flowmeter_lpm?: number | null;
  test_target_ppm?: number | null;
  test_started_at?: string | null;
  test_completed_at?: string | null;
  test_elapsed_seconds?: number | null;
  test_total_injection_seconds?: number;
  test_baseline_ppm?: number | null;
  test_final_ppm?: number | null;
  test_summary?: Record<string, unknown>;
  notified_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  photos?: EthyleneInstallPhoto[];
  doses?: EthyleneInstallDose[];
};

export function installationPhotoAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const root = RIPENER_API_URL.replace(/\/$/, '');
  const token = getToken();
  const abs = `${root}${url.startsWith('/') ? url : `/${url}`}`;
  // auth via header on fetch; for <img> use token query if needed
  return token ? `${abs}${abs.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}` : abs;
}

export async function listEthyleneInstallations(deviceId: string): Promise<EthyleneInstallation[]> {
  const u = new URL(base());
  u.searchParams.set('deviceId', deviceId);
  const res = await fetch(u.toString(), { headers: authHeaders() });
  const json = await handle<{ data: EthyleneInstallation[] }>(res);
  return json.data ?? [];
}

export async function getEthyleneInstallation(id: string): Promise<EthyleneInstallation> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, { headers: authHeaders() });
  const json = await handle<{ data: EthyleneInstallation }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function createEthyleneInstallation(input: {
  deviceId: string;
  notes?: string;
  flowmeterLpm?: number | null;
  cylinder?: File | null;
  flowmeter?: File | null;
  flowmeterLpmPhoto?: File | null;
}): Promise<EthyleneInstallation> {
  const fd = new FormData();
  fd.append('deviceId', input.deviceId);
  if (input.notes) fd.append('notes', input.notes);
  if (input.flowmeterLpm != null && Number.isFinite(input.flowmeterLpm)) {
    fd.append('flowmeterLpm', String(input.flowmeterLpm));
  }
  if (input.cylinder) fd.append('cylinder', input.cylinder);
  if (input.flowmeter) fd.append('flowmeter', input.flowmeter);
  if (input.flowmeterLpmPhoto) fd.append('flowmeter_lpm', input.flowmeterLpmPhoto);
  const res = await fetch(base(), { method: 'POST', headers: authHeaders(), body: fd });
  const json = await handle<{ data: EthyleneInstallation }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function startEthyleneInstallTest(
  id: string,
  targetPpm: number
): Promise<EthyleneInstallation> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/test/start`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ targetPpm }),
  });
  const json = await handle<{ data: EthyleneInstallation }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function cancelEthyleneInstallTest(id: string): Promise<EthyleneInstallation> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/test/cancel`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await handle<{ data: EthyleneInstallation }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function listPendingInstallNotices(deviceId: string): Promise<EthyleneInstallation[]> {
  const u = new URL(`${base()}/pending-notice`);
  u.searchParams.set('deviceId', deviceId);
  const res = await fetch(u.toString(), { headers: authHeaders() });
  const json = await handle<{ data: EthyleneInstallation[] }>(res);
  return json.data ?? [];
}

export async function ackEthyleneInstallNotice(id: string): Promise<void> {
  await fetch(`${base()}/${encodeURIComponent(id)}/ack-notice`, {
    method: 'POST',
    headers: authHeaders(),
  }).then((r) => handle(r));
}

export const ETHYLENE_INSTALL_SWR_KEY = 'ethylene-installations';
