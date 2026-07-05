import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/control-automation`;
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
    const o = body as { message?: string; error?: string } | null;
    throw new Error(o?.message || o?.error || res.statusText || `HTTP ${res.status}`);
  }
  return body as T;
}

export type ControlAutomationConfig = {
  ripening_co2_ventilation_220: boolean;
  updated_at: string | null;
};

export async function fetchControlAutomationConfig(): Promise<ControlAutomationConfig> {
  const res = await fetch(`${base()}/config`, { headers: authHeaders() });
  const json = await handle<{ data: ControlAutomationConfig }>(res);
  return json.data ?? { ripening_co2_ventilation_220: false, updated_at: null };
}

export async function updateControlAutomationConfig(body: {
  ripening_co2_ventilation_220: boolean;
}): Promise<ControlAutomationConfig> {
  const res = await fetch(`${base()}/config`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await handle<{ data: ControlAutomationConfig }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}
