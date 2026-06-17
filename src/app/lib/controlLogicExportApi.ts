import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

export type ControlLogicExportDocument = Record<string, unknown>;

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
    const o = body as { message?: string; error?: string; raw?: string } | null;
    const msg = o?.message || o?.error || (o && 'raw' in o ? String(o.raw) : null) || res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchControlLogicExport(): Promise<ControlLogicExportDocument> {
  const base = `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/control-logic/export`;
  const res = await fetch(base, { headers: authHeaders() });
  const json = await handle<{ data: ControlLogicExportDocument }>(res);
  return json.data;
}
