/** Normalización y lectura de parámetros de procesos de panel (Homogenización, Maduración, …). */

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
  return null;
}
