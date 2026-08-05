import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth } from '@/app/lib/auth';
import { getUltraorganicsAllImeis, isUltraorganicsSession } from '@/app/lib/fleetDemo';
import {
  cancelSimulatedControlSession,
  completeSimulatedControlSession,
  fetchSimulatedActiveControlSession,
  isSimulatedControlSessionId,
  isSimulatedInkapackingDevice,
  listSimulatedControlSessions,
  shouldShowSimulatedInkapackingFleet,
  startSimulatedControlProcess,
} from '@/app/lib/simulatedInkapackingFleet';
import { revalidateSimDemoFleetViews } from '@/app/lib/simDemoFleetRevalidation';

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/device-control`;
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

export type ControlProcessType =
  | 'Homogenization'
  | 'Ripening'
  | 'Ventilation'
  | 'Cooling'
  | 'StopPlan'
  | 'Manual';

export type DeviceControlSessionRow = {
  id: string;
  user_id: string;
  device_id: string;
  process_type: string;
  display_label: string;
  params: Record<string, unknown>;
  status: 'active' | 'cancelled' | 'completed';
  started_at: string;
  estimated_end_at: string;
  duration_hours: string | number;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  cancelled_at?: string | null;
  cancelled_by_user_id?: string | null;
  cancelled_by_name?: string | null;
  cancelled_by_email?: string | null;
  archived_at?: string | null;
};

export function controlSessionProgressPct(session: DeviceControlSessionRow | null | undefined): number {
  if (!session) return 0;

  /** Manual con jobs de cumplimiento: progreso por comandos terminados. */
  if (session.process_type === 'Manual') {
    const jobs = session.params?.tunnelJobs;
    if (Array.isArray(jobs) && jobs.length > 0) {
      const terminal = jobs.filter((j) => {
        const st = String((j as { status?: string })?.status || '');
        return st === 'completed' || st === 'failed' || st === 'cancelled';
      }).length;
      return Math.round((1000 * terminal) / jobs.length) / 10;
    }
    if (session.status !== 'active') return 100;
  }

  if (session.status !== 'active') return 0;
  const t0 = new Date(session.started_at).getTime();
  const t1 = new Date(session.estimated_end_at).getTime();
  const now = Date.now();
  if (t1 <= t0) return 100;
  if (now <= t0) return 0;
  if (now >= t1) return 100;
  return Math.round((1000 * (now - t0)) / (t1 - t0)) / 10;
}

export async function fetchActiveControlSession(
  deviceId: string,
  signal?: AbortSignal
): Promise<DeviceControlSessionRow | null> {
  if (!deviceId) return null;
  if (isSimulatedInkapackingDevice(deviceId) && shouldShowSimulatedInkapackingFleet()) {
    return fetchSimulatedActiveControlSession(deviceId) as DeviceControlSessionRow | null;
  }
  const u = `${base()}/active?deviceId=${encodeURIComponent(deviceId)}`;
  const res = await fetch(u, { headers: authHeaders(), signal });
  const json = await handle<{ data: DeviceControlSessionRow | null }>(res);
  return json.data ?? null;
}

export type StartControlProcessBody = {
  deviceId: string;
  processType: ControlProcessType;
  displayLabel: string;
  params: Record<string, unknown>;
  durationHours: number;
  startedAt?: string;
  /** Ajuste manual instantáneo: registro completado sin cancelar procesos activos. */
  auditLog?: boolean;
};

export async function startControlProcess(body: StartControlProcessBody): Promise<DeviceControlSessionRow> {
  if (isSimulatedInkapackingDevice(body.deviceId) && shouldShowSimulatedInkapackingFleet()) {
    const row = startSimulatedControlProcess(body) as DeviceControlSessionRow;
    revalidateSimDemoFleetViews(body.deviceId);
    return row;
  }
  const res = await fetch(`${base()}/start`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await handle<{ data: DeviceControlSessionRow }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function cancelControlProcess(id: string): Promise<DeviceControlSessionRow> {
  if (isSimulatedControlSessionId(id)) {
    if (!shouldShowSimulatedInkapackingFleet()) throw new Error('No permitido');
    const row = cancelSimulatedControlSession(id) as DeviceControlSessionRow;
    revalidateSimDemoFleetViews(row.device_id);
    return row;
  }
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await handle<{ data: DeviceControlSessionRow }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function completeControlProcess(id: string): Promise<DeviceControlSessionRow> {
  if (isSimulatedControlSessionId(id)) {
    if (!shouldShowSimulatedInkapackingFleet()) throw new Error('No permitido');
    const row = completeSimulatedControlSession(id) as DeviceControlSessionRow;
    revalidateSimDemoFleetViews(row.device_id);
    return row;
  }
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await handle<{ data: DeviceControlSessionRow }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function listControlSessions(opts?: { includeArchived?: boolean }): Promise<DeviceControlSessionRow[]> {
  const u = new URL(`${base()}/sessions`);
  if (opts?.includeArchived) u.searchParams.set('includeArchived', '1');
  const res = await fetch(u.toString(), { headers: authHeaders() });
  const json = await handle<{ data: DeviceControlSessionRow[] }>(res);
  let rows = (json.data ?? []).map((r) => ({
    ...r,
    archived_at: r.archived_at ?? null,
  }));
  if (isUltraorganicsSession()) {
    const allow = new Set(getUltraorganicsAllImeis());
    rows = rows.filter((r) => allow.has(String(r.device_id ?? '').trim()));
  }
  if (shouldShowSimulatedInkapackingFleet()) {
    rows = rows.filter((r) => !isSimulatedInkapackingDevice(String(r.device_id ?? '').trim()));
    rows = [...rows, ...listSimulatedControlSessions()];
  }
  return rows;
}

export const CONTROL_SESSIONS_LIST_SWR_KEY = 'device-control-sessions';

export type UpdateControlSessionBody = {
  displayLabel?: string;
  params?: Record<string, unknown>;
  durationHours?: number;
};

export async function updateControlSession(
  id: string,
  body: UpdateControlSessionBody
): Promise<DeviceControlSessionRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await handle<{ data: DeviceControlSessionRow }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

/** Archiva el registro en listado (no borrado físico) */
export async function deleteControlSessionRecord(id: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handle<{ data: { archived?: boolean; id: string } }>(res);
}

/** Superadmin: pausa/reanuda lógica Cooling (contador del proceso sigue). */
export async function setCoolingIntervention(
  sessionId: string,
  active: boolean
): Promise<DeviceControlSessionRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(sessionId)}/intervention`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ active }),
  });
  const json = await handle<{ data: DeviceControlSessionRow }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

/** Superadmin: comando en intervención — tipo 1 set_point, 8 defrost, 11 controlling_mode. */
export async function sendCoolingInterventionCommand(
  sessionId: string,
  body: { tipo: 1 | 8 | 11; dato: number }
): Promise<DeviceControlSessionRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(sessionId)}/intervention/command`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await handle<{ data: DeviceControlSessionRow }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}

export async function restoreControlSession(id: string): Promise<DeviceControlSessionRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  const json = await handle<{ data: DeviceControlSessionRow }>(res);
  if (!json.data) throw new Error('sin respuesta');
  return json.data;
}
