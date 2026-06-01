import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

export interface AppProduct {
  id: string;
  name: string;
  name_en?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived?: boolean;
  archived_at?: string | null;
}

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/products`;
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

export async function fetchProducts(opts?: { includeArchived?: boolean }): Promise<AppProduct[]> {
  const u = new URL(base());
  if (opts?.includeArchived) u.searchParams.set('includeArchived', '1');
  const res = await fetch(u.toString(), { headers: authHeaders() });
  const json = await handle<{ data: AppProduct[] }>(res);
  const list = json.data ?? [];
  return list.map((p) => ({
    ...p,
    archived: p.archived === true || Boolean(p.archived_at),
  }));
}

export async function createProduct(payload: { name: string; sort_order?: number }): Promise<AppProduct> {
  const res = await fetch(base(), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: AppProduct }>(res);
  return json.data;
}

export async function updateProduct(
  id: string,
  payload: Partial<Pick<AppProduct, 'name' | 'sort_order'>>
): Promise<AppProduct> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: AppProduct }>(res);
  return json.data;
}

/** Archiva el producto (no borra el registro) */
export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok?: boolean }>(res);
}

export async function restoreProduct(id: string): Promise<AppProduct> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  const json = await handle<{ data: AppProduct }>(res);
  return json.data;
}
