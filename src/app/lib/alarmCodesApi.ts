import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

export interface AlarmCodeRecord {
  id: string;
  code: number;
  titleEs: string;
  titleEn: string;
  descriptionEs: string;
  descriptionEn: string;
  correctiveActionEs: string;
  correctiveActionEn: string;
  model: string;
  created_at?: string;
  updated_at?: string;
  archived?: boolean;
  archived_at?: string | null;
}

export type AlarmCodePayload = {
  code: number;
  titleEs: string;
  titleEn: string;
  descriptionEs?: string;
  descriptionEn?: string;
  correctiveActionEs?: string;
  correctiveActionEn?: string;
  model?: string;
};

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/alarm-codes`;
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
    const o = body as { message?: string; error?: string; raw?: string } | null;
    const msg = o?.message || o?.error || (o && 'raw' in o ? String(o.raw) : null) || res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchAlarmCodes(opts?: { includeArchived?: boolean }): Promise<AlarmCodeRecord[]> {
  const u = new URL(base());
  if (opts?.includeArchived) u.searchParams.set('includeArchived', '1');
  const res = await fetch(u.toString(), { headers: authHeaders() });
  const json = await handle<{ data: AlarmCodeRecord[] }>(res);
  return (json.data ?? []).map((a) => ({
    ...a,
    archived: a.archived === true || Boolean(a.archived_at),
  }));
}

export async function createAlarmCode(payload: AlarmCodePayload): Promise<AlarmCodeRecord> {
  const res = await fetch(base(), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: AlarmCodeRecord }>(res);
  return json.data;
}

export async function updateAlarmCode(id: string, payload: Partial<AlarmCodePayload>): Promise<AlarmCodeRecord> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: AlarmCodeRecord }>(res);
  return json.data;
}

export async function archiveAlarmCode(id: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok?: boolean }>(res);
}

export async function restoreAlarmCode(id: string): Promise<AlarmCodeRecord> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  const json = await handle<{ data: AlarmCodeRecord }>(res);
  return json.data;
}
