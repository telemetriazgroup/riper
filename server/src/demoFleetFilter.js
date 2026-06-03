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
import {
  filterRowsByUltraorganicsPanel,
  isUltraorganicsDeviceId,
  isUltraorganicsFleetEmail,
} from './ultraorganicsFleet.js';

/** Usuario demo con flota pin (Greenyard, Gourmet Trading, UltraOrganics). */
export function isPinnedFleetDemoEmail(email) {
  return (
    isGreenyardFleetEmail(email) ||
    isGourmetTradingFleetEmail(email) ||
    isUltraorganicsFleetEmail(email)
  );
}

export function isPinnedFleetDeviceId(email, deviceId) {
  if (isGreenyardFleetEmail(email)) return isGreenyardDeviceId(deviceId);
  if (isGourmetTradingFleetEmail(email)) return isGourmetTunnelCommandDeviceId(deviceId);
  if (isUltraorganicsFleetEmail(email)) return isUltraorganicsDeviceId(deviceId);
  return true;
}

export function filterRowsByPinnedFleetDeviceIds(email, rows, pickDeviceId) {
  if (isGreenyardFleetEmail(email)) return filterRowsByGreenyardDeviceIds(rows, pickDeviceId);
  if (isGourmetTradingFleetEmail(email)) return filterRowsByGourmetDeviceIds(rows, pickDeviceId);
  if (isUltraorganicsFleetEmail(email)) return filterRowsByUltraorganicsPanel(rows, pickDeviceId);
  return rows;
}

/** Recetas: estándar + creadas por el usuario (cuentas demo pin). */
export function isScopedRecipeDemoUser(req) {
  const role = req.user?.role;
  if (role === 'superadmin') return false;
  const email = req.user?.email;
  return isGreenyardFleetEmail(email) || isGourmetTradingFleetEmail(email) || isUltraorganicsFleetEmail(email);
}

export function scopedRecipeSql(userIdParamIndex) {
  return `(is_system IS TRUE OR created_by_user_id = $${userIdParamIndex}::uuid)`;
}
