/**
 * Cuenta BRAEDT: flota Madurador empresa 7001 (lista completa).
 * Control de procesos suspendido mientras se validan los equipos
 * (`BRAEDT_CONTROL_ENABLED=1` para habilitar).
 */

export function braedtEmailLogin() {
  return String(process.env.BRAEDT_EMAIL || 'braedt@riper.local').trim().toLowerCase();
}

export function isBraedtFleetEmail(email) {
  return String(email || '').trim().toLowerCase() === braedtEmailLogin();
}

export function braedtEmpresaIdentificador() {
  const s = String(process.env.BRAEDT_IDENTIFICADOR || '7001').trim();
  return s || '7001';
}

/**
 * Control panel / tunnel / device-control start bloqueados por defecto.
 * Superadmin no se ve afectado (usa su propia sesión).
 */
export function isBraedtControlSuspended(email) {
  if (!isBraedtFleetEmail(email)) return false;
  const v = process.env.BRAEDT_CONTROL_ENABLED;
  if (v != null && String(v).trim() !== '') {
    if (v === '1' || /^true$/i.test(String(v).trim())) return false;
  }
  return true;
}

/** Cualquier IMEI no vacío: la lista ya viene filtrada por empresa 7001 en /madurador. */
export function isBraedtDeviceId(deviceId) {
  return String(deviceId || '').trim().length > 0;
}

export function filterRowsByBraedtDeviceIds(rows, pickDeviceId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  /** Sin pin list: devolver filas tal cual (alcance = flota empresa 7001 del login). */
  return rows;
}
