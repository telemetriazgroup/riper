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

/** IMEI visibles para Gourmet Trading (orden fijo en listado). */
export function gourmetTradingDeviceImeis() {
  const raw = process.env.GOURMET_TRADING_DEVICE_IMEIS || '867856038562796,866262036100104';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isGourmetDeviceId(deviceId) {
  const id = String(deviceId || '').trim();
  return id.length > 0 && gourmetTradingDeviceImeis().includes(id);
}

export function filterRowsByGourmetDeviceIds(rows, pickDeviceId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const allow = new Set(gourmetTradingDeviceImeis());
  return rows.filter((row) => allow.has(String(pickDeviceId(row) || '').trim()));
}
