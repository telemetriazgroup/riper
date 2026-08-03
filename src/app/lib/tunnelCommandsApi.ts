import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/tunnel-commands`;
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
    const msg = o?.message || o?.error || res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return body as T;
}

export type TunnelCommandKind = 'temperature' | 'humidity' | 'ethylene' | 'ventilation';

export type TunnelCommandStatus =
  | 'pending'
  | 'sent'
  | 'verifying'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TunnelCommandJob = {
  id: string;
  user_id: string;
  device_id: string;
  batch_id: string;
  kind: TunnelCommandKind;
  target_value: string | number;
  status: TunnelCommandStatus;
  tunnel_tipo: number;
  verify_field: string;
  tolerance: string | number;
  attempts: number;
  max_attempts: number;
  next_check_at: string | null;
  last_read_value: string | number | null;
  last_error: string | null;
  steps: Array<Record<string, unknown>>;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ApplyTunnelManualBody = {
  deviceId: string;
  /** Rango extendido manual (−40…5 °C). Requerido si set_point &lt; 5. */
  extendedManualTempRange?: boolean;
  commands: {
    set_point?: number;
    humidity_set_point?: number;
    ethylene?: number;
    fan_speed?: number;
  };
};

export async function applyTunnelManualCommands(
  body: ApplyTunnelManualBody
): Promise<{ batchId: string; jobs: TunnelCommandJob[] }> {
  const res = await fetch(`${base()}/apply-manual`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function fetchTunnelCommandJobs(
  params: { deviceId?: string; batchId?: string; active?: boolean; limit?: number },
  signal?: AbortSignal
): Promise<TunnelCommandJob[]> {
  const q = new URLSearchParams();
  if (params.deviceId) q.set('deviceId', params.deviceId);
  if (params.batchId) q.set('batchId', params.batchId);
  if (params.active) q.set('active', '1');
  if (params.limit) q.set('limit', String(params.limit));
  const res = await fetch(`${base()}?${q.toString()}`, { headers: authHeaders(), signal });
  const json = await handle<{ data: TunnelCommandJob[] }>(res);
  return json.data ?? [];
}

type TranslateFn = {
  (key: string): string;
  (key: string, fallback: string): string;
};

export function tunnelCommandKindLabel(kind: TunnelCommandKind, t: (k: string) => string): string {
  switch (kind) {
    case 'temperature':
      return t('target_temperature');
    case 'humidity':
      return t('relative_humidity');
    case 'ethylene':
      return 'Etileno';
    case 'ventilation':
      return t('ventilation_speed');
    default:
      return kind;
  }
}

/** Etiquetas de estado en lenguaje de usuario (nunca claves técnicas). */
export function tunnelCommandStatusLabel(
  status: string | null | undefined,
  t: TranslateFn
): string {
  switch (String(status || '').trim()) {
    case 'pending':
      return t('tunnel_cmd_pending', 'Pendiente');
    case 'sent':
      return t('tunnel_cmd_sent', 'Enviado');
    case 'verifying':
      return t('tunnel_cmd_verifying', 'Verificando');
    case 'waiting':
      return t('tunnel_cmd_waiting', 'Esperando lectura');
    case 'completed':
      return t('tunnel_cmd_completed', 'Completado');
    case 'failed':
      return t('tunnel_cmd_failed', 'Fallido');
    case 'cancelled':
      return t('tunnel_cmd_cancelled', 'Cancelado');
    case 'in_progress':
      return t('tunnel_cmd_in_progress', 'En curso');
    default:
      return t('tunnel_cmd_verifying', 'Verificando');
  }
}

export function tunnelCommandStatusTone(
  status: TunnelCommandStatus | string
): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'waiting' || status === 'verifying' || status === 'in_progress') return 'warning';
  return 'default';
}
