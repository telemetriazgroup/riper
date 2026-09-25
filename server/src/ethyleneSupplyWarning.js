/**
 * Aviso de suministro de etileno (servidor):
 * inyecciones > 2 h y dosis lógicas sumadas > 200, sin subida útil del nivel.
 * Espejo de src/app/lib/ethyleneSupplyWarning.ts
 */

export const ETHYLENE_SUPPLY_WARN_MIN_MS = 2 * 60 * 60 * 1000;
export const ETHYLENE_SUPPLY_WARN_MIN_DOSE_SUM = 200;
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

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function eventAtMs(ev) {
  const at = ev?.at ?? ev?.detail?.at;
  if (!at) return null;
  const t = new Date(String(at)).getTime();
  return Number.isFinite(t) ? t : null;
}

function doseLogicalOf(ev) {
  const detail = ev?.detail && typeof ev.detail === 'object' ? ev.detail : {};
  return (
    num(ev?.doseLogical) ??
    num(detail.doseLogical) ??
    num(ev?.dato) ??
    num(detail.dato) ??
    num(ev?.ppm) ??
    null
  );
}

function effectiveOf(ev) {
  const detail = ev?.detail && typeof ev.detail === 'object' ? ev.detail : {};
  return (
    num(ev?.effective) ??
    num(detail.effective) ??
    num(ev?.lastReading) ??
    num(detail.lastReading) ??
    num(ev?.baseline) ??
    num(detail.baseline) ??
    num(ev?.value) ??
    num(detail.value) ??
    null
  );
}

function processEventLogFromParams(params) {
  if (!params || typeof params !== 'object') return [];
  const log = params.tunnelEventLog;
  if (!Array.isArray(log)) return [];
  return log.filter((e) => e && typeof e === 'object');
}

/**
 * @returns {{ warn: boolean, firstInjectionAt: string|null, durationMs: number, sumDoseLogical: number, injectionCount: number, firstEffective: number|null, lastEffective: number|null, risePpm: number|null }}
 */
export function evaluateEthyleneSupplyWarning(params, nowMs = Date.now()) {
  const empty = {
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
    .filter((x) => x.atMs != null && x.dose != null && x.dose > 0)
    .sort((a, b) => a.atMs - b.atMs);

  if (injections.length === 0) return empty;

  const firstAtMs = injections[0].atMs;
  const firstInjectionAt = new Date(firstAtMs).toISOString();
  const durationMs = Math.max(0, nowMs - firstAtMs);
  const sumDoseLogical = injections.reduce((acc, x) => acc + Number(x.dose), 0);
  const injectionCount = injections.length;

  const readings = log
    .filter((ev) => READING_ACTIONS.has(String(ev.action ?? '')))
    .map((ev) => ({ atMs: eventAtMs(ev), ppm: effectiveOf(ev) }))
    .filter((x) => x.atMs != null && x.ppm != null && x.ppm > 0)
    .sort((a, b) => a.atMs - b.atMs);

  const afterFirst = readings.filter((r) => r.atMs >= firstAtMs);
  const firstEffective = afterFirst.length ? afterFirst[0].ppm : null;
  const lastEffective = afterFirst.length ? afterFirst[afterFirst.length - 1].ppm : null;
  const risePpm =
    firstEffective != null && lastEffective != null
      ? Number((lastEffective - firstEffective).toFixed(1))
      : null;

  const durationOk = durationMs >= ETHYLENE_SUPPLY_WARN_MIN_MS;
  const doseOk = sumDoseLogical > ETHYLENE_SUPPLY_WARN_MIN_DOSE_SUM;
  const notRising =
    risePpm == null ? doseOk && durationOk : risePpm < ETHYLENE_SUPPLY_WARN_MIN_RISE_PPM;

  const stuckSignals = log.some((ev) => {
    const action = String(ev.action ?? '');
    const reason = String(ev.reason ?? ev.detail?.reason ?? '');
    const doseReason = String(ev.doseReason ?? ev.detail?.doseReason ?? '');
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
