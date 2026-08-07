/**
 * Aviso de suministro de etileno en Maduración:
 * inyecciones > 2 h y dosis lógicas sumadas > 200, sin subida útil del nivel.
 */
import type { ProcessEventRow } from '@/app/lib/controlProcessDisplay';
import { processEventLogFromParams } from '@/app/lib/controlProcessDisplay';

export const ETHYLENE_SUPPLY_WARN_MIN_MS = 2 * 60 * 60 * 1000;
export const ETHYLENE_SUPPLY_WARN_MIN_DOSE_SUM = 200;
/** Subida mínima de ppm para considerar que el gas sí está entrando. */
export const ETHYLENE_SUPPLY_WARN_MIN_RISE_PPM = 10;

const INJECTION_ACTIONS = new Set([
  'ethylene_tipo5_initial',
  'ethylene_tipo5_proportional',
  'ethylene_tipo5_fallback',
  'send_tipo5',
  'send_tipo5_proportional',
  'retry_ethylene',
  'send_ethylene',
]);

const READING_ACTIONS = new Set([
  'ethylene_read',
  'ethylene_read_ignored_zero',
  'read_ethylene',
  'read_ethylene_poll',
  'ethylene_tipo5_initial',
  'ethylene_tipo5_proportional',
  'ethylene_tipo5_fallback',
  'send_tipo5',
  'send_tipo5_proportional',
  'ethylene_skip_dose',
]);

export type EthyleneSupplyWarningResult = {
  warn: boolean;
  firstInjectionAt: string | null;
  durationMs: number;
  sumDoseLogical: number;
  injectionCount: number;
  firstEffective: number | null;
  lastEffective: number | null;
  risePpm: number | null;
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function eventAtMs(ev: ProcessEventRow): number | null {
  const at = ev.at ?? (ev.detail as { at?: string } | undefined)?.at;
  if (!at) return null;
  const t = new Date(String(at)).getTime();
  return Number.isFinite(t) ? t : null;
}

function doseLogicalOf(ev: ProcessEventRow): number | null {
  const detail = (ev.detail ?? {}) as Record<string, unknown>;
  return (
    num(ev.doseLogical) ??
    num(detail.doseLogical) ??
    num(ev.dato) ??
    num(detail.dato) ??
    num(ev.ppm) ??
    null
  );
}

function effectiveOf(ev: ProcessEventRow): number | null {
  const detail = (ev.detail ?? {}) as Record<string, unknown>;
  return (
    num(ev.effective) ??
    num(detail.effective) ??
    num(ev.lastReading) ??
    num(detail.lastReading) ??
    num(ev.baseline) ??
    num(detail.baseline) ??
    num(ev.value) ??
    num(detail.value) ??
    null
  );
}

export function evaluateEthyleneSupplyWarning(
  params: Record<string, unknown> | null | undefined,
  nowMs: number = Date.now()
): EthyleneSupplyWarningResult {
  const empty: EthyleneSupplyWarningResult = {
    warn: false,
    firstInjectionAt: null,
    durationMs: 0,
    sumDoseLogical: 0,
    injectionCount: 0,
    firstEffective: null,
    lastEffective: null,
    risePpm: null,
  };
  if (!params) return empty;

  const log = processEventLogFromParams(params);
  const injections = log
    .filter((ev) => INJECTION_ACTIONS.has(String(ev.action ?? '')))
    .map((ev) => ({ ev, atMs: eventAtMs(ev), dose: doseLogicalOf(ev) }))
    .filter((x) => x.atMs != null && x.dose != null && (x.dose as number) > 0)
    .sort((a, b) => (a.atMs as number) - (b.atMs as number));

  if (injections.length === 0) return empty;

  const firstAtMs = injections[0].atMs as number;
  const firstInjectionAt = new Date(firstAtMs).toISOString();
  const durationMs = Math.max(0, nowMs - firstAtMs);
  const sumDoseLogical = injections.reduce((acc, x) => acc + Number(x.dose), 0);
  const injectionCount = injections.length;

  const readings = log
    .filter((ev) => READING_ACTIONS.has(String(ev.action ?? '')))
    .map((ev) => ({ atMs: eventAtMs(ev), ppm: effectiveOf(ev) }))
    .filter((x) => x.atMs != null && x.ppm != null && (x.ppm as number) > 0)
    .sort((a, b) => (a.atMs as number) - (b.atMs as number));

  const afterFirst = readings.filter((r) => (r.atMs as number) >= firstAtMs);
  const firstEffective = afterFirst.length ? (afterFirst[0].ppm as number) : null;
  const lastEffective = afterFirst.length
    ? (afterFirst[afterFirst.length - 1].ppm as number)
    : null;
  const risePpm =
    firstEffective != null && lastEffective != null
      ? Number((lastEffective - firstEffective).toFixed(1))
      : null;

  const durationOk = durationMs >= ETHYLENE_SUPPLY_WARN_MIN_MS;
  const doseOk = sumDoseLogical > ETHYLENE_SUPPLY_WARN_MIN_DOSE_SUM;
  // Sin subida útil (o sin lecturas válidas tras inyecciones prolongadas).
  const notRising =
    risePpm == null ? doseOk && durationOk : risePpm < ETHYLENE_SUPPLY_WARN_MIN_RISE_PPM;

  // Señales de control: fallback / await sin avance.
  const stuckSignals = log.some((ev) => {
    const action = String(ev.action ?? '');
    const reason = String(ev.reason ?? (ev.detail as { reason?: string } | undefined)?.reason ?? '');
    const doseReason = String(
      ev.doseReason ?? (ev.detail as { doseReason?: string } | undefined)?.doseReason ?? ''
    );
    return (
      action === 'ethylene_tipo5_fallback' ||
      reason === 'await_increment' ||
      doseReason === 'fallback_no_increment'
    );
  });

  const warn = durationOk && doseOk && (notRising || stuckSignals);

  return {
    warn,
    firstInjectionAt,
    durationMs,
    sumDoseLogical: Number(sumDoseLogical.toFixed(1)),
    injectionCount,
    firstEffective,
    lastEffective,
    risePpm,
  };
}

export function ethyleneSupplyWarnStorageKey(deviceId: string, firstInjectionAt: string): string {
  return `riper.ethyleneSupplyWarn.ack.${deviceId}.${firstInjectionAt}`;
}

export function wasEthyleneSupplyWarnAcked(deviceId: string, firstInjectionAt: string): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(ethyleneSupplyWarnStorageKey(deviceId, firstInjectionAt)) === '1';
  } catch {
    return false;
  }
}

export function ackEthyleneSupplyWarn(deviceId: string, firstInjectionAt: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(ethyleneSupplyWarnStorageKey(deviceId, firstInjectionAt), '1');
  } catch {
    /* private mode */
  }
}
