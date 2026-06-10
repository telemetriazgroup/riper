/**
 * Control automático de procesos Gourmet (Homogenización, Maduración, Ventilación, Enfriamiento).
 * Secuencia: temperatura → humedad → CO₂ → etileno (según proceso).
 * Comandos vía API Tunel; historial en params de la sesión de control.
 */
import { pool } from './db.js';
import { fetchDeviceRowByImei, readTelemetryField } from './tunnelCommandTelemetry.js';
import {
  ETHYLENE_POLL_INTERVAL_MS,
  ETHYLENE_READINGS_NEEDED,
} from './tunnelCommandCompliance.js';
import {
  applyEthyleneReadingToMeta,
  clampEthyleneDose,
  computeProportionalEthyleneDose,
  ETHYLENE_MAX_READING,
  ETHYLENE_RECENT_DOSE_MS,
  recordEthyleneDose,
  resolveEthyleneReading,
} from './ethyleneReading.js';
import { appendTunnelEventLog } from './tunnelEventLog.js';
import { controlParamNumber, normalizeControlProcessParams, parseSessionParams, effectiveSessionParams } from './controlProcessParams.js';
import { isAutomatedControlDeviceId, resolveProcessControlAdapter } from './processControlAdapter.js';
import { gourmetTradingEmpresaIdentificador } from './gourmetFleet.js';

export const GOURMET_PROCESS_POLL_MS = 30 * 1000;

export const TEMP_VERIFY_MS = 2 * 60 * 1000;
export const HUMIDITY_VERIFY_MS = 2 * 60 * 1000;
export const CO2_VERIFY_MS = 4 * 60 * 1000;
/** Intentos máximos por fase secuencial antes de avanzar al siguiente control. */
export const TEMP_MAX_ADJUST_ATTEMPTS = 3;
export const HUMIDITY_MAX_ADJUST_ATTEMPTS = 3;
export const CO2_MAX_ADJUST_ATTEMPTS = 3;
export const CO2_MAINTENANCE_MS = 30 * 60 * 1000;
export const TEMP_HUMIDITY_MAINTENANCE_MS = 10 * 60 * 1000;
export const HOURLY_REVIEW_MS = 60 * 60 * 1000;
export const VENTILATION_VERIFY_MS = 4 * 60 * 1000;
/** Enviar límite CO₂ (tipo 3) con el objetivo programado 5 min antes del fin de ventilación. */
export const VENTILATION_END_LEAD_MS = 5 * 60 * 1000;
/** STOP PLAN: mantener suspendido (tipo 10 dato 7200) cada hora; fin con dato 300 a 5 min del cierre. */
export const STOP_PLAN_MAINTAIN_DATO = 7200;
export const STOP_PLAN_END_DATO = 300;
export const STOP_PLAN_HOURLY_MS = 60 * 60 * 1000;
export const STOP_PLAN_PHASE_MAX_A = 0.5;
export const STOP_PLAN_PHASE_VIOLATION_MS = 10 * 60 * 1000;
export const STOP_PLAN_END_LEAD_MS = 5 * 60 * 1000;
export const STOP_PLAN_POLL_MS = 30 * 1000;
export const ETHYLENE_CYCLE_MS = 10 * 60 * 1000;
/** Maduración activa (steady): poll tipo 0 cada 3 min aunque el etileno ya esté en objetivo. */
export const ETHYLENE_STEADY_MONITOR_MS = 3 * 60 * 1000;
export const COOLING_TEMP_OFFSET_C = 2;
/** Por debajo o igual a este setpoint se envía la consigna tal cual; por encima se resta {@link COOLING_TEMP_OFFSET_C}. */
export const COOLING_TEMP_OFFSET_THRESHOLD_C = 10;

/** Consigna tipo 1 enviada en enfriamiento a partir del setpoint programado. */
export function coolingCommandTempC(programmedSetPointC) {
  if (programmedSetPointC == null || !Number.isFinite(programmedSetPointC)) return null;
  if (programmedSetPointC > COOLING_TEMP_OFFSET_THRESHOLD_C) {
    return programmedSetPointC - COOLING_TEMP_OFFSET_C;
  }
  return programmedSetPointC;
}

const TEMP_TOLERANCE = 0.35;
const HUMIDITY_TOLERANCE = 1;
const CO2_TOLERANCE = 0.25;
const AVL_VENT_TARGET = 220;
const AVL_VENT_MAX = 30;

export const AUTOMATED_PROCESS_TYPES = ['Homogenization', 'Ripening', 'Ventilation', 'Cooling'];
export const CONTROL_AUTOMATION_PROCESS_TYPES = [...AUTOMATED_PROCESS_TYPES, 'StopPlan'];

const STOP_PLAN_PHASE_FIELDS = ['consumption_ph_1', 'consumption_ph_2', 'consumption_ph_3'];

function nowIso() {
  return new Date().toISOString();
}

function msFromNow(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function parseParams(session) {
  return parseSessionParams(session?.params);
}

function valuesMatch(actual, target, tolerance) {
  if (actual == null || !Number.isFinite(actual)) return false;
  return Math.abs(actual - target) <= tolerance;
}

function adapterFor(ctx) {
  if (ctx.adapter) return ctx.adapter;
  const adapter = resolveProcessControlAdapter(ctx.device_id);
  if (adapter) ctx.adapter = adapter;
  return adapter;
}

async function fetchUnitRow(ctx, unitId) {
  const adapter = adapterFor(ctx);
  if (!adapter) return null;
  const ident =
    adapter.identificadorForImei?.(unitId) ??
    adapter.empresaIdentificador ??
    gourmetTradingEmpresaIdentificador();
  const row = await fetchDeviceRowByImei(unitId, ident);
  if (!row && (adapter.fleet === 'ultraorganics' || adapter.fleet === 'greenyard')) {
    console.warn('[gourmet-process] telemetry not found', adapter.fleet, unitId, 'ident', ident);
  }
  return row;
}

function commandImeis(ctx, tipo) {
  const adapter = adapterFor(ctx);
  if (adapter?.commandImeis) return adapter.commandImeis(ctx.device_id, tipo);
  if (Number(tipo) === 1 || Number(tipo) === 6 || Number(tipo) === 10) return fanOutUnits(ctx);
  return [sensorUnit(ctx)];
}

async function telemetryRow(ctx, field) {
  const adapter = adapterFor(ctx);
  const imei = adapter?.telemetryImei
    ? adapter.telemetryImei(ctx.device_id, field)
    : sensorUnit(ctx);
  return fetchUnitRow(ctx, imei);
}

async function sendCommandTargets(ctx, tipo, dato) {
  const adapter = adapterFor(ctx);
  if (!adapter) return [];
  const targets = commandImeis(ctx, tipo);
  const urls = [];
  for (const unitId of targets) {
    const sent = await adapter.sendCommand(unitId, tipo, dato);
    urls.push({ imei: unitId, url: sent.url, dato: sent.dato });
  }
  return urls;
}

function fanOutUnits(ctx) {
  return adapterFor(ctx)?.fanOutUnits(ctx.device_id) ?? [String(ctx.device_id || '').trim()];
}

function sensorUnit(ctx) {
  return adapterFor(ctx)?.sensorUnit(ctx.device_id) ?? String(ctx.device_id || '').trim();
}

async function fanOutSend(ctx, units, tipo, dato) {
  const adapter = adapterFor(ctx);
  if (!adapter) return [];
  const targets = adapter.commandImeis ? commandImeis(ctx, tipo) : units;
  const urls = [];
  for (const unitId of targets) {
    const sent = await adapter.sendCommand(unitId, tipo, dato);
    urls.push({ imei: unitId, url: sent.url, dato: sent.dato });
  }
  return urls;
}

async function allUnitsMatch(ctx, units, field, target, tolerance) {
  const results = [];
  for (const unitId of units) {
    const row = await fetchUnitRow(ctx, unitId);
    const actual = readTelemetryField(row, field);
    results.push({ imei: unitId, actual, ok: valuesMatch(actual, target, tolerance) });
  }
  return { results, allOk: results.length > 0 && results.every((r) => r.ok) };
}

function commandTempC(params, processType) {
  const sp = controlParamNumber(params, 'setPoint', 'set_point');
  if (sp == null) return null;
  if (processType === 'Cooling') return coolingCommandTempC(sp);
  return sp;
}

function co2CommandValue(params) {
  const programmed = controlParamNumber(params, 'co2', 'co2_limit');
  if (programmed == null) return null;
  return Math.round(programmed + 1);
}

/** Dato tipo 3 al cerrar ventilación: CO₂ objetivo programado (p. ej. 0.5 %). */
function ventilationEndCo2Dato(params) {
  const target = controlParamNumber(params, 'targetCo2', 'target_co2');
  if (target != null && Number.isFinite(target)) return target;
  const co2 = controlParamNumber(params, 'co2', 'co2_limit');
  if (co2 != null && Number.isFinite(co2)) return co2;
  return null;
}

function appendLog(params, entry) {
  return appendTunnelEventLog(params, { source: 'process_automation', ...entry });
}

async function saveSessionParams(sessionId, nextParams) {
  await pool.query(
    `UPDATE app_device_control_sessions SET params = $1::jsonb, updated_at = now() WHERE id = $2::uuid`,
    [JSON.stringify(nextParams), sessionId]
  );
}

async function patchAutomation(ctx, patchFn) {
  const params = ctx.params && typeof ctx.params === 'object' ? { ...ctx.params } : {};
  const prev = params.processAutomation ?? initGourmetProcessAutomation(ctx);
  const result = patchFn(prev, params);
  const { newEvents = [], ...auto } = result;
  let nextParams = { ...params, processAutomation: auto, tunnelSyncedAt: nowIso() };
  for (const ev of newEvents) {
    nextParams = { ...nextParams, tunnelEventLog: appendLog(nextParams, ev) };
  }
  ctx.params = nextParams;
  await ctx.persist(nextParams);
  return auto;
}

export function initGourmetProcessAutomation(session) {
  const processType = String(session.process_type || '').trim();
  const isVent = processType === 'Ventilation';
  const isCool = processType === 'Cooling';
  return {
    initializedAt: nowIso(),
    processType,
    mode: isVent ? 'ventilation' : isCool ? 'cooling' : 'sequential',
    phase: isVent ? 'ventilation' : 'temperature',
    phaseStartedAt: nowIso(),
    nextActionAt: nowIso(),
    lastHourlyReviewAt: nowIso(),
    ventilationEndSent: false,
    completedPhases: [],
    ethylene: {
      readings: [],
      nonZeroReadings: [],
      baselineBeforeDose: null,
      lastTipo5Dato: 0,
      lastDoseAt: null,
      pollRound: 0,
      cycleStartedAt: null,
    },
  };
}

export function shouldInitAutomatedProcessControl(deviceId, processType, auditLog) {
  if (auditLog) return false;
  if (!isAutomatedControlDeviceId(deviceId)) return false;
  return AUTOMATED_PROCESS_TYPES.includes(String(processType || '').trim());
}

export function shouldInitStopPlanAutomation(deviceId, processType, auditLog) {
  if (auditLog) return false;
  if (!isAutomatedControlDeviceId(deviceId)) return false;
  return String(processType || '').trim() === 'StopPlan';
}

export function initStopPlanAutomation(session) {
  return {
    initializedAt: nowIso(),
    processType: 'StopPlan',
    mode: 'stop_plan',
    nextActionAt: nowIso(),
    lastMaintainCommandAt: null,
    phaseViolatingSince: null,
    stopPlanEndSent: false,
  };
}

export async function initStopPlanOnSessionStart(sessionRow) {
  if (!shouldInitStopPlanAutomation(sessionRow.device_id, sessionRow.process_type, false)) {
    return sessionRow;
  }
  const params = effectiveSessionParams(sessionRow);
  if (params.processAutomation) return { ...sessionRow, params };

  const auto = initStopPlanAutomation(sessionRow);
  const nextParams = {
    ...params,
    source: 'process_automation',
    processAutomation: auto,
    tunnelOverallStatus: 'in_progress',
    tunnelEventLog: appendLog(params, {
      action: 'process_automation_started',
      processType: 'StopPlan',
      mode: 'stop_plan',
    }),
  };
  await saveSessionParams(sessionRow.id, nextParams);
  return { ...sessionRow, params: nextParams };
}

/** @deprecated alias */
export const shouldInitGourmetProcessAutomation = shouldInitAutomatedProcessControl;

export async function initGourmetProcessOnSessionStart(sessionRow) {
  if (!shouldInitAutomatedProcessControl(sessionRow.device_id, sessionRow.process_type, false)) {
    return sessionRow;
  }
  const params = effectiveSessionParams(sessionRow);
  if (params.processAutomation) return { ...sessionRow, params };

  const auto = initGourmetProcessAutomation(sessionRow);
  const ethyleneTarget = controlParamNumber(params, 'ethylene', 'ethylene_injection_programmed');
  const nextParams = {
    ...params,
    source: 'process_automation',
    processAutomation: auto,
    tunnelOverallStatus: 'in_progress',
    tunnelEventLog: appendLog(params, {
      action: 'process_automation_started',
      processType: sessionRow.process_type,
    }),
    ...(ethyleneTarget != null && ethyleneTarget >= 0
      ? { ethylene_injection_programmed: ethyleneTarget, ethylene: ethyleneTarget }
      : {}),
  };
  await saveSessionParams(sessionRow.id, nextParams);
  return { ...sessionRow, params: nextParams };
}

async function ensureTemperature(ctx, params, auto, processType, opts = {}) {
  const { allowSkipAfterMaxAttempts = false } = opts;
  const target = commandTempC(params, processType);
  if (target == null) return { auto, events: [], done: true };
  const adapter = adapterFor(ctx);

  let results;
  let allOk;
  if (adapter?.telemetryImei) {
    // UltraOrganics: perfil Greenyard — un equipo lógico (panel), leer set_point del IMEI primario del grupo
    const panel = String(ctx.device_id || '').trim();
    const imei = adapter.telemetryImei(panel, 'set_point');
    const row = await fetchUnitRow(ctx, imei);
    const actual = readTelemetryField(row, 'set_point');
    const ok = valuesMatch(actual, target, TEMP_TOLERANCE);
    results = [{ imei, actual, ok }];
    allOk = ok;
  } else {
    ({ results, allOk } = await allUnitsMatch(ctx, fanOutUnits(ctx), 'set_point', target, TEMP_TOLERANCE));
  }

  const events = [{ action: 'check_temperature', target, results }];

  if (!allOk) {
    const attempts = Number(auto.tempAdjustAttempts) || 0;
    if (allowSkipAfterMaxAttempts && attempts >= TEMP_MAX_ADJUST_ATTEMPTS) {
      events.push({
        action: 'temp_skip_after_max_attempts',
        target,
        results,
        attempts,
        reason: 'proceed_to_next_phase',
      });
      return {
        auto: { ...auto, tempAdjustAttempts: 0 },
        events,
        done: true,
        skipped: true,
      };
    }
    if (adapter) {
      const urls = await fanOutSend(ctx, fanOutUnits(ctx), 1, target);
      events.push({ action: 'send_temperature', target, urls });
    }
    return {
      auto: { ...auto, tempAdjustAttempts: attempts + 1, nextActionAt: msFromNow(TEMP_VERIFY_MS) },
      events,
      rescheduled: true,
    };
  }
  return { auto: { ...auto, tempAdjustAttempts: 0 }, events, done: true };
}

async function ensureHumidity(ctx, params, auto, opts = {}) {
  const { allowSkipAfterMaxAttempts = false } = opts;
  const targetRaw = controlParamNumber(params, 'humiditySetPoint', 'humidity_set_point');
  const target = targetRaw != null ? Math.round(targetRaw) : null;
  if (target == null) return { auto, events: [], done: true };
  const imei = commandImeis(ctx, 2)[0] ?? sensorUnit(ctx);
  const adapter = adapterFor(ctx);
  const row = await telemetryRow(ctx, 'humidity_set_point');
  const actual = readTelemetryField(row, 'humidity_set_point');
  const ok = valuesMatch(actual, target, HUMIDITY_TOLERANCE);
  const results = [{ imei, actual, ok }];
  const events = [{ action: 'check_humidity', target, imei, results }];

  if (!ok && adapter) {
    const attempts = Number(auto.humidityAdjustAttempts) || 0;
    if (allowSkipAfterMaxAttempts && attempts >= HUMIDITY_MAX_ADJUST_ATTEMPTS) {
      events.push({
        action: 'humidity_skip_after_max_attempts',
        target,
        imei,
        results,
        attempts,
        reason: 'proceed_to_next_phase',
      });
      return {
        auto: { ...auto, humidityAdjustAttempts: 0 },
        events,
        done: true,
        skipped: true,
      };
    }
    const urls = await sendCommandTargets(ctx, 2, target);
    events.push({ action: 'send_humidity', target, imei, urls, dato: target });
    return {
      auto: { ...auto, humidityAdjustAttempts: attempts + 1, nextActionAt: msFromNow(HUMIDITY_VERIFY_MS) },
      events,
      rescheduled: true,
    };
  }
  return { auto: { ...auto, humidityAdjustAttempts: 0 }, events, done: true };
}

async function ensureCo2Limit(ctx, params, auto, opts = {}) {
  const { allowSkipAfterMaxAttempts = false } = opts;
  const commandVal = co2CommandValue(params);
  if (commandVal == null) return { auto, events: [], done: true };
  const imei = commandImeis(ctx, 3)[0] ?? sensorUnit(ctx);
  const adapter = adapterFor(ctx);
  const row = await telemetryRow(ctx, 'set_point_co2');
  const actual = readTelemetryField(row, 'set_point_co2');
  const events = [{ action: 'check_co2_setpoint', imei, target: commandVal, actual }];

  if (!valuesMatch(actual, commandVal, CO2_TOLERANCE) && adapter) {
    const attempts = Number(auto.co2AdjustAttempts) || 0;
    if (allowSkipAfterMaxAttempts && attempts >= CO2_MAX_ADJUST_ATTEMPTS) {
      events.push({
        action: 'co2_skip_after_max_attempts',
        imei,
        target: commandVal,
        actual,
        attempts,
        reason: 'proceed_to_ethylene',
      });
      return {
        auto: { ...auto, co2AdjustAttempts: 0 },
        events,
        done: true,
        skipped: true,
      };
    }
    const urls = await sendCommandTargets(ctx, 3, commandVal);
    events.push({
      action: 'send_co2_limit',
      imei,
      dato: commandVal,
      urls,
      attempt: attempts + 1,
      maxAttempts: CO2_MAX_ADJUST_ATTEMPTS,
    });
    return {
      auto: { ...auto, co2AdjustAttempts: attempts + 1, nextActionAt: msFromNow(CO2_VERIFY_MS) },
      events,
      rescheduled: true,
    };
  }

  const co2Reading = readTelemetryField(row, 'co2_reading');
  const avlRow = await telemetryRow(ctx, 'avl_raw');
  const avlRaw = readTelemetryField(avlRow, 'avl_raw');
  const programmed = controlParamNumber(params, 'co2', 'co2_limit');
  if (
    adapter &&
    co2Reading != null &&
    programmed != null &&
    co2Reading > programmed + 0.5 &&
    avlRaw != null &&
    avlRaw < AVL_VENT_MAX
  ) {
    const urls = await sendCommandTargets(ctx, 6, AVL_VENT_TARGET);
    events.push({
      action: 'send_co2_ventilation',
      reason: 'co2_high_avl_low',
      imei,
      co2Reading,
      avlRaw,
      urls,
      dato: AVL_VENT_TARGET,
    });
  }

  return { auto: { ...auto, co2AdjustAttempts: 0 }, events, done: true };
}

async function tickEthyleneSteadyMonitor(ctx, params, auto) {
  const target = controlParamNumber(params, 'ethylene', 'ethylene_injection_programmed');
  if (target == null || target <= 0) {
    return { auto: { ...auto, nextActionAt: msFromNow(ETHYLENE_STEADY_MONITOR_MS) }, events: [] };
  }

  const imei = commandImeis(ctx, 0)[0] ?? sensorUnit(ctx);
  const adapter = adapterFor(ctx);
  let eth = { ...(auto.ethylene ?? {}) };
  const events = [];

  try {
    const poll = adapter ? await adapter.sendEthylenePoll(imei) : null;
    if (poll) {
      events.push({ action: 'ethylene_poll', url: poll.url, reason: 'steady_monitor', tipo: 0, dato: 1 });
    }
  } catch (e) {
    events.push({ action: 'ethylene_poll_error', message: String(e.message) });
  }

  const row = await telemetryRow(ctx, 'campo_1');
  const actualRaw = readTelemetryField(row, 'campo_1');
  const resolved = resolveEthyleneReading(actualRaw, eth);
  eth = applyEthyleneReadingToMeta(eth, resolved);
  eth.lastMonitorAt = nowIso();

  const effective = resolved.effective;
  const saturatedRead =
    actualRaw != null && Number.isFinite(Number(actualRaw)) && Number(actualRaw) >= ETHYLENE_MAX_READING;

  events.push({
    action: resolved.ignoredZero ? 'ethylene_read_ignored_zero' : 'ethylene_read',
    value: actualRaw,
    effective,
    ignoredZero: resolved.ignoredZero,
    saturatedRead,
    nonZeroReadings: [...resolved.history],
    target,
    reason: resolved.ignoredZero ? 'sensor_zero_after_dose' : 'steady_monitor',
    inRange: effective != null && effective >= target - 0.5,
  });

  // Solo esperar si el sensor devolvió 0 espurio tras inyección reciente.
  if (resolved.ignoredZero) {
    return {
      auto: { ...auto, ethylene: eth, nextActionAt: msFromNow(ETHYLENE_STEADY_MONITOR_MS) },
      events,
      rescheduled: true,
    };
  }

  if (effective == null || !Number.isFinite(effective) || effective >= target - 0.5 || !adapter) {
    return {
      auto: { ...auto, ethylene: eth, nextActionAt: msFromNow(ETHYLENE_STEADY_MONITOR_MS) },
      events,
      rescheduled: true,
    };
  }

  const isInitial = !eth.lastTipo5Dato;
  let dose = isInitial ? 2 : computeProportionalEthyleneDose(eth, target, effective);
  let doseAction = isInitial ? 'ethylene_tipo5_initial' : 'ethylene_tipo5_proportional';
  let doseReason = isInitial ? 'initial' : 'proportional';

  if (!isInitial && dose <= 0) {
    const sinceDoseMs = eth.lastDoseAt ? Date.now() - new Date(eth.lastDoseAt).getTime() : Infinity;
    if (sinceDoseMs >= ETHYLENE_RECENT_DOSE_MS) {
      const remaining = target - effective;
      dose = clampEthyleneDose(Math.max(1, Math.round(remaining / 4)));
      doseAction = 'ethylene_tipo5_fallback';
      doseReason = 'fallback_no_increment';
    } else {
      events.push({
        action: 'ethylene_skip_dose',
        reason: 'await_increment',
        effective,
        target,
        baseline: eth.baselineBeforeDose,
        lastTipo5Dato: eth.lastTipo5Dato,
      });
    }
  }

  if (dose > 0) {
    try {
      const sent = await adapter.sendEthyleneDose(imei, dose);
      eth = recordEthyleneDose(eth, sent.ppm, effective);
      events.push({
        action: doseAction,
        imei,
        dato: sent.ppm,
        baseline: effective,
        lastReading: effective,
        target,
        url: sent.step.url,
        reason: doseReason === 'fallback_no_increment' ? 'below_target_no_increment' : 'below_target_steady',
        doseReason,
        saturatedRead,
      });
    } catch (e) {
      events.push({ action: 'ethylene_dose_error', message: String(e.message) });
    }
  }

  return {
    auto: { ...auto, ethylene: eth, nextActionAt: msFromNow(ETHYLENE_STEADY_MONITOR_MS) },
    events,
    rescheduled: true,
  };
}

async function tickEthyleneCycle(ctx, params, auto) {
  if (auto.mode === 'steady') {
    return tickEthyleneSteadyMonitor(ctx, params, auto);
  }

  const target = controlParamNumber(params, 'ethylene', 'ethylene_injection_programmed');
  if (target == null || target <= 0) {
    return { auto: { ...auto, nextActionAt: msFromNow(ETHYLENE_CYCLE_MS) }, events: [] };
  }

  const imei = commandImeis(ctx, 0)[0] ?? sensorUnit(ctx);
  const adapter = adapterFor(ctx);
  let eth = { ...(auto.ethylene ?? {}) };
  let events = [];
  const now = Date.now();
  const cycleStart = eth.cycleStartedAt ? new Date(eth.cycleStartedAt).getTime() : now;

  if (!eth.cycleStartedAt || now - cycleStart >= ETHYLENE_CYCLE_MS) {
    eth = {
      readings: [],
      nonZeroReadings: [],
      baselineBeforeDose: null,
      lastTipo5Dato: 0,
      lastDoseAt: null,
      pollRound: 0,
      cycleStartedAt: nowIso(),
    };
    const row = await telemetryRow(ctx, 'campo_1');
    const baselineRaw = readTelemetryField(row, 'campo_1');
    const resolved = resolveEthyleneReading(baselineRaw, eth);
    eth = applyEthyleneReadingToMeta(eth, resolved);
    const baseline = resolved.effective;

    if (baseline != null && baseline < target - 0.5 && adapter && resolved.canInject) {
      const sent = await adapter.sendEthyleneDose(imei, 2);
      eth = recordEthyleneDose(eth, sent.ppm, baseline);
      events.push({
        action: 'ethylene_tipo5_initial',
        imei,
        dato: sent.ppm,
        url: sent.step.url,
        baseline,
        value: baselineRaw,
      });
    } else if (baseline != null && baseline >= target - 0.5) {
      events.push({ action: 'ethylene_skip_dose', reason: 'at_target', baseline, target });
      return {
        auto: {
          ...auto,
          mode: 'steady',
          ethylene: { ...eth, lastReading: baseline },
          nextActionAt: msFromNow(ETHYLENE_STEADY_MONITOR_MS),
        },
        events,
        rescheduled: true,
      };
    } else {
      events.push({
        action: 'ethylene_read',
        value: baselineRaw,
        effective: baseline,
        ignoredZero: resolved.ignoredZero,
        reason: 'cycle_start_wait_reading',
        target,
      });
      return {
        auto: { ...auto, ethylene: eth, nextActionAt: msFromNow(ETHYLENE_POLL_INTERVAL_MS) },
        events,
        rescheduled: true,
      };
    }
    return {
      auto: { ...auto, ethylene: eth, nextActionAt: msFromNow(ETHYLENE_POLL_INTERVAL_MS) },
      events,
      rescheduled: true,
    };
  }

  try {
    const poll = adapter ? await adapter.sendEthylenePoll(imei) : null;
    if (poll) events.push({ action: 'ethylene_poll', url: poll.url });
  } catch (e) {
    events.push({ action: 'ethylene_poll_error', message: String(e.message) });
  }

  const row = await telemetryRow(ctx, 'campo_1');
  const actualRaw = readTelemetryField(row, 'campo_1');
  const resolved = resolveEthyleneReading(actualRaw, eth);
  eth = applyEthyleneReadingToMeta(eth, resolved);
  eth.pollRound = (eth.pollRound ?? 0) + 1;

  events.push({
    action: resolved.ignoredZero ? 'ethylene_read_ignored_zero' : 'ethylene_read',
    value: actualRaw,
    effective: resolved.effective,
    ignoredZero: resolved.ignoredZero,
    nonZeroReadings: [...resolved.history],
    target,
  });

  const effective = resolved.effective;

  if (effective != null && effective >= target - 0.5) {
    return {
      auto: {
        ...auto,
        mode: 'steady',
        ethylene: { ...eth, cycleStartedAt: null, lastMonitorAt: nowIso(), lastReading: effective },
        nextActionAt: msFromNow(ETHYLENE_STEADY_MONITOR_MS),
      },
      events,
      rescheduled: true,
    };
  }

  if (resolved.ignoredZero || resolved.history.length < ETHYLENE_READINGS_NEEDED || eth.pollRound < 4) {
    return {
      auto: { ...auto, ethylene: eth, nextActionAt: msFromNow(ETHYLENE_POLL_INTERVAL_MS) },
      events,
      rescheduled: true,
    };
  }

  const lastReading = resolved.history[resolved.history.length - 1];
  const dose = computeProportionalEthyleneDose(eth, target, lastReading);
  if (dose > 0 && lastReading < target - 0.5 && adapter && resolved.canInject) {
    const sent = await adapter.sendEthyleneDose(imei, dose);
    eth = recordEthyleneDose(eth, sent.ppm, lastReading);
    eth.readings = [];
    eth.nonZeroReadings = [];
    eth.pollRound = 0;
    events.push({
      action: 'ethylene_tipo5_proportional',
      imei,
      dato: sent.ppm,
      lastReading,
      target,
      url: sent.step.url,
    });
  }

  return {
    auto: { ...auto, ethylene: eth, nextActionAt: msFromNow(ETHYLENE_POLL_INTERVAL_MS) },
    events,
    rescheduled: true,
  };
}

async function advanceSequentialPhase(ctx, params, auto, phase, done) {
  if (!done) return auto;
  const completed = [...(auto.completedPhases ?? []), phase];
  const order = getPhaseOrder(ctx.process_type);
  const idx = order.indexOf(phase);
  const nextPhase = order[idx + 1];

  if (!nextPhase) {
    const mode = ctx.process_type === 'Ripening' ? 'steady' : 'maintenance';
    return {
      ...auto,
      mode,
      phase: mode === 'steady' ? 'ethylene' : 'maintenance',
      phaseStartedAt: nowIso(),
      completedPhases: completed,
      nextActionAt: nowIso(),
    };
  }

  return {
    ...auto,
    phase: nextPhase,
    phaseStartedAt: nowIso(),
    completedPhases: completed,
    nextActionAt: nowIso(),
  };
}

function getPhaseOrder(processType) {
  if (processType === 'Ripening') return ['temperature', 'humidity', 'co2', 'ethylene'];
  if (processType === 'Homogenization') return ['temperature', 'humidity'];
  if (processType === 'Cooling') return ['temperature'];
  return [];
}

async function tickHomogenization(ctx, params, auto) {
  if (auto.mode === 'maintenance') {
    const temp = await ensureTemperature(ctx, params, auto, ctx.process_type);
    if (temp.rescheduled) {
      await patchAutomation(ctx, () => ({ ...temp.auto, newEvents: temp.events }));
      return;
    }
    const hum = await ensureHumidity(ctx, params, temp.auto);
    await patchAutomation(ctx, () => ({
      ...hum.auto,
      nextActionAt: msFromNow(TEMP_HUMIDITY_MAINTENANCE_MS),
      newEvents: [...temp.events, ...hum.events],
    }));
    return;
  }

  let events = [];
  const phaseSkip = { allowSkipAfterMaxAttempts: auto.mode === 'sequential' };
  if (auto.phase === 'temperature') {
    const temp = await ensureTemperature(ctx, params, auto, ctx.process_type, phaseSkip);
    events = temp.events;
    if (temp.rescheduled) {
      await patchAutomation(ctx, () => ({ ...temp.auto, newEvents: events }));
      return;
    }
    auto = await advanceSequentialPhase(ctx, params, temp.auto, 'temperature', temp.done);
  }

  if (auto.phase === 'humidity') {
    const hum = await ensureHumidity(ctx, params, auto, phaseSkip);
    events = [...events, ...hum.events];
    if (hum.rescheduled) {
      await patchAutomation(ctx, () => ({ ...hum.auto, newEvents: events }));
      return;
    }
    auto = await advanceSequentialPhase(ctx, params, hum.auto, 'humidity', hum.done);
  }

  await patchAutomation(ctx, () => ({ ...auto, newEvents: events }));
}

async function tickRipening(ctx, params, auto) {
  const hourlyDue =
    !auto.lastHourlyReviewAt ||
    Date.now() - new Date(auto.lastHourlyReviewAt).getTime() >= HOURLY_REVIEW_MS;

  if (hourlyDue && auto.mode === 'steady' && String(ctx.process_type) === 'Ripening') {
    auto = {
      ...initGourmetProcessAutomation(ctx),
      mode: 'sequential',
      phase: 'temperature',
      lastHourlyReviewAt: nowIso(),
    };
    await patchAutomation(ctx, () => ({
      ...auto,
      newEvents: [{ action: 'hourly_review_restart' }],
    }));
    return;
  }

  if (auto.mode === 'sequential' && auto.phase === 'ethylene') {
    auto = { ...auto, mode: 'steady', lastHourlyReviewAt: nowIso() };
  }

  if (auto.mode === 'steady') {
    const co2Due =
      !auto.lastCo2CheckAt ||
      Date.now() - new Date(auto.lastCo2CheckAt).getTime() >= CO2_MAINTENANCE_MS;
    let events = [];
    let nextAuto = auto;

    if (co2Due) {
      const co2 = await ensureCo2Limit(ctx, params, auto);
      events = co2.events;
      nextAuto = { ...co2.auto, lastCo2CheckAt: nowIso() };
      if (co2.rescheduled) {
        await patchAutomation(ctx, () => ({ ...nextAuto, newEvents: events }));
        return;
      }
    }

    const eth = await tickEthyleneCycle(ctx, params, nextAuto);
    await patchAutomation(ctx, () => ({
      ...eth.auto,
      lastHourlyReviewAt: auto.lastHourlyReviewAt,
      lastCo2CheckAt: nextAuto.lastCo2CheckAt ?? auto.lastCo2CheckAt,
      newEvents: [...events, ...eth.events],
    }));
    return;
  }

  let events = [];
  const phaseSkip = { allowSkipAfterMaxAttempts: true };
  if (auto.phase === 'temperature') {
    const temp = await ensureTemperature(ctx, params, auto, ctx.process_type, phaseSkip);
    events = temp.events;
    if (temp.rescheduled) {
      await patchAutomation(ctx, () => ({ ...temp.auto, newEvents: events }));
      return;
    }
    auto = await advanceSequentialPhase(ctx, params, temp.auto, 'temperature', temp.done);
  }

  if (auto.phase === 'humidity') {
    const hum = await ensureHumidity(ctx, params, auto, phaseSkip);
    events = [...events, ...hum.events];
    if (hum.rescheduled) {
      await patchAutomation(ctx, () => ({ ...hum.auto, newEvents: events }));
      return;
    }
    auto = await advanceSequentialPhase(ctx, params, hum.auto, 'humidity', hum.done);
  }

  if (auto.phase === 'co2') {
    const co2 = await ensureCo2Limit(ctx, params, auto, { allowSkipAfterMaxAttempts: true });
    events = [...events, ...co2.events];
    if (co2.rescheduled) {
      await patchAutomation(ctx, () => ({ ...co2.auto, newEvents: events }));
      return;
    }
    auto = await advanceSequentialPhase(ctx, params, co2.auto, 'co2', co2.done);
  }

  if (auto.phase === 'ethylene' || auto.mode === 'steady') {
    const eth = await tickEthyleneCycle(ctx, params, auto);
    events = [...events, ...eth.events];
    auto = eth.auto;
    if (eth.rescheduled) {
      await patchAutomation(ctx, () => ({ ...auto, newEvents: events }));
      return;
    }
    auto = await advanceSequentialPhase(ctx, params, auto, 'ethylene', true);
  }

  await patchAutomation(ctx, () => ({
    ...auto,
    lastHourlyReviewAt: auto.lastHourlyReviewAt ?? nowIso(),
    newEvents: events,
  }));
}

async function tickCooling(ctx, params, auto) {
  const temp = await ensureTemperature(ctx, params, auto, 'Cooling', { allowSkipAfterMaxAttempts: true });
  await patchAutomation(ctx, () => ({
    ...temp.auto,
    nextActionAt: msFromNow(TEMP_HUMIDITY_MAINTENANCE_MS),
    newEvents: temp.events,
  }));
}

function unitPhasesBelowStopThreshold(row) {
  const phases = STOP_PLAN_PHASE_FIELDS.map((f) => readTelemetryField(row, f));
  if (phases.some((v) => v == null || !Number.isFinite(v))) {
    return { ok: null, phases };
  }
  const ok = phases.every((v) => v < STOP_PLAN_PHASE_MAX_A);
  return { ok, phases };
}

async function checkStopPlanPhaseConsumption(ctx) {
  const units = fanOutUnits(ctx);
  const checks = [];
  let hasReading = false;
  let anyHigh = false;
  for (const imei of units) {
    const row = await fetchUnitRow(ctx, imei);
    const { ok, phases } = unitPhasesBelowStopThreshold(row);
    if (ok != null) hasReading = true;
    if (ok === false) anyHigh = true;
    checks.push({ imei, phases, ok });
  }
  return { checks, violating: hasReading && anyHigh };
}

async function sendStopPlanTipo10(ctx, dato) {
  const urls = await fanOutSend(ctx, fanOutUnits(ctx), 10, dato);
  return urls;
}

async function tickStopPlan(ctx, params, auto) {
  const endMs = ctx.estimated_end_at ? new Date(ctx.estimated_end_at).getTime() : null;
  const events = [];
  const adapter = adapterFor(ctx);
  const now = Date.now();

  const endLeadMs = endMs != null ? endMs - STOP_PLAN_END_LEAD_MS : null;
  if (endLeadMs != null && now >= endLeadMs && !auto.stopPlanEndSent) {
    if (adapter) {
      const urls = await sendStopPlanTipo10(ctx, STOP_PLAN_END_DATO);
      events.push({
        action: 'stop_plan_end_tipo10',
        dato: STOP_PLAN_END_DATO,
        urls,
        reason: 'five_min_before_end',
        minutesBeforeEnd: 5,
      });
    }
    await patchAutomation(ctx, () => ({
      ...auto,
      stopPlanEndSent: true,
      nextActionAt: msFromNow(STOP_PLAN_POLL_MS),
      newEvents: events,
    }));
    return;
  }

  const { checks, violating } = await checkStopPlanPhaseConsumption(ctx);
  events.push({ action: 'check_stop_plan_phases', checks, threshold: STOP_PLAN_PHASE_MAX_A });

  let phaseViolatingSince = auto.phaseViolatingSince ?? null;
  if (violating) {
    if (!phaseViolatingSince) phaseViolatingSince = nowIso();
  } else {
    phaseViolatingSince = null;
  }

  const violationMs =
    phaseViolatingSince != null ? now - new Date(phaseViolatingSince).getTime() : 0;
  const lastMaintainMs = auto.lastMaintainCommandAt
    ? now - new Date(auto.lastMaintainCommandAt).getTime()
    : null;

  let maintainSent = false;
  if (adapter && !auto.stopPlanEndSent) {
    const shouldResendViolation =
      violating && violationMs >= STOP_PLAN_PHASE_VIOLATION_MS;
    const shouldSendHourly =
      lastMaintainMs == null || lastMaintainMs >= STOP_PLAN_HOURLY_MS;
    if (shouldResendViolation || shouldSendHourly) {
      const urls = await sendStopPlanTipo10(ctx, STOP_PLAN_MAINTAIN_DATO);
      events.push({
        action: 'stop_plan_maintain_tipo10',
        dato: STOP_PLAN_MAINTAIN_DATO,
        urls,
        reason: shouldResendViolation ? 'phase_consumption_high' : 'hourly_maintain',
        violationMinutes: shouldResendViolation ? Math.round(violationMs / 60000) : undefined,
        checks,
      });
      maintainSent = true;
    }
  }

  await patchAutomation(ctx, () => ({
    ...auto,
    phaseViolatingSince,
    ...(maintainSent ? { lastMaintainCommandAt: nowIso() } : {}),
    ...(maintainSent && violating ? { phaseViolatingSince: null } : {}),
    nextActionAt: msFromNow(STOP_PLAN_POLL_MS),
    newEvents: events,
  }));
}

async function tickVentilation(ctx, params, auto) {
  const endMs = ctx.estimated_end_at ? new Date(ctx.estimated_end_at).getTime() : null;
  const events = [];

  const endLeadMs = endMs != null ? endMs - VENTILATION_END_LEAD_MS : null;
  if (endLeadMs != null && Date.now() >= endLeadMs && !auto.ventilationEndSent) {
    const co2Dato = ventilationEndCo2Dato(params);
    const adapter = adapterFor(ctx);
    if (adapter && co2Dato != null) {
      const urls = await sendCommandTargets(ctx, 3, co2Dato);
      events.push({
        action: 'ventilation_end_tipo3',
        targetCo2: co2Dato,
        dato: co2Dato,
        urls,
        reason: 'five_min_before_end',
        minutesBeforeEnd: 5,
      });
    } else if (co2Dato == null) {
      events.push({
        action: 'ventilation_end_skipped',
        reason: 'missing_target_co2',
      });
    }
    await patchAutomation(ctx, () => ({
      ...auto,
      ventilationEndSent: true,
      nextActionAt: msFromNow(VENTILATION_VERIFY_MS),
      newEvents: events,
    }));
    return;
  }

  const units = fanOutUnits(ctx);
  const checks = [];
  for (const imei of units) {
    const row = await fetchUnitRow(ctx, imei);
    const avl = readTelemetryField(row, 'avl_raw');
    checks.push({ imei, avl, ok: valuesMatch(avl, AVL_VENT_TARGET, 5) });
  }
  events.push({ action: 'check_ventilation_avl', checks });

  const allOk = checks.every((c) => c.ok);
  if (!allOk) {
    const urls = await fanOutSend(ctx, units, 6, AVL_VENT_TARGET);
    events.push({ action: 'send_ventilation', dato: AVL_VENT_TARGET, urls });
  }

  await patchAutomation(ctx, () => ({
    ...auto,
    nextActionAt: msFromNow(VENTILATION_VERIFY_MS),
    newEvents: events,
  }));
}

function controlCtxFromSession(session, persistFn) {
  const device_id = session.device_id;
  const params = effectiveSessionParams(session);
  return {
    device_id,
    process_type: session.process_type,
    estimated_end_at: session.estimated_end_at,
    params,
    adapter: resolveProcessControlAdapter(device_id),
    persist: persistFn,
  };
}

export async function tickGourmetControlContext(ctx) {
  if (!ctx.adapter) ctx.adapter = resolveProcessControlAdapter(ctx.device_id);
  if (!ctx.adapter) return;

  let auto = ctx.params?.processAutomation;
  const processType = String(ctx.process_type || '').trim();
  if (!auto) {
    auto = processType === 'StopPlan' ? initStopPlanAutomation(ctx) : initGourmetProcessAutomation(ctx);
    const nextParams = {
      ...ctx.params,
      processAutomation: auto,
      source: ctx.params?.source ?? 'process_automation',
    };
    ctx.params = nextParams;
    await ctx.persist(nextParams);
  }

  if (auto.nextActionAt && new Date(auto.nextActionAt).getTime() > Date.now()) {
    return;
  }

  const params = ctx.params ?? {};
  if (processType === 'StopPlan') {
    await tickStopPlan(ctx, params, auto);
    return;
  }
  if (processType === 'Ventilation') {
    await tickVentilation(ctx, params, auto);
    return;
  }
  if (processType === 'Cooling') {
    await tickCooling(ctx, params, auto);
    return;
  }
  if (processType === 'Homogenization') {
    await tickHomogenization(ctx, params, auto);
    return;
  }
  if (processType === 'Ripening') {
    await tickRipening(ctx, params, auto);
  }
}

/** Arranque inmediato tras crear sesión Gourmet / STOP PLAN (no esperar al poller). */
export async function kickGourmetProcessForSession(sessionRow) {
  if (!sessionRow?.id) return;
  const processType = String(sessionRow.process_type || '').trim();
  const isStopPlan = processType === 'StopPlan';
  if (
    !shouldInitAutomatedProcessControl(sessionRow.device_id, processType, false) &&
    !shouldInitStopPlanAutomation(sessionRow.device_id, processType, false)
  ) {
    return;
  }
  if (!isStopPlan && (await deviceHasActiveTracking(sessionRow.device_id))) return;

  let row = sessionRow;
  const params = parseParams(row);
  if (!params.processAutomation) {
    row = isStopPlan
      ? await initStopPlanOnSessionStart(row)
      : await initGourmetProcessOnSessionStart(row);
  }

  const { rows: fresh } = await pool.query(
    `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid AND status = 'active'`,
    [row.id]
  );
  if (!fresh.length) return;
  await tickSession(fresh[0]);
}

async function tickSession(session) {
  const { rows: fresh } = await pool.query(
    `SELECT * FROM app_device_control_sessions WHERE id = $1::uuid AND status = 'active'`,
    [session.id]
  );
  if (!fresh.length) return;
  session = fresh[0];

  const ctx = controlCtxFromSession(session, (nextParams) => saveSessionParams(session.id, nextParams));
  await tickGourmetControlContext(ctx);
}

async function deviceHasActiveTracking(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM app_ripening_processes
     WHERE deleted_at IS NULL AND status = 'active' AND (payload->>'deviceId') = $1
     LIMIT 1`,
    [id]
  );
  return rows.length > 0;
}

/** Procesa sesiones de control activas con automatización (Gourmet + Greenyard + UltraOrganics + STOP PLAN). */
export async function processGourmetActiveControlSessions(limit = 12) {
  const { rows } = await pool.query(
    `SELECT * FROM app_device_control_sessions
     WHERE status = 'active'
       AND archived_at IS NULL
       AND process_type = ANY($1::text[])
     ORDER BY updated_at ASC
     LIMIT $2`,
    [CONTROL_AUTOMATION_PROCESS_TYPES, limit]
  );

  let processed = 0;
  for (const session of rows) {
    if (!isAutomatedControlDeviceId(session.device_id)) continue;
    if (session.process_type !== 'StopPlan' && (await deviceHasActiveTracking(session.device_id))) {
      continue;
    }
    try {
      await tickSession(session);
      processed += 1;
    } catch (e) {
      console.error('[gourmet-process]', session.id, session.process_type, e.message);
    }
  }
  return processed;
}
