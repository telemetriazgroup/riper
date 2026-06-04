import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import type { EventKind, LogEvent } from '@/app/data/eventLog';
import { formatUiDecimal, formatUiPercent } from '@/app/lib/formatUiNumber';
import { GOURMET_TUNEL_DEVICE_ID } from '@/app/lib/tunelUnido';

/** Clave para ver detalle técnico del proceso (Gourmet). */
export const GOURMET_PROCESS_DEBUG_PASSWORD = 'lpmp2018';

export const TECHNICAL_PROCESS_PARAM_KEYS = new Set([
  'processAutomation',
  'tunnelEventLog',
  'tunnelSyncedAt',
  'tunnelOverallStatus',
  'tunnelJobs',
  'tunnelCommandBatchId',
  'tunnelLinkedAt',
  'source',
  'changes',
  'name',
  'tempUnit',
]);

export type ProcessEventRow = {
  at?: string | null;
  action?: string | null;
  source?: string | null;
  kind?: string | null;
  detail?: Record<string, unknown>;
  target?: unknown;
  results?: unknown;
  urls?: unknown;
  [key: string]: unknown;
};

export function isActivePanelProcess(session: DeviceControlSessionRow | null | undefined): boolean {
  return Boolean(
    session?.status === 'active' &&
      session.process_type &&
      session.process_type !== 'Manual' &&
      session.process_type !== 'StopPlan'
  );
}

export function filterUserFacingParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (TECHNICAL_PROCESS_PARAM_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export type ProgrammedField = { label: string; value: string };

function sessionParamsObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (Array.isArray(raw)) return { tunnelEventLog: raw };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      if (Array.isArray(parsed)) return { tunnelEventLog: parsed };
    } catch {
      /* ignore */
    }
  }
  return {};
}

function extractControlSnapshot(params: Record<string, unknown>): Record<string, unknown> | null {
  const log = Array.isArray(params.tunnelEventLog) ? params.tunnelEventLog : [];
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const ev = log[i] as Record<string, unknown> | undefined;
    if (ev?.action === 'process_started' && ev.controlSnapshot && typeof ev.controlSnapshot === 'object') {
      return ev.controlSnapshot as Record<string, unknown>;
    }
  }
  return null;
}

function parseProgrammedSummary(summary: unknown): Record<string, unknown> | null {
  const text = String(summary || '').trim();
  if (!text) return null;
  const out: Record<string, unknown> = {};
  const temp = text.match(/Temp\s+([\d.]+)\s*°C/i);
  if (temp) out.setPoint = Number(temp[1]);
  const rh = text.match(/HR\s+([\d.]+)\s*%/i);
  if (rh) out.humiditySetPoint = Math.round(Number(rh[1]));
  const eth = text.match(/Etileno\s+([\d.]+)\s*ppm/i);
  if (eth) out.ethylene = Math.round(Number(eth[1]));
  const co2 = text.match(/CO₂\s+([\d.]+)\s*%/i);
  if (co2) out.co2 = Number(co2[1]);
  const dur = text.match(/([\d.]+)\s*h\b/i);
  if (dur) out.durationHours = Number(dur[1]);
  return Object.keys(out).length > 0 ? out : null;
}

function repairFromProcessStartedLog(params: Record<string, unknown>): Record<string, unknown> | null {
  const log = Array.isArray(params.tunnelEventLog) ? params.tunnelEventLog : [];
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const ev = log[i] as Record<string, unknown> | undefined;
    if (ev?.action === 'process_started' && ev.programmedSummary) {
      return parseProgrammedSummary(ev.programmedSummary);
    }
  }
  return null;
}

/** Params efectivos para UI (top-level + controlProgram + snapshot del evento process_started). */
export function effectiveSessionParamsFromRow(session: DeviceControlSessionRow): Record<string, unknown> {
  const base = sessionParamsObject(session.params);
  const snapshot = extractControlSnapshot(base);
  const repaired = repairFromProcessStartedLog(base);
  const cp =
    base.controlProgram && typeof base.controlProgram === 'object' && !Array.isArray(base.controlProgram)
      ? (base.controlProgram as Record<string, unknown>)
      : {};
  const dur = Number(session.duration_hours);
  return {
    ...base,
    ...(repaired ?? {}),
    ...(snapshot ?? {}),
    controlProgram: { ...cp, ...(repaired ?? {}), ...(snapshot ?? {}) },
    ...(Number.isFinite(dur) && dur > 0 && base.durationHours == null ? { durationHours: dur } : {}),
  };
}

function paramNum(params: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const n = Number(params[key]);
    if (Number.isFinite(n)) return n;
  }
  const cp = params.controlProgram;
  if (cp && typeof cp === 'object' && !Array.isArray(cp)) {
    const o = cp as Record<string, unknown>;
    for (const key of keys) {
      const n = Number(o[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function programmedFieldsFromSession(
  session: DeviceControlSessionRow,
  t: (k: string, r?: Record<string, string>) => string,
  formatTemp: (c: number) => string
): ProgrammedField[] {
  const p = effectiveSessionParamsFromRow(session);
  const pt = session.process_type;
  const fields: ProgrammedField[] = [];

  const sp = paramNum(p, 'setPoint', 'set_point');
  if (sp != null) {
    fields.push({
      label: t('target_temperature'),
      value: formatTemp(sp),
    });
  }

  const rh = paramNum(p, 'humiditySetPoint', 'humidity_set_point');
  if (rh != null) {
    fields.push({
      label: t('relative_humidity'),
      value: formatUiPercent(rh),
    });
  }

  const eth = paramNum(p, 'ethylene', 'ethylene_injection_programmed');
  if (eth != null && eth >= 0 && pt === 'Ripening') {
    fields.push({
      label: t('ethylene_injection'),
      value: `${formatUiDecimal(eth)} ppm`,
    });
  }

  const co2 = paramNum(p, 'co2', 'co2_limit');
  if (co2 != null && pt === 'Ripening') {
    fields.push({
      label: t('co2_limit'),
      value: formatUiPercent(co2),
    });
  }

  const targetCo2 = paramNum(p, 'targetCo2', 'target_co2');
  if (targetCo2 != null && pt === 'Ventilation') {
    fields.push({
      label: t('target_co2'),
      value: formatUiPercent(targetCo2),
    });
  }

  const durH = paramNum(p, 'durationHours') ?? Number(session.duration_hours);
  if (Number.isFinite(durH) && durH > 0 && pt !== 'Ventilation') {
    fields.push({
      label: t('duration'),
      value: `${formatUiDecimal(durH)} ${t('unit_hours')}`,
    });
  }

  const durMin = paramNum(p, 'durationMin');
  if (durMin != null && pt === 'Ventilation') {
    fields.push({
      label: t('max_duration'),
      value: `${Math.round(durMin)} min`,
    });
  }

  return fields;
}

function fmtResults(results: unknown): string {
  if (!Array.isArray(results)) return '';
  return results
    .map((r) => {
      const row = r as { imei?: string; actual?: unknown; ok?: boolean; avl?: unknown };
      const ok = row.ok ? '✓' : '✗';
      if (row.avl != null) return `${ok} ${row.imei ?? '?'} AVL=${row.avl}`;
      return `${ok} ${row.imei ?? '?'}=${row.actual ?? '—'}`;
    })
    .join('; ');
}

function resultsAllOk(results: unknown): boolean {
  if (!Array.isArray(results) || results.length === 0) return false;
  return results.every((r) => (r as { ok?: boolean }).ok === true);
}

const TEMP_ACTIONS = new Set(['check_temperature', 'send_temperature', 'send', 'read', 'read_fanout', 'send_fanout']);
const HUM_ACTIONS = new Set(['check_humidity', 'send_humidity']);
const CO2_ACTIONS = new Set([
  'check_co2_setpoint',
  'send_co2_limit',
  'send_co2_ventilation',
  'co2_skip_after_max_attempts',
]);
const ETH_ACTIONS = new Set([
  'ethylene_tipo5_initial',
  'ethylene_tipo5_proportional',
  'ethylene_skip_dose',
  'ethylene_poll',
  'ethylene_read',
  'ethylene_read_ignored_zero',
  'send_ethylene',
  'send_tipo5',
  'send_tipo5_proportional',
  'poll_tipo0',
  'read_ethylene',
  'read_ethylene_poll',
  'retry_ethylene',
]);
const VENT_ACTIONS = new Set([
  'check_ventilation_avl',
  'send_ventilation',
  'ventilation_end_tipo3',
]);
const LIFECYCLE_ACTIONS = new Set([
  'process_started',
  'process_automation_started',
  'process_cancelled',
  'process_completed',
  'hourly_review_restart',
]);

export function eventKindFromProcessEvent(ev: ProcessEventRow): EventKind {
  const action = String(ev.action ?? '');
  const jobKind = String(ev.kind ?? '');
  const detail = (ev.detail ?? {}) as Record<string, unknown>;
  const tipo = Number(detail.tipo ?? ev.tipo);

  if (action === 'process_cancelled') return 'control_process_cancel';
  if (action === 'process_completed') return 'control_process_complete';
  if (LIFECYCLE_ACTIONS.has(action)) return 'control_process_start';

  if (jobKind === 'temperature' || (TEMP_ACTIONS.has(action) && (tipo === 1 || !Number.isFinite(tipo)))) {
    return 'control_temperature';
  }
  if (jobKind === 'humidity' || HUM_ACTIONS.has(action) || tipo === 2) return 'control_humidity';
  if (jobKind === 'ethylene' || ETH_ACTIONS.has(action)) return 'control_ethylene';
  if (jobKind === 'ventilation' || VENT_ACTIONS.has(action) || tipo === 6) return 'control_ventilation';
  if (CO2_ACTIONS.has(action) || tipo === 3) return 'control_co2';

  return 'control_general';
}

export type ProcessEventSummary = {
  description: string;
  reason?: string;
  kind: EventKind;
};

/** Resumen legible con motivo del ajuste automático o manual. */
export function summarizeProcessEventParts(
  ev: ProcessEventRow,
  t: (key: string, replacements?: Record<string, string>) => string
): ProcessEventSummary {
  const action = String(ev.action ?? '');
  const detail = (ev.detail ?? {}) as Record<string, unknown>;
  const target = String(ev.target ?? detail.target ?? detail.target_value ?? '—');
  const results = ev.results ?? detail.unitResults ?? detail.results ?? detail.checks;
  const urls = ev.urls ?? detail.urls;
  const resultsStr = fmtResults(results);
  const allOk = resultsAllOk(results);
  const kind = eventKindFromProcessEvent(ev);
  const source = String(ev.source ?? detail.source ?? '');
  const isAuto = source === 'process_automation';

  if (action === 'process_started') {
    return {
      kind,
      description: t('log_ctrl_process_started', {
        process: String(ev.processType ?? detail.processType ?? ev.displayLabel ?? '—'),
      }),
      reason: t('log_ctrl_reason_process_started', {
        by: String(ev.startedBy ?? detail.startedBy ?? '—'),
        values: String(ev.programmedSummary ?? detail.programmedSummary ?? '—'),
      }),
    };
  }
  if (action === 'process_automation_started') {
    return {
      kind,
      description: t('log_ctrl_automation_started', {
        process: String(ev.processType ?? detail.processType ?? '—'),
      }),
      reason: t('log_ctrl_reason_automation_started'),
    };
  }
  if (action === 'tracking_phase_change') {
    return {
      kind: 'control_process_start',
      description: t('log_ctrl_tracking_phase_change', {
        phase: String(ev.phaseLabel ?? detail.phaseLabel ?? '—'),
        process: String(ev.processType ?? detail.processType ?? '—'),
      }),
      reason: t('log_ctrl_reason_tracking_phase', {
        phaseType: String(ev.phaseType ?? detail.phaseType ?? '—'),
      }),
    };
  }
  if (action === 'process_cancelled') {
    const reasonKey = String(ev.reason ?? detail.reason ?? '');
    return {
      kind,
      description: t('log_ctrl_process_cancelled', {
        process: String(ev.processType ?? detail.processType ?? '—'),
      }),
      reason: t(
        reasonKey === 'replaced_by_new_session'
          ? 'log_ctrl_reason_cancel_replaced'
          : 'log_ctrl_reason_cancel_user',
        { by: String(ev.cancelledBy ?? detail.cancelledBy ?? '—') }
      ),
    };
  }
  if (action === 'process_completed') {
    return {
      kind,
      description: t('log_ctrl_process_completed', {
        process: String(ev.processType ?? detail.processType ?? '—'),
      }),
      reason: t('log_ctrl_reason_process_completed', {
        reason: String(ev.reason ?? detail.reason ?? '—'),
      }),
    };
  }
  if (action === 'hourly_review_restart') {
    return {
      kind,
      description: t('control_process_ev_hourly_review'),
      reason: t('log_ctrl_reason_hourly_review'),
    };
  }
  if (action === 'check_temperature' || (action === 'read_fanout' && kind === 'control_temperature')) {
    return {
      kind,
      description: t('log_ctrl_temp_check', { target }),
      reason: allOk
        ? t('log_ctrl_reason_temp_ok', { results: resultsStr })
        : t('log_ctrl_reason_temp_deviation', { target, results: resultsStr }),
    };
  }
  if (action === 'send_temperature' || (action === 'send_fanout' && Number(detail.tipo) === 1) || (action === 'send' && String(ev.kind) === 'temperature')) {
    const n = Array.isArray(urls) ? String(urls.length) : '1';
    return {
      kind,
      description: t('log_ctrl_temp_adjust', { target: String(detail.dato ?? target) }),
      reason: isAuto
        ? t('log_ctrl_reason_temp_auto_send', { target, results: resultsStr, count: n })
        : t('log_ctrl_reason_temp_manual_send', { target, count: n }),
    };
  }
  if (action === 'check_humidity') {
    return {
      kind,
      description: t('log_ctrl_humidity_check', { target }),
      reason: allOk
        ? t('log_ctrl_reason_humidity_ok', { results: resultsStr })
        : t('log_ctrl_reason_humidity_deviation', { target, results: resultsStr }),
    };
  }
  if (action === 'send_humidity' || (action === 'send_fanout' && Number(detail.tipo) === 2) || (action === 'send' && String(ev.kind) === 'humidity')) {
    return {
      kind,
      description: t('log_ctrl_humidity_adjust', { target }),
      reason: isAuto
        ? t('log_ctrl_reason_humidity_auto_send', { target, results: resultsStr })
        : t('log_ctrl_reason_humidity_manual_send', { target }),
    };
  }
  if (action === 'check_co2_setpoint') {
    const actual = String(ev.actual ?? detail.actual ?? '—');
    return {
      kind,
      description: t('log_ctrl_co2_check', { target, actual }),
      reason: t('log_ctrl_reason_co2_check', { target, actual }),
    };
  }
  if (action === 'send_co2_limit') {
    const dato = String(ev.dato ?? detail.dato ?? target);
    const attempt = ev.attempt != null ? String(ev.attempt) : '';
    const maxAttempts = ev.maxAttempts != null ? String(ev.maxAttempts) : '';
    return {
      kind,
      description:
        attempt && maxAttempts
          ? t('log_ctrl_co2_adjust_attempt', { dato, attempt, maxAttempts })
          : t('log_ctrl_co2_adjust', { dato }),
      reason: t('log_ctrl_reason_co2_limit_send', { dato, target }),
    };
  }
  if (action === 'co2_skip_after_max_attempts') {
    const actual = String(ev.actual ?? detail.actual ?? '—');
    const attempts = String(ev.attempts ?? detail.attempts ?? '3');
    return {
      kind,
      description: t('log_ctrl_co2_skip_max_attempts', { attempts, target, actual }),
      reason: t('log_ctrl_reason_co2_skip_max_attempts'),
    };
  }
  if (action === 'send_co2_ventilation') {
    return {
      kind: 'control_ventilation',
      description: t('log_ctrl_co2_ventilation'),
      reason: t('log_ctrl_reason_co2_high', {
        co2: String(ev.co2Reading ?? detail.co2Reading ?? '—'),
        avl: String(ev.avlRaw ?? detail.avlRaw ?? '—'),
      }),
    };
  }
  if (action === 'check_ventilation_avl') {
    return {
      kind,
      description: t('log_ctrl_ventilation_check'),
      reason: allOk
        ? t('log_ctrl_reason_ventilation_ok', { results: resultsStr })
        : t('log_ctrl_reason_ventilation_deviation', { results: resultsStr }),
    };
  }
  if (action === 'send_ventilation' || (action === 'send_fanout' && Number(detail.tipo) === 6)) {
    return {
      kind,
      description: t('log_ctrl_ventilation_adjust'),
      reason: t('log_ctrl_reason_ventilation_send'),
    };
  }
  if (action === 'ventilation_end_tipo3') {
    return {
      kind,
      description: t('control_process_ev_ventilation_end'),
      reason: t('log_ctrl_reason_ventilation_end'),
    };
  }
  if (action === 'ethylene_tipo5_initial' || action === 'send_tipo5') {
    const dato = String(ev.dato ?? detail.dato ?? 2);
    const baseline = String(ev.baseline ?? detail.baseline ?? '—');
    const ethTarget = String(ev.target ?? detail.target ?? '—');
    return {
      kind,
      description: t('log_ctrl_ethylene_inject', { dato }),
      reason: t('log_ctrl_reason_ethylene_initial', { baseline, target: ethTarget, dato }),
    };
  }
  if (action === 'ethylene_tipo5_proportional' || action === 'send_tipo5_proportional') {
    const dato = String(ev.dato ?? detail.dato ?? '—');
    const lastReading = String(ev.lastReading ?? detail.lastReading ?? '—');
    const ethTarget = String(ev.target ?? detail.target ?? '—');
    return {
      kind,
      description: t('log_ctrl_ethylene_inject', { dato }),
      reason: t('log_ctrl_reason_ethylene_proportional', {
        lastReading,
        target: ethTarget,
        dato,
      }),
    };
  }
  if (action === 'ethylene_skip_dose') {
    return {
      kind,
      description: t('log_ctrl_ethylene_skip'),
      reason: t('log_ctrl_reason_ethylene_at_target', {
        baseline: String(ev.baseline ?? detail.baseline ?? '—'),
        target: String(ev.target ?? detail.target ?? '—'),
      }),
    };
  }
  if (action === 'ethylene_poll' || action === 'poll_tipo0') {
    const isMonitor = ev.reason === 'steady_monitor' || detail.reason === 'steady_monitor';
    return {
      kind,
      description: t('log_ctrl_ethylene_poll'),
      reason: isMonitor
        ? t('log_ctrl_reason_ethylene_steady_monitor')
        : t('log_ctrl_reason_ethylene_poll'),
    };
  }
  if (action === 'ethylene_read_ignored_zero' || action === 'read_ethylene_ignored_zero') {
    const effective = String(ev.effective ?? detail.effective ?? '—');
    const raw = String(ev.value ?? detail.value ?? '0');
    const ethTarget = String(ev.target ?? detail.target ?? '—');
    return {
      kind,
      description: t('log_ctrl_ethylene_read_ignored_zero', { raw, effective }),
      reason: t('log_ctrl_reason_ethylene_read_ignored_zero', { raw, effective, target: ethTarget }),
    };
  }
  if (action === 'ethylene_read' || action === 'read_ethylene_poll' || action === 'read_ethylene') {
    const readings = Array.isArray(ev.readings ?? detail.readings)
      ? (ev.readings ?? detail.readings as unknown[]).join(', ')
      : '';
    const value = String(ev.value ?? detail.value ?? '—');
    const ethTarget = String(ev.target ?? detail.target ?? '—');
    const isMonitor = ev.reason === 'steady_monitor' || detail.reason === 'steady_monitor';
    return {
      kind,
      description: t('log_ctrl_ethylene_read', { value }),
      reason: isMonitor
        ? t('log_ctrl_reason_ethylene_steady_read', { value, target: ethTarget })
        : t('log_ctrl_reason_ethylene_read', { value, readings, target: ethTarget }),
    };
  }
  if (action === 'send_ethylene') {
    return {
      kind,
      description: t('log_ctrl_ethylene_inject', { dato: String(detail.dato ?? ev.dato ?? '—') }),
      reason: t('log_ctrl_reason_ethylene_manual'),
    };
  }
  if (action === 'completed') {
    return {
      kind,
      description: t('log_ctrl_command_completed'),
      reason: t('control_process_ev_completed', { reason: String(detail.reason ?? ev.reason ?? '') }),
    };
  }
  if (action === 'failed') {
    return {
      kind,
      description: t('log_ctrl_command_failed'),
      reason: t('control_process_ev_failed', {
        reason: String(detail.reason ?? detail.message ?? ''),
      }),
    };
  }
  if (action === 'error' || action === 'poll_error' || action === 'ethylene_poll_error') {
    return {
      kind,
      description: t('log_ctrl_command_error'),
      reason: t('control_process_ev_error', { message: String(detail.message ?? ev.message ?? '') }),
    };
  }

  return {
    kind,
    description: action || '—',
    reason: resultsStr ? t('log_ctrl_reason_generic_data', { data: resultsStr }) : undefined,
  };
}

/** Resumen legible de un evento (manual túnel o automatización de proceso). */
export function summarizeProcessEvent(ev: ProcessEventRow): string {
  const parts = summarizeProcessEventParts(ev, (k) => k);
  return parts.reason ? `${parts.description} — ${parts.reason}` : parts.description;
}

export function summarizeProcessEventI18n(
  ev: ProcessEventRow,
  t: (key: string, replacements?: Record<string, string>) => string
): string {
  const parts = summarizeProcessEventParts(ev, t);
  return parts.reason ? `${parts.description} — ${parts.reason}` : parts.description;
}

function sessionHasAction(events: ProcessEventRow[], action: string): boolean {
  return events.some((e) => String(e.action ?? '') === action);
}

function lifecycleEntriesForSession(
  session: DeviceControlSessionRow,
  t: (key: string, replacements?: Record<string, string>) => string,
  formatTemp: (c: number) => string
): LogEvent[] {
  const events = processEventLogFromParams(session.params ?? {});
  const programmed = sessionSummaryLine(session, t, formatTemp);
  const processLabel = session.display_label || session.process_type;
  const out: LogEvent[] = [];

  if (
    session.started_at &&
    !sessionHasAction(events, 'process_started') &&
    !sessionHasAction(events, 'process_automation_started')
  ) {
    const synthetic: ProcessEventRow = {
      action: 'process_started',
      processType: session.process_type,
      displayLabel: processLabel,
      startedBy: session.user_name ?? session.user_email ?? '—',
      programmedSummary: programmed,
    };
    const parts = summarizeProcessEventParts(synthetic, t);
    out.push({
      id: `lifecycle-start-${session.id}`,
      type: 'event',
      timestamp: session.started_at,
      kind: parts.kind,
      description: parts.description,
      detail: parts.reason,
      phase: processLabel,
    });
  }

  if (session.status === 'cancelled' && session.cancelled_at && !sessionHasAction(events, 'process_cancelled')) {
    const synthetic: ProcessEventRow = {
      action: 'process_cancelled',
      processType: session.process_type,
      cancelledBy: session.cancelled_by_name ?? session.cancelled_by_email ?? '—',
      reason: 'user_cancelled',
    };
    const parts = summarizeProcessEventParts(synthetic, t);
    out.push({
      id: `lifecycle-cancel-${session.id}`,
      type: 'event',
      timestamp: session.cancelled_at,
      kind: parts.kind,
      description: parts.description,
      detail: parts.reason,
      phase: processLabel,
    });
  }

  if (session.status === 'completed' && !sessionHasAction(events, 'process_completed')) {
    const ts = session.estimated_end_at || session.updated_at;
    if (ts) {
      const synthetic: ProcessEventRow = {
        action: 'process_completed',
        processType: session.process_type,
        reason: 'scheduled_end',
      };
      const parts = summarizeProcessEventParts(synthetic, t);
      out.push({
        id: `lifecycle-complete-${session.id}`,
        type: 'event',
        timestamp: ts,
        kind: parts.kind,
        description: parts.description,
        detail: parts.reason,
        phase: processLabel,
      });
    }
  }

  return out;
}

export function processActionLogEntriesForDevice(
  deviceId: string,
  sessions: DeviceControlSessionRow[],
  t: (key: string, replacements?: Record<string, string>) => string,
  formatTemp: (c: number) => string = (c) => String(c)
): LogEvent[] {
  const id = String(deviceId).trim();
  const entries: LogEvent[] = [];

  for (const session of sessions) {
    if (String(session.device_id).trim() !== id) continue;
    const events = processEventLogFromParams(session.params ?? {});
    const processLabel = session.display_label || session.process_type;

    entries.push(...lifecycleEntriesForSession(session, t, formatTemp));

    events.forEach((ev, i) => {
      if (!ev.at) return;
      const parts = summarizeProcessEventParts(ev, t);
      entries.push({
        id: `proc-${session.id}-${i}-${String(ev.key ?? i)}`,
        type: 'event',
        timestamp: ev.at,
        kind: parts.kind,
        description: parts.description,
        detail: parts.reason ?? processLabel,
        phase: processLabel,
      });
    });
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/** Eventos de control desde seguimiento activo (payload.tunnelEventLog). */
export function processActionLogEntriesFromTracking(
  deviceId: string,
  tracking: { id: string; payload?: Record<string, unknown>; display_label?: string; display_name?: string } | null | undefined,
  t: (key: string, replacements?: Record<string, string>) => string,
  formatTemp: (c: number) => string = (c) => String(c)
): LogEvent[] {
  if (!tracking?.payload) return [];
  const payloadDevice = String(tracking.payload.deviceId ?? '').trim();
  if (payloadDevice !== String(deviceId).trim()) return [];

  const events = processEventLogFromParams(tracking.payload);
  const label =
    String(tracking.display_label ?? tracking.display_name ?? tracking.payload.trackingControl?.phaseLabel ?? 'Seguimiento');

  return events
    .filter((ev) => ev.at)
    .map((ev, i) => {
      const parts = summarizeProcessEventParts(ev, t);
      return {
        id: `track-${tracking.id}-${i}`,
        type: 'event' as const,
        timestamp: ev.at!,
        kind: parts.kind,
        description: parts.description,
        detail: parts.reason ?? label,
        phase: label,
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function processEventLogFromParams(params: Record<string, unknown>): ProcessEventRow[] {
  const p = params?.process_type != null ? params : sessionParamsObject(params);
  const raw = p.tunnelEventLog ?? (Array.isArray(params) ? params : undefined);
  if (!Array.isArray(raw)) return [];
  return raw as ProcessEventRow[];
}

export function sessionSummaryLine(
  session: DeviceControlSessionRow,
  t: (k: string) => string,
  formatTemp: (c: number) => string
): string {
  const fields = programmedFieldsFromSession(session, t, formatTemp);
  if (fields.length === 0) return session.display_label || session.process_type;
  return fields.map((f) => `${f.label}: ${f.value}`).join(' · ');
}

const AUTOMATED_TYPES = new Set(['Homogenization', 'Ripening', 'Ventilation', 'Cooling']);

export function isAutomatedControlProcess(session: DeviceControlSessionRow | null | undefined): boolean {
  return Boolean(
    session?.status === 'active' &&
      session.process_type &&
      AUTOMATED_TYPES.has(session.process_type)
  );
}

export function isGourmetTunnelAggregateDeviceId(deviceId?: string | null): boolean {
  return String(deviceId || '').trim() === GOURMET_TUNEL_DEVICE_ID;
}

export function processAutomationPhaseLabel(
  auto: Record<string, unknown> | null | undefined,
  t: (k: string) => string,
  deviceId?: string | null
): string | null {
  if (!auto) return null;
  const phase = String(auto.phase ?? '');
  const mode = String(auto.mode ?? '');
  const tunnel = isGourmetTunnelAggregateDeviceId(deviceId);

  const phaseTunnelOrUnit: Record<string, [string, string]> = {
    temperature: ['control_auto_phase_temperature', 'control_auto_phase_temperature_unit'],
    humidity: ['control_auto_phase_humidity', 'control_auto_phase_humidity_unit'],
    co2: ['control_auto_phase_co2', 'control_auto_phase_co2_unit'],
    ethylene: ['control_auto_phase_ethylene', 'control_auto_phase_ethylene_unit'],
  };

  if (phaseTunnelOrUnit[phase]) {
    const [tunnelKey, unitKey] = phaseTunnelOrUnit[phase];
    return t(tunnel ? tunnelKey : unitKey);
  }

  const map: Record<string, string> = {
    ventilation: 'control_auto_phase_ventilation',
    maintenance: 'control_auto_phase_maintenance',
    steady: 'control_auto_phase_steady',
    cooling: 'control_auto_phase_cooling',
    sequential: 'control_auto_phase_sequential',
  };
  const key = map[phase] || map[mode];
  return key ? t(key) : null;
}

export function lastProcessEventSummary(
  params: Record<string, unknown> | undefined,
  t: (key: string, replacements?: Record<string, string>) => string
): string | null {
  const log = processEventLogFromParams(params ?? {});
  if (!log.length) return null;
  const last = log[log.length - 1];
  if (!last) return null;
  const parts = summarizeProcessEventParts(last, t);
  return parts.reason ? `${parts.description} — ${parts.reason}` : parts.description;
}
