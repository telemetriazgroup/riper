import type { Recipe } from '@/app/components/recipes/RecipeBuilder';
import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/recipes`;
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

function toRecipe(row: {
  id: string;
  name: string;
  fruit: string;
  description: string;
  phases: Recipe['phases'];
  is_system?: boolean;
}): Recipe {
  return {
    id: row.id,
    name: row.name,
    fruit: row.fruit,
    description: row.description ?? '',
    phases: row.phases ?? [],
    is_system: row.is_system === true,
  };
}

export async function fetchRecipes(): Promise<Recipe[]> {
  const res = await fetch(base(), { headers: authHeaders() });
  const json = await handle<{ data: Parameters<typeof toRecipe>[0][] }>(res);
  return (json.data ?? []).map(toRecipe);
}

export async function createRecipe(payload: Omit<Recipe, 'id' | 'is_system'>): Promise<Recipe> {
  const res = await fetch(base(), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: payload.name,
      fruit: payload.fruit,
      description: payload.description ?? '',
      phases: payload.phases,
    }),
  });
  const json = await handle<{ data: Parameters<typeof toRecipe>[0] }>(res);
  return toRecipe(json.data);
}

export async function updateRecipe(id: string, payload: Partial<Omit<Recipe, 'id'>>): Promise<Recipe> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: Parameters<typeof toRecipe>[0] }>(res);
  return toRecipe(json.data);
}

export async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok?: boolean }>(res);
}
