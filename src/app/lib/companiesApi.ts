import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

export interface AppCompany {
  id: string;
  name: string;
  ruc_id: string;
  address: string;
  email: string;
  contact_name: string;
  phone: string;
  created_at: string;
  updated_at: string;
  archived?: boolean;
  archived_at?: string | null;
}

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/companies`;
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

export async function fetchCompanies(opts?: { includeArchived?: boolean }): Promise<AppCompany[]> {
  const u = new URL(base());
  if (opts?.includeArchived) u.searchParams.set('includeArchived', '1');
  const res = await fetch(u.toString(), { headers: authHeaders() });
  const json = await handle<{ data: AppCompany[] }>(res);
  const list = json.data ?? [];
  return list.map((c) => ({
    ...c,
    archived: c.archived === true || Boolean(c.archived_at),
  }));
}

export type CompanyCreatePayload = {
  name: string;
  ruc_id?: string;
  address?: string;
  email?: string;
  contact_name?: string;
  phone?: string;
};

export async function createCompany(payload: CompanyCreatePayload): Promise<AppCompany> {
  const res = await fetch(base(), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: AppCompany }>(res);
  return json.data;
}

export async function updateCompany(id: string, payload: Partial<CompanyCreatePayload>): Promise<AppCompany> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: AppCompany }>(res);
  return json.data;
}

export async function deleteCompany(id: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok?: boolean }>(res);
}

export async function restoreCompany(id: string): Promise<AppCompany> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  const json = await handle<{ data: AppCompany }>(res);
  return json.data;
}
