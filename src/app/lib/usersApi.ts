import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth, getToken } from '@/app/lib/auth';

export type UserRole = 'superadmin' | 'admin' | 'operator' | 'viewer';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company: string;
  active: boolean;
  is_superuser?: boolean;
  has_photo?: boolean;
  created_at: string;
  updated_at: string;
}

function usersBase() {
  const b = RIPENER_API_URL.replace(/\/$/, '');
  return `${b}/api/v1/users`;
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    clearAuth();
  }
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
    const msg =
      o?.message ||
      o?.error ||
      (o && 'raw' in o ? String(o.raw) : null) ||
      res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchUsers(): Promise<AppUser[]> {
  const res = await fetch(usersBase(), { headers: authHeaders() });
  const json = await handle<{ data: AppUser[] }>(res);
  return json.data ?? [];
}

export async function createUser(payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  company?: string;
  active?: boolean;
}): Promise<AppUser> {
  const res = await fetch(usersBase(), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: AppUser }>(res);
  return json.data;
}

export async function updateUser(
  id: string,
  payload: Partial<Pick<AppUser, 'name' | 'email' | 'role' | 'active' | 'company'>> & {
    password?: string;
  }
): Promise<AppUser> {
  const res = await fetch(`${usersBase()}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: AppUser }>(res);
  return json.data;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${usersBase()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (res.status === 204) return;
  await handle(res);
}

export async function uploadUserAvatar(userId: string, file: File): Promise<void> {
  const token = getToken();
  const fd = new FormData();
  fd.append('photo', file);
  const res = await fetch(`${usersBase()}/${encodeURIComponent(userId)}/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    await handle(res);
  }
}
