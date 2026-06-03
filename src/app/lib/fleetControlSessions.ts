import type { DeviceControlSessionRow } from '@/app/lib/deviceControlProcessApi';
import {
  getGreenyardPinnedImeis,
  getUltraorganicsPanelImeis,
  isGreenyardSession,
  isUltraorganicsSession,
} from '@/app/lib/fleetDemo';
import { getGourmetTradingPinnedImeis, isGourmetSession } from '@/app/lib/gourmet';

/** Sesiones activas visibles para la flota del usuario actual. */
export function filterActiveControlSessionsForFleet(
  sessions: DeviceControlSessionRow[]
): DeviceControlSessionRow[] {
  let rows = sessions.filter((s) => s.status === 'active');
  if (isUltraorganicsSession()) {
    const allow = new Set(getUltraorganicsPanelImeis());
    rows = rows.filter((s) => allow.has(String(s.device_id ?? '').trim()));
  } else if (isGreenyardSession()) {
    const allow = new Set(getGreenyardPinnedImeis());
    rows = rows.filter((s) => allow.has(String(s.device_id ?? '').trim()));
  } else if (isGourmetSession()) {
    const allow = new Set(getGourmetTradingPinnedImeis());
    rows = rows.filter((s) => allow.has(String(s.device_id ?? '').trim()));
  }
  return rows;
}

export function indexControlSessionsByDevice(
  sessions: DeviceControlSessionRow[]
): Map<string, DeviceControlSessionRow> {
  const m = new Map<string, DeviceControlSessionRow>();
  for (const s of filterActiveControlSessionsForFleet(sessions)) {
    const id = String(s.device_id ?? '').trim();
    if (!id || m.has(id)) continue;
    m.set(id, s);
  }
  return m;
}
