/** Cuenta UltraOrganics: 3 equipos en panel, 5 IMEI físicos, comandos TermoKing por tipo/unidad. */

function parseList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function flatMaduradorRow(row) {
  if (!row || typeof row !== 'object') return {};
  const flat = { ...row };
  const ud = row.ultimo_dato;
  if (ud && typeof ud === 'object' && !Array.isArray(ud)) {
    Object.assign(flat, ud);
  }
  return flat;
}

/** Etileno (sensor): MEX1001, MEX2001, MEX3001 — coincide con IMEI panel. */
const ULTRAORGANICS_ETHYLENE_IMEI = {
  MEX1001: 'MEX1001',
  MEX2001: 'MEX2001',
  MEX3001: 'MEX3001',
};

/** Humedad (y CO₂ en pareja): MEX1002, MEX2002, MEX3001. */
const ULTRAORGANICS_HUMIDITY_IMEI = {
  MEX1001: 'MEX1002',
  MEX2001: 'MEX2002',
  MEX3001: 'MEX3001',
};

export function isUltraorganicsFleetEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .endsWith('ultraorganics@riper.local');
}

/** IMEI visibles en el panel (orden fijo). */
export function ultraorganicsPanelImeis() {
  const raw = process.env.ULTRAORGANICS_PANEL_IMEIS || 'MEX1001,MEX2001,MEX3001';
  return parseList(raw);
}

/** Grupos físicos: panel IMEI → IMEIs del grupo. */
export function ultraorganicsDeviceGroupsMap() {
  return {
    MEX1001: parseList(process.env.ULTRAORGANICS_DEVICE_1_IMEIS || 'MEX1001,MEX1002'),
    MEX2001: parseList(process.env.ULTRAORGANICS_DEVICE_2_IMEIS || 'MEX2001,MEX2002'),
    MEX3001: parseList(process.env.ULTRAORGANICS_DEVICE_3_IMEIS || 'MEX3001'),
  };
}

export function ultraorganicsUpstreamIdentificadores() {
  const raw = process.env.ULTRAORGANICS_UPSTREAM_IDENTIFICADORES || '1001,2001,3001';
  return parseList(raw);
}

/** Todos los IMEI físicos de la cuenta (5 por defecto). */
export function ultraorganicsAllPhysicalImeis() {
  const set = new Set(ultraorganicsPanelImeis());
  for (const imeis of Object.values(ultraorganicsDeviceGroupsMap())) {
    for (const i of imeis) set.add(i);
  }
  return [...set];
}

/** IMEI panel (MEX1001/2001/3001) para cualquier IMEI del grupo. */
export function ultraorganicsPanelDeviceIdForImei(imei) {
  const id = String(imei || '').trim();
  if (isUltraorganicsDeviceId(id)) return id;
  const groups = ultraorganicsDeviceGroupsMap();
  for (const [panel, imeis] of Object.entries(groups)) {
    if (imeis.includes(id)) return panel;
  }
  return id;
}

/** Sesiones/seguimientos: incluir los 5 IMEI sin fusionar filas de telemetría. */
export function isUltraorganicsScopedDeviceId(deviceId) {
  const id = String(deviceId || '').trim();
  return id.length > 0 && ultraorganicsAllPhysicalImeis().includes(id);
}

export function filterRowsByUltraorganicsScope(rows, pickDeviceId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const allow = new Set(ultraorganicsAllPhysicalImeis());
  return rows.filter((row) => allow.has(String(pickDeviceId(row) || '').trim()));
}

export function isUltraorganicsDeviceId(deviceId) {
  const id = String(deviceId || '').trim();
  return id.length > 0 && ultraorganicsPanelImeis().includes(id);
}

export function ultraorganicsEthyleneImei(panelDeviceId) {
  const panel = String(panelDeviceId || '').trim();
  return ULTRAORGANICS_ETHYLENE_IMEI[panel] ?? panel;
}

export function ultraorganicsHumidityImei(panelDeviceId) {
  const panel = String(panelDeviceId || '').trim();
  return ULTRAORGANICS_HUMIDITY_IMEI[panel] ?? panel;
}

export function identificadorForUltraorganicsImei(imei) {
  const id = String(imei || '').trim();
  const groups = ultraorganicsDeviceGroupsMap();
  for (const [panel, imeis] of Object.entries(groups)) {
    if (imeis.includes(id)) {
      if (panel === 'MEX1001') return '1001';
      if (panel === 'MEX2001') return '2001';
      if (panel === 'MEX3001') return '3001';
    }
  }
  if (id.startsWith('MEX1')) return '1001';
  if (id.startsWith('MEX2')) return '2001';
  if (id.startsWith('MEX3')) return '3001';
  return ultraorganicsUpstreamIdentificadores()[0] || '1001';
}

/**
 * IMEIs destino al enviar comando (tipo TermoKing).
 * Etileno → sensor panel; humedad/CO₂ → IMEI companion; temp/vent → fan-out del grupo.
 */
export function ultraorganicsCommandImeis(panelDeviceId, tipo) {
  const panel = String(panelDeviceId || '').trim();
  const t = Number(tipo);
  if (panel === 'MEX1001') {
    if (t === 1 || t === 6) return ['MEX1001', 'MEX1002'];
    if (t === 2 || t === 3) return ['MEX1002'];
    if (t === 0 || t === 5) return ['MEX1001'];
    return ['MEX1001'];
  }
  if (panel === 'MEX2001') {
    if (t === 1 || t === 6) return ['MEX2001', 'MEX2002'];
    if (t === 2 || t === 3) return ['MEX2002'];
    if (t === 0 || t === 5) return ['MEX2001'];
    return ['MEX2001'];
  }
  if (panel === 'MEX3001') return ['MEX3001'];
  return [panel];
}

/** IMEI para leer telemetría en control automático (mismo criterio que Greenyard: un equipo lógico por panel). */
export function ultraorganicsTelemetryImei(panelDeviceId, field) {
  const panel = String(panelDeviceId || '').trim();
  const f = String(field || '');
  if (f === 'set_point') {
    return ultraorganicsEthyleneImei(panel);
  }
  if (f === 'campo_1' || f === 'sp_ethyleno' || f === 'ethylene') {
    return ultraorganicsEthyleneImei(panel);
  }
  if (
    f === 'humidity_set_point' ||
    f === 'relative_humidity' ||
    f === 'set_point_co2' ||
    f === 'co2_reading'
  ) {
    return ultraorganicsHumidityImei(panel);
  }
  return ultraorganicsEthyleneImei(panel);
}

export function ultraorganicsFanOutUnits(panelDeviceId) {
  const groups = ultraorganicsDeviceGroupsMap();
  const panel = String(panelDeviceId || '').trim();
  return groups[panel] ?? [panel];
}

const HUMIDITY_MERGE_KEYS = [
  'relative_humidity',
  'humidity_set_point',
  'humidity_control',
  'co2_reading',
  'set_point_co2',
];

/** Fusiona telemetría de humedad/CO₂ del IMEI companion en la fila del panel. */
export function packageUltraorganicsFleetRow(primaryRow, humidityRow, panelImei) {
  const panel = String(panelImei || '').trim();
  if (!primaryRow || typeof primaryRow !== 'object') return primaryRow;
  const humidityFlat = flatMaduradorRow(humidityRow);
  const humidityPatch = {};
  for (const key of HUMIDITY_MERGE_KEYS) {
    if (humidityFlat[key] != null) humidityPatch[key] = humidityFlat[key];
    else if (humidityRow?.[key] != null) humidityPatch[key] = humidityRow[key];
  }
  const merged = {
    ...primaryRow,
    imei: panel,
    device: primaryRow.device ?? panel,
    ...humidityPatch,
  };
  if (primaryRow.ultimo_dato && typeof primaryRow.ultimo_dato === 'object') {
    merged.ultimo_dato = { ...primaryRow.ultimo_dato, ...humidityPatch };
  } else if (Object.keys(humidityPatch).length > 0) {
    merged.ultimo_dato = { ...(merged.ultimo_dato ?? {}), ...humidityPatch };
  }
  return merged;
}

export function filterRowsByUltraorganicsPanel(rows, pickDeviceId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const order = ultraorganicsPanelImeis();
  const byImei = new Map();
  for (const row of rows) {
    const imei = String(pickDeviceId(row) || '').trim();
    if (imei) byImei.set(imei, row);
  }
  return order
    .map((panelId) => {
      const primary = byImei.get(ultraorganicsEthyleneImei(panelId)) ?? byImei.get(panelId);
      if (!primary) return null;
      const humidity = byImei.get(ultraorganicsHumidityImei(panelId));
      return packageUltraorganicsFleetRow(primary, humidity, panelId);
    })
    .filter(Boolean);
}
