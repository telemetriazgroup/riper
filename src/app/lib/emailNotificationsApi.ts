import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

export type EmailEventType =
  | 'manual_control'
  | 'process_start'
  | 'tracking_start'
  | 'phase_complete'
  | 'tracking_complete'
  | 'sampling';

export interface EmailConfig {
  from_email: string;
  provider: string;
  enabled: boolean;
  has_api_key: boolean;
  api_key_hint: string;
  updated_at: string | null;
}

export interface EmailGroup {
  id: string;
  name: string;
  active: boolean;
  events: EmailEventType[];
  recipients: string[];
  device_ids: string[];
  created_at: string;
  updated_at: string;
}

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/email-notifications`;
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

export async function fetchEmailConfig(): Promise<EmailConfig> {
  const res = await fetch(`${base()}/config`, { headers: authHeaders() });
  const json = await handle<{ data: EmailConfig }>(res);
  return json.data;
}

export async function updateEmailConfig(payload: {
  from_email: string;
  enabled: boolean;
  api_key?: string;
}): Promise<EmailConfig> {
  const res = await fetch(`${base()}/config`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: EmailConfig }>(res);
  return json.data;
}

export async function sendTestEmail(to: string): Promise<void> {
  const res = await fetch(`${base()}/test`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ to }),
  });
  await handle(res);
}

export async function fetchEmailGroups(): Promise<{ groups: EmailGroup[]; eventTypes: EmailEventType[] }> {
  const res = await fetch(`${base()}/groups`, { headers: authHeaders() });
  const json = await handle<{ data: EmailGroup[]; event_types: EmailEventType[] }>(res);
  return { groups: json.data, eventTypes: json.event_types };
}

export async function createEmailGroup(payload: {
  name: string;
  active: boolean;
  events: EmailEventType[];
  recipients: string[];
  device_ids: string[];
}): Promise<EmailGroup> {
  const res = await fetch(`${base()}/groups`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: EmailGroup }>(res);
  return json.data;
}

export async function updateEmailGroup(
  id: string,
  payload: {
    name: string;
    active: boolean;
    events: EmailEventType[];
    recipients: string[];
    device_ids: string[];
  }
): Promise<EmailGroup> {
  const res = await fetch(`${base()}/groups/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await handle<{ data: EmailGroup }>(res);
  return json.data;
}

export async function deleteEmailGroup(id: string): Promise<void> {
  const res = await fetch(`${base()}/groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle(res);
}

export function eventTypeLabel(t: (k: string) => string, event: EmailEventType): string {
  const map: Record<EmailEventType, string> = {
    manual_control: t('email_event_manual_control'),
    process_start: t('email_event_process_start'),
    tracking_start: t('email_event_tracking_start'),
    phase_complete: t('email_event_phase_complete'),
    tracking_complete: t('email_event_tracking_complete'),
    sampling: t('email_event_sampling'),
  };
  return map[event] || event;
}

export function linesToList(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
}

export function listToLines(items: string[]): string {
  return items.join('\n');
}
