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
  name_en?: string | null;
  fruit: string;
  fruit_en?: string | null;
  description: string;
  description_en?: string | null;
  phases: Recipe['phases'];
  is_system?: boolean;
  archived?: boolean;
  archived_at?: string | null;
  iconKey?: string | null;
  customImageUrl?: string | null;
  icon_key?: string | null;
  custom_image_url?: string | null;
}): Recipe {
  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en ?? null,
    fruit: row.fruit,
    fruit_en: row.fruit_en ?? null,
    description: row.description ?? '',
    description_en: row.description_en ?? null,
    phases: row.phases ?? [],
    is_system: row.is_system === true,
    archived: row.archived === true || Boolean(row.archived_at),
    archived_at: row.archived_at ?? null,
    iconKey: row.iconKey ?? row.icon_key ?? null,
    customImageUrl: row.customImageUrl ?? row.custom_image_url ?? null,
  };
}

export async function fetchRecipes(opts?: { includeArchived?: boolean }): Promise<Recipe[]> {
  const u = new URL(base());
  if (opts?.includeArchived) u.searchParams.set('includeArchived', '1');
  const res = await fetch(u.toString(), { headers: authHeaders() });
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
      iconKey: payload.iconKey ?? null,
      customImageUrl: payload.customImageUrl?.trim() ? payload.customImageUrl.trim() : null,
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

/** Archiva la receta (no borra el registro en base de datos) */
export async function deleteRecipe(id: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ ok?: boolean }>(res);
}

export async function restoreRecipe(id: string): Promise<Recipe> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  const json = await handle<{ data: Parameters<typeof toRecipe>[0] }>(res);
  return toRecipe(json.data);
}
