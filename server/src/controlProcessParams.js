/** Normalización y lectura de parámetros de procesos de panel (Homogenización, Maduración, …). */

import { validateProcessSetPointC } from './processTempLimits.js';

function asObject(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (Array.isArray(v)) return { tunnelEventLog: v };
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function parseSessionParams(raw) {
  const p = asObject(raw);
  return p ?? {};
}

/** Extrae snapshot guardado al iniciar el proceso (recuperación si params se corrompieron). */
export function extractControlSnapshotFromLog(params) {
  const p = asObject(params) ?? {};
  const log = Array.isArray(p.tunnelEventLog) ? p.tunnelEventLog : [];
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const ev = log[i];
    if (ev && typeof ev === 'object' && ev.action === 'process_started' && ev.controlSnapshot) {
      const snap = asObject(ev.controlSnapshot);
      if (snap) return snap;
    }
  }
  return null;
}

/** Recupera setpoints desde programmedSummary del evento process_started (sesiones antiguas corruptas). */
export function parseProgrammedSummary(summary) {
  const text = String(summary || '').trim();
  if (!text) return null;
  const out = {};
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

function repairFromProcessStartedLog(params) {
  const p = asObject(params) ?? {};
  const log = Array.isArray(p.tunnelEventLog) ? p.tunnelEventLog : [];
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const ev = log[i];
    if (ev && typeof ev === 'object' && ev.action === 'process_started' && ev.programmedSummary) {
      return parseProgrammedSummary(ev.programmedSummary);
    }
  }
  return null;
}

/** Params efectivos de una sesión (normalizados + snapshot + controlProgram). */
export function effectiveSessionParams(sessionRow) {
  const processType = String(sessionRow?.process_type || '').trim();
  const durationHours = Number(sessionRow?.duration_hours);
  const parsed = parseSessionParams(sessionRow?.params);
  const snapshot = extractControlSnapshotFromLog(parsed);
  const repaired = repairFromProcessStartedLog(parsed);
  const cp = asObject(parsed.controlProgram) ?? {};
  const merged = {
    ...parsed,
    ...(repaired ?? {}),
    ...(snapshot ?? {}),
    controlProgram: { ...cp, ...(repaired ?? {}), ...(snapshot ?? {}) },
  };
  return normalizeControlProcessParams(processType, merged, durationHours);
}

export function buildControlSnapshot(params) {
  const p = asObject(params) ?? {};
  const cp = asObject(p.controlProgram) ?? {};
  const snap = { ...cp };
  if (p.setPoint != null) snap.setPoint = Number(p.setPoint);
  if (p.humiditySetPoint != null) snap.humiditySetPoint = Number(p.humiditySetPoint);
  if (p.durationHours != null) snap.durationHours = Number(p.durationHours);
  if (p.ethylene != null) snap.ethylene = Number(p.ethylene);
  if (p.co2 != null) snap.co2 = Number(p.co2);
  if (p.targetCo2 != null) snap.targetCo2 = Number(p.targetCo2);
  if (p.durationMin != null) snap.durationMin = Number(p.durationMin);
  return snap;
}

export function controlParamNumber(params, ...keys) {
  const p = asObject(params) ?? {};
  for (const key of keys) {
    const n = Number(p[key]);
    if (Number.isFinite(n)) return n;
  }
  const cp = asObject(p.controlProgram);
  if (cp) {
    for (const key of keys) {
      const n = Number(cp[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function normalizeControlProcessParams(processType, rawParams, durationHours) {
  const src = asObject(rawParams) ?? {};
  const out = { ...src };
  const pt = String(processType || '').trim();

  const setPoint = controlParamNumber(src, 'setPoint', 'set_point');
  if (setPoint != null) out.setPoint = setPoint;

  const rh = controlParamNumber(src, 'humiditySetPoint', 'humidity_set_point');
  if (rh != null) out.humiditySetPoint = Math.round(rh);

  const eth = controlParamNumber(src, 'ethylene', 'ethylene_injection_programmed');
  if (eth != null && eth >= 0) out.ethylene = Math.round(eth);

  const co2 = controlParamNumber(src, 'co2', 'co2_limit');
  if (co2 != null) out.co2 = co2;

  const targetCo2 = controlParamNumber(src, 'targetCo2', 'target_co2');
  if (targetCo2 != null) out.targetCo2 = targetCo2;

  const durMin = controlParamNumber(src, 'durationMin');
  if (durMin != null) out.durationMin = Math.round(durMin);

  if (Number.isFinite(durationHours) && durationHours > 0) out.durationHours = durationHours;

  const controlProgram = {
    ...(setPoint != null ? { setPoint } : {}),
    ...(rh != null ? { humiditySetPoint: Math.round(rh) } : {}),
    ...(eth != null && pt === 'Ripening' ? { ethylene: Math.round(eth) } : {}),
    ...(co2 != null && pt === 'Ripening' ? { co2 } : {}),
    ...(targetCo2 != null && pt === 'Ventilation' ? { targetCo2 } : {}),
    ...(Number.isFinite(durationHours) && durationHours > 0 ? { durationHours } : {}),
    ...(durMin != null && pt === 'Ventilation' ? { durationMin: Math.round(durMin) } : {}),
  };

  if (Object.keys(controlProgram).length > 0) out.controlProgram = controlProgram;

  return out;
}

export function validateControlProcessParams(processType, params) {
  const pt = String(processType || '').trim();
  if (pt === 'Homogenization' || pt === 'Ripening') {
    if (controlParamNumber(params, 'setPoint', 'set_point') == null) return 'setPoint required';
    if (controlParamNumber(params, 'humiditySetPoint', 'humidity_set_point') == null) {
      return 'humiditySetPoint required';
    }
  }
  if (pt === 'Cooling') {
    if (controlParamNumber(params, 'setPoint', 'set_point') == null) return 'setPoint required';
  }
  if (pt === 'Ventilation') {
    if (controlParamNumber(params, 'targetCo2', 'target_co2') == null) return 'targetCo2 required';
  }

  const setPoint = controlParamNumber(params, 'setPoint', 'set_point');
  if (setPoint != null && ['Homogenization', 'Ripening', 'Cooling', 'Manual'].includes(pt)) {
    const extendedManual = params?.extendedManualTempRange === true || params?.extended_temp_range === true;
    const tempErr = validateProcessSetPointC(pt, setPoint, { extendedManual });
    if (tempErr) return tempErr;
  }

  return null;
}
