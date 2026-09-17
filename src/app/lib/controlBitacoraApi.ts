import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/bitacora`;
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
    const msg = o?.message || o?.error || res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return body as T;
}

export type ControlBitacoraRow = {
  id: string;
  occurred_at: string | null;
  device_id: string;
  session_id?: string | null;
  tracking_id?: string | null;
  source: string;
  action: string;
  kind?: string | null;
  process_type?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown>;
  user_email?: string | null;
  created_at?: string | null;
};

export type ControlBitacoraListResult = {
  data: ControlBitacoraRow[];
  nextCursor: string | null;
};

/** Últimas N horas de bitácora de un equipo (default 12). */
export async function listDeviceBitacora(
  deviceId: string,
  opts?: { hours?: number; cursor?: string; limit?: number; includePayload?: boolean }
): Promise<ControlBitacoraListResult> {
  const u = new URL(base());
  u.searchParams.set('deviceId', deviceId);
  u.searchParams.set('hours', String(opts?.hours ?? 12));
  if (opts?.cursor) u.searchParams.set('cursor', opts.cursor);
  if (opts?.limit != null) u.searchParams.set('limit', String(opts.limit));
  u.searchParams.set('includePayload', opts?.includePayload === false ? '0' : '1');
  const res = await fetch(u.toString(), { headers: authHeaders() });
  return handle<ControlBitacoraListResult>(res);
}

export const DEVICE_BITACORA_SWR_KEY = 'device-control-bitacora';
