import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

export interface AppProduct {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
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

export async function fetchProducts(): Promise<AppProduct[]> {
  const res = await fetch(base(), { headers: authHeaders() });
  const json = await handle<{ data: AppProduct[] }>(res);
  return json.data ?? [];
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

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok?: boolean }>(res);
}
