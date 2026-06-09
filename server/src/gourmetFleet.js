/** Cuenta demo Gourmet Trading: dispositivos pin y filtros compartidos entre rutas. */

export function gourmetTradingEmailLogin() {
  return String(process.env.GOURMET_TRADING_EMAIL || 'gourmettrading@ztrack.app').trim().toLowerCase();
}

export function isGourmetTradingFleetEmail(email) {
  return String(email || '').trim().toLowerCase() === gourmetTradingEmailLogin();
}

export function gourmetTradingEmpresaIdentificador() {
  const s = String(process.env.GOURMET_TRADING_IDENTIFICADOR || '5001').trim();
  return s || '5001';
}

/** IMEI lógicos para procesos / control (standalone + sensor etileno del túnel). */
export function gourmetTradingDeviceImeis() {
  const raw = process.env.GOURMET_TRADING_DEVICE_IMEIS || '867856038562796,866262036100104';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function gourmetTradingStandaloneImei() {
  return String(process.env.GOURMET_TRADING_STANDALONE_IMEI || '866262036100104').trim();
}

/** IMEI de las 5 máquinas del túnel (UNIT111…UNIT555). */
export function gourmetTradingTunnelUnitImeis() {
  const raw =
    process.env.GOURMET_TRADING_TUNEL_UNIT_IMEIS ||
    '868428040551750,860389052988223,868428047365683,867856038562796,866782049840560';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Filas Madurador para armar flota Gourmet (5 túnel + standalone). */
export function gourmetTradingMaduradorFleetImeis() {
  const tunnel = gourmetTradingTunnelUnitImeis();
  const standalone = gourmetTradingStandaloneImei();
  const seen = new Set();
  const out = [];
  for (const imei of [...tunnel, standalone]) {
    if (imei && !seen.has(imei)) {
      seen.add(imei);
      out.push(imei);
    }
  }
  return out;
}

export function isGourmetDeviceId(deviceId) {
  const id = String(deviceId || '').trim();
  return id.length > 0 && gourmetTradingDeviceImeis().includes(id);
}

export function gourmetTunnelDeviceId() {
  return String(process.env.GOURMET_TUNEL_DEVICE_ID || 'tunel:TUNEL_GREAT').trim();
}

/** IMEI con sensor de etileno / humedad / CO₂ (UNIT333). */
export function gourmetTunnelEthyleneImei() {
  return String(process.env.GOURMET_TUNEL_ETHYLENE_IMEI || '867856038562796').trim();
}

/** Alias: IMEI con sensores de humedad, CO₂ y etileno (UNIT333). */
export function gourmetTunnelSensorImei() {
  return gourmetTunnelEthyleneImei();
}

export function isGourmetTunnelAggregateDeviceId(deviceId) {
  return String(deviceId || '').trim() === gourmetTunnelDeviceId();
}

/** Dispositivos que aceptan POST /tunnel-commands (IMEI pin + túnel agregado). */
export function isGourmetTunnelCommandDeviceId(deviceId) {
  const id = String(deviceId || '').trim();
  return id.length > 0 && (gourmetTradingDeviceImeis().includes(id) || isGourmetTunnelAggregateDeviceId(id));
}

export function filterRowsByGourmetDeviceIds(rows, pickDeviceId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  return rows.filter((row) => isGourmetTunnelCommandDeviceId(String(pickDeviceId(row) || '').trim()));
}

/**
 * IDs equivalentes para seguimiento / control de panel (túnel agregado ↔ unidades del grupo).
 * El standalone (866262036100104) no se cruza con el túnel.
 */
export function gourmetLinkedDeviceIds(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) return [];
  const tunnelId = gourmetTunnelDeviceId();
  const units = gourmetTradingTunnelUnitImeis();
  const standalone = gourmetTradingStandaloneImei();
  const seen = new Set();
  const out = [];
  const push = (x) => {
    const k = String(x || '').trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  };
  if (id === standalone) {
    push(standalone);
    return out;
  }
  if (id === tunnelId || units.includes(id)) {
    push(tunnelId);
    for (const u of units) push(u);
    return out;
  }
  push(id);
  return out;
}
