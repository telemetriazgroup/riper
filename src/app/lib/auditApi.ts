import { RIPENER_API_URL } from '@/app/config';
import { getToken } from '@/app/lib/auth';

function apiRoot() {
  return RIPENER_API_URL.replace(/\/$/, '');
}

export type AuditLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
};

export async function fetchAuditLogs(limit = 80, beforeId?: string | null): Promise<{
  data: AuditLogRow[];
  nextBeforeId: string | null;
}> {
  const token = getToken();
  if (!token) throw new Error('no_session');
  const u = new URL(`${apiRoot()}/api/v1/audit/logs`);
  u.searchParams.set('limit', String(limit));
  if (beforeId) u.searchParams.set('beforeId', beforeId);
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await res.text();
  let body: { data?: AuditLogRow[]; nextBeforeId?: string | null } = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(text || 'audit_fetch_error');
    }
  }
  if (!res.ok) {
    const msg =
      (body as { message?: string }).message ||
      (body as { error?: string }).error ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    data: Array.isArray(body.data) ? body.data : [],
    nextBeforeId: body.nextBeforeId ?? null,
  };
}
