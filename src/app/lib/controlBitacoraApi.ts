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

/** Consulta por rango de fechas (máx. 90 días en servidor). */
export async function queryBitacoraRange(opts: {
  deviceId: string;
  from: string;
  to: string;
  cursor?: string;
  limit?: number;
  action?: string;
  processType?: string;
  includePayload?: boolean;
}): Promise<ControlBitacoraListResult> {
  const u = new URL(base());
  u.searchParams.set('deviceId', opts.deviceId);
  u.searchParams.set('from', opts.from);
  u.searchParams.set('to', opts.to);
  if (opts.cursor) u.searchParams.set('cursor', opts.cursor);
  if (opts.limit != null) u.searchParams.set('limit', String(opts.limit));
  if (opts.action) u.searchParams.set('action', opts.action);
  if (opts.processType) u.searchParams.set('processType', opts.processType);
  u.searchParams.set('includePayload', opts.includePayload === false ? '0' : '1');
  const res = await fetch(u.toString(), { headers: authHeaders() });
  return handle<ControlBitacoraListResult>(res);
}

export function bitacoraRowsToCsv(rows: ControlBitacoraRow[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = [
    'occurred_at',
    'device_id',
    'action',
    'kind',
    'process_type',
    'source',
    'summary',
    'user_email',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.occurred_at,
        r.device_id,
        r.action,
        r.kind,
        r.process_type,
        r.source,
        r.summary,
        r.user_email,
      ]
        .map(esc)
        .join(',')
    );
  }
  return lines.join('\n');
}

export const DEVICE_BITACORA_SWR_KEY = 'device-control-bitacora';
export const BITACORA_MAX_RANGE_DAYS = 90;
