import {
  filterRowsByGreenyardDeviceIds,
  isGreenyardDeviceId,
  isGreenyardFleetEmail,
} from './greenyardFleet.js';
import {
  filterRowsByGourmetDeviceIds,
  isGourmetTradingFleetEmail,
  isGourmetTunnelCommandDeviceId,
} from './gourmetFleet.js';

/** Usuario demo con flota pin (Greenyard, Gourmet Trading). */
export function isPinnedFleetDemoEmail(email) {
  return isGreenyardFleetEmail(email) || isGourmetTradingFleetEmail(email);
}

export function isPinnedFleetDeviceId(email, deviceId) {
  if (isGreenyardFleetEmail(email)) return isGreenyardDeviceId(deviceId);
  if (isGourmetTradingFleetEmail(email)) return isGourmetTunnelCommandDeviceId(deviceId);
  return true;
}

export function filterRowsByPinnedFleetDeviceIds(email, rows, pickDeviceId) {
  if (isGreenyardFleetEmail(email)) return filterRowsByGreenyardDeviceIds(rows, pickDeviceId);
  if (isGourmetTradingFleetEmail(email)) return filterRowsByGourmetDeviceIds(rows, pickDeviceId);
  return rows;
}

/** Recetas: estándar + creadas por el usuario (cuentas demo pin). */
export function isScopedRecipeDemoUser(req) {
  const role = req.user?.role;
  if (role === 'superadmin') return false;
  const email = req.user?.email;
  return isGreenyardFleetEmail(email) || isGourmetTradingFleetEmail(email);
}

export function scopedRecipeSql(userIdParamIndex) {
  return `(is_system IS TRUE OR created_by_user_id = $${userIdParamIndex}::uuid)`;
}
