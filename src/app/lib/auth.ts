import { RIPENER_API_URL } from '@/app/config';
import { clearMaduradorListCache } from '@/app/lib/maduradorCache';
import { invalidateDeviceNameCache } from '@/app/lib/deviceNamesCache';

const TOKEN_KEY = 'riper_auth_token';
const USER_KEY = 'riper_auth_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  company: string;
  is_superuser: boolean;
  has_photo?: boolean;
  active?: boolean;
  /** Identificador empresa (API Madurador); opcional */
  identificador?: string | null;
}

function apiRoot() {
  return RIPENER_API_URL.replace(/\/$/, '');
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAuth() {
  setToken(null);
  setStoredUser(null);
  clearMaduradorListCache();
  invalidateDeviceNameCache();
}

export async function loginRequest(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${apiRoot()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let body: { token?: string; user?: AuthUser; message?: string; error?: string } = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    throw new Error(body.message || body.error || res.statusText);
  }
  if (!body.token || !body.user) {
    throw new Error('invalid response');
  }
  clearMaduradorListCache();
  setToken(body.token);
  setStoredUser(body.user);
  return { token: body.token, user: body.user };
}

export async function fetchMe(): Promise<AuthUser> {
  const token = getToken();
  if (!token) throw new Error('no token');
  const res = await fetch(`${apiRoot()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let body: { data?: AuthUser; message?: string } = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
  }
  if (!res.ok) {
    clearAuth();
    throw new Error(body.message || res.statusText);
  }
  const user = body.data;
  if (!user) throw new Error('invalid me response');
  setStoredUser(user);
  return user;
}

export function authHeaders(extra?: HeadersInit): HeadersInit {
  const h = new Headers(extra);
  const t = getToken();
  if (t) h.set('Authorization', `Bearer ${t}`);
  if (!h.has('Accept')) h.set('Accept', 'application/json');
  return h;
}
