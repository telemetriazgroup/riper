/** Cuenta demo Greenyard: dispositivos pin y filtros compartidos entre rutas. */

export function greenyardEmailLogin() {
  return String(process.env.GREENYARD_EMAIL || 'greenyard@riper.local').trim().toLowerCase();
}

export function isGreenyardFleetEmail(email) {
  return String(email || '').trim().toLowerCase() === greenyardEmailLogin();
}

export function greenyardEmpresaIdentificador() {
  const s = String(process.env.GREENYARD_IDENTIFICADOR || '4001').trim();
  return s || '4001';
}

/** IMEI visibles para Greenyard (orden fijo en listado). */
export function greenyardDeviceImeis() {
  const raw = process.env.GREENYARD_DEVICE_IMEIS || 'NEWY2001,NEWY1001';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isGreenyardDeviceId(deviceId) {
  const id = String(deviceId || '').trim();
  return id.length > 0 && greenyardDeviceImeis().includes(id);
}

export function filterRowsByGreenyardDeviceIds(rows, pickDeviceId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const allow = new Set(greenyardDeviceImeis());
  return rows.filter((row) => allow.has(String(pickDeviceId(row) || '').trim()));
}
