import { getStoredUser } from '@/app/lib/auth';

/** Cuenta demo: datos desde API Madurador (ver `maduradorFleetDirect.ts`). */
export const FLEET_DEMO_EMAIL = 'demo-flota@riper.local';

export function isFleetDemoSession(): boolean {
  try {
    const u = getStoredUser();
    return (u?.email ?? '').toLowerCase() === FLEET_DEMO_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}
