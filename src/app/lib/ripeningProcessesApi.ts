import { RIPENER_API_URL } from '@/app/config';
import { authHeaders, clearAuth, getToken } from '@/app/lib/auth';
import { getThermoKingPinnedImei, isThermoKingSession, getGreenyardPinnedImeis, isGreenyardSession, getUltraorganicsAllImeis, isUltraorganicsSession } from '@/app/lib/fleetDemo';
import { getGourmetTradingFleetDeviceIds, isGourmetSession } from '@/app/lib/gourmet';
import {
  SIM_INKAPACKING_DEVICE_IDS,
  applySimulatedRipeningSampling,
  buildSimulatedRipeningProcessRow,
  isSimulatedRipeningProcessId,
  shouldShowSimulatedInkapackingFleet,
  simulatedDeviceIdFromRipeningProcessId,
} from '@/app/lib/simulatedInkapackingFleet';

function base() {
  return `${RIPENER_API_URL.replace(/\/$/, '')}/api/v1/ripening-processes`;
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

export type RipeningProcessRow = {
  id: string;
  user_id: string;
  /** Seguimiento: active | paused | cancelled | completed */
  status: string;
  display_name: string;
  payload: Record<string, unknown> & {
    client?: { name: string; type?: string };
    batch?: Record<string, unknown>;
    scheduleSummary?: {
      totalDurationHours?: number;
      startedAt?: string;
      estimatedEndAt?: string | null;
      plannedDurationMs?: number;
      totalPausedMs?: number;
    };
    pauseState?: { pausedAt?: string; progressAtPause?: number };
    pauseIntervals?: { from: string; to?: string; byUserId?: string | null }[];
    initialSample?: unknown;
    recipe?: { name?: string; phases?: unknown; targets?: { brix?: string; firmness?: string; color?: string } };
    objectives?: { name: string; value: string; unit: string }[];
    _cancelledMeta?: {
      at?: string;
      byUserId?: string;
      byEmail?: string | null;
      byName?: string | null;
    };
    _completedMeta?: { at?: string; progress?: number; source?: string };
    _reactivatedMeta?: {
      at?: string;
      byUserId?: string;
      byEmail?: string | null;
      byName?: string | null;
    };
    _closureSnapshot?: {
      at?: string;
      closureReason?: string;
      progress?: number;
      phaseIndex?: number;
      phaseType?: string;
      phaseLabel?: string;
      activeElapsedMs?: number;
    };
    reactivationHistory?: {
      at?: string;
      extensionHours?: number;
      closureAt?: string;
      phaseLabel?: string;
      progressAtClosure?: number;
      note?: string | null;
    }[];
    processDocuments?: RipeningProcessDocument[];
  };
  timeline: unknown;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type RipeningProcessDocument = {
  id: string;
  name: string;
  storedName: string;
  mime: string;
  size: number;
  apiPath: string;
  description?: string | null;
  observations?: string | null;
  uploadedAt: string;
  uploadedByUserId?: string | null;
  uploadedByEmail?: string | null;
  uploadedByName?: string | null;
};

export function apiFileUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${RIPENER_API_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Superadmin puede pasar includeArchived=true para listar también seguimientos archivados. */
export async function fetchRipeningProcesses(opts?: {
  includeArchived?: boolean;
}): Promise<RipeningProcessRow[]> {
  const q = opts?.includeArchived ? '?includeArchived=true' : '';
  const res = await fetch(`${base()}${q}`, { headers: authHeaders() });
  const json = await handle<{ data: RipeningProcessRow[] }>(res);
  let rows = json.data ?? [];
  if (isThermoKingSession()) {
    const imei = getThermoKingPinnedImei();
    rows = rows.filter((r) => String((r.payload as { deviceId?: string })?.deviceId ?? '').trim() === imei);
  }
  if (isGreenyardSession()) {
    const allow = new Set(getGreenyardPinnedImeis());
    rows = rows.filter((r) => allow.has(String((r.payload as { deviceId?: string })?.deviceId ?? '').trim()));
  }
  if (isUltraorganicsSession()) {
    const allow = new Set(getUltraorganicsAllImeis());
    rows = rows.filter((r) => allow.has(String((r.payload as { deviceId?: string })?.deviceId ?? '').trim()));
  }
  if (isGourmetSession()) {
    const allow = new Set(getGourmetTradingFleetDeviceIds());
    rows = rows.filter((r) => allow.has(String((r.payload as { deviceId?: string })?.deviceId ?? '').trim()));
  }
  if (shouldShowSimulatedInkapackingFleet()) {
    const seen = new Set(
      rows
        .map((r) => String((r.payload as { deviceId?: string })?.deviceId ?? '').trim())
        .filter(Boolean)
    );
    for (const id of SIM_INKAPACKING_DEVICE_IDS) {
      if (!seen.has(id)) {
        rows = [...rows, buildSimulatedRipeningProcessRow(id)];
      }
    }
  }
  return rows;
}

export async function fetchRipeningProcess(id: string): Promise<RipeningProcessRow> {
  if (isSimulatedRipeningProcessId(id)) {
    if (!shouldShowSimulatedInkapackingFleet()) throw new Error('sin datos');
    const did = simulatedDeviceIdFromRipeningProcessId(id);
    if (!did) throw new Error('sin datos');
    return buildSimulatedRipeningProcessRow(did);
  }
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, { headers: authHeaders() });
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export type ActiveDeviceSummary = {
  id: string;
  display_name: string;
  client: string;
  product: string;
  deviceId: string;
  progress: number;
  startedAt: string | null;
  estimatedEndAt: string | null;
  status?: string;
  paused?: boolean;
};

/**
 * Proceso activo del usuario vinculado a este dispositivo (mismo `deviceId` en el payload), si existe.
 */
export async function fetchActiveProcessForDevice(
  deviceId: string,
  signal?: AbortSignal
): Promise<{ process: RipeningProcessRow; summary: ActiveDeviceSummary } | null> {
  if (!deviceId) return null;
  const u = `${base()}/active-for-device?deviceId=${encodeURIComponent(deviceId)}`;
  const res = await fetch(u, { headers: authHeaders(), signal });
  const json = await handle<{
    data: { process: RipeningProcessRow; summary: ActiveDeviceSummary } | null;
  }>(res);
  return json.data ?? null;
}

export type CreateProcessPayload = Record<string, unknown>;

export async function createRipeningProcess(
  data: CreateProcessPayload,
  evidenceFiles: File[]
): Promise<RipeningProcessRow> {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  for (const f of evidenceFiles) {
    form.append('evidence', f, f.name);
  }
  const t = getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(base(), { method: 'POST', body: form, headers });
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export type SamplingPostBody = {
  samplingType: 'initial' | 'monitoring' | 'final';
  /** Quien ejecuta el muestreo (pantalla). Quien guarda en BD es el usuario de la sesión. */
  personaEscrita: string;
  parameters: { name: string; value: string; unit: string }[];
  notes?: string;
};

export async function postRipeningSampling(
  processId: string,
  body: SamplingPostBody,
  evidenceFiles: File[] = []
): Promise<RipeningProcessRow> {
  if (isSimulatedRipeningProcessId(processId)) {
    if (!shouldShowSimulatedInkapackingFleet()) throw new Error('No permitido');
    return applySimulatedRipeningSampling(processId, body, evidenceFiles);
  }
  const form = new FormData();
  form.append('data', JSON.stringify(body));
  for (const f of evidenceFiles) {
    form.append('evidence', f, f.name);
  }
  const t = getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${base()}/${encodeURIComponent(processId)}/sampling`, {
    method: 'POST',
    body: form,
    headers,
  });
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export async function patchRipeningProcess(
  id: string,
  body: Partial<Pick<RipeningProcessRow, 'status' | 'display_name'>> & { payload?: Record<string, unknown> }
): Promise<RipeningProcessRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export async function deleteRipeningProcess(id: string): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
  await handle<{ ok: boolean }>(res);
}

export async function pauseRipeningProcess(id: string): Promise<RipeningProcessRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/pause`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export async function resumeRipeningProcess(id: string): Promise<RipeningProcessRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export async function reactivateRipeningProcess(
  id: string,
  body: { extensionHours: number; note?: string }
): Promise<RipeningProcessRow> {
  const res = await fetch(`${base()}/${encodeURIComponent(id)}/reactivate`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export async function uploadRipeningProcessDocument(
  processId: string,
  file: File,
  description: string,
  observations?: string
): Promise<RipeningProcessRow> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('description', description.trim());
  const obs = observations?.trim();
  if (obs) form.append('observations', obs);
  const t = getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${base()}/${encodeURIComponent(processId)}/documents`, {
    method: 'POST',
    body: form,
    headers,
  });
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export async function deleteRipeningProcessDocument(
  processId: string,
  documentId: string
): Promise<RipeningProcessRow> {
  const res = await fetch(
    `${base()}/${encodeURIComponent(processId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE', headers: authHeaders() }
  );
  const json = await handle<{ data: RipeningProcessRow }>(res);
  if (!json.data) throw new Error('sin datos');
  return json.data;
}

export async function fetchRipeningFileBlob(absoluteOrRelativePath: string): Promise<Blob> {
  const url = apiFileUrl(absoluteOrRelativePath);
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) clearAuth();
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.blob();
}
