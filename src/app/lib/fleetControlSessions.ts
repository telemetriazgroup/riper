import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import {
  getGreenyardPinnedImeis,
  getUltraorganicsAllImeis,
  getUltraorganicsPanelForImei,
  isGreenyardSession,
  isUltraorganicsSession,
} from '@/app/lib/fleetDemo';
import { getGourmetTradingFleetDeviceIds, isGourmetSession } from '@/app/lib/gourmet';
import { isGourmetTunnelGroupImei } from '@/app/lib/gourmetTunnelFleet';
import { GOURMET_TUNEL_DEVICE_ID } from '@/app/lib/tunelUnido';

/** Sesiones activas visibles para la flota del usuario actual. */
export function filterActiveControlSessionsForFleet(
  sessions: DeviceControlSessionRow[]
): DeviceControlSessionRow[] {
  let rows = sessions.filter((s) => s.status === 'active');
  if (isUltraorganicsSession()) {
    const allow = new Set(getUltraorganicsAllImeis());
    rows = rows.filter((s) => allow.has(String(s.device_id ?? '').trim()));
  } else if (isGreenyardSession()) {
    const allow = new Set(getGreenyardPinnedImeis());
    rows = rows.filter((s) => allow.has(String(s.device_id ?? '').trim()));
  } else if (isGourmetSession()) {
    const allow = new Set(getGourmetTradingFleetDeviceIds());
    rows = rows.filter((s) => allow.has(String(s.device_id ?? '').trim()));
  }
  return rows;
}

export function indexControlSessionsByDevice(
  sessions: DeviceControlSessionRow[]
): Map<string, DeviceControlSessionRow> {
  const m = new Map<string, DeviceControlSessionRow>();
  for (const s of filterActiveControlSessionsForFleet(sessions)) {
    const rawId = String(s.device_id ?? '').trim();
    if (!rawId) continue;
    const id = isUltraorganicsSession() ? getUltraorganicsPanelForImei(rawId) : rawId;
    if (!id) continue;
    if (!m.has(id)) m.set(id, s);
    if (isGourmetTunnelGroupImei(rawId) && !m.has(GOURMET_TUNEL_DEVICE_ID)) {
      m.set(GOURMET_TUNEL_DEVICE_ID, s);
    }
  }
  return m;
}
