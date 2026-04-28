import { getStoredUser } from '@/app/lib/auth';

/** Cuenta demo: datos desde API Madurador (ver `maduradorFleetDirect.ts`). */
export const FLEET_DEMO_EMAIL = 'demo-flota@riper.local';

/** Flota ULTRAORGANICS: misma carga vía `identificador` (GET /api/v1/madurador/dispositivos → upstream listar_dispositivos…). */
export const ULTRAORGANICS_DEMO_EMAIL = 'ultraorganics@riper.local';

/** Orden fijo en el panel: un dispositivo por “familia” 1001 / 2001 / 3001. */
export const ULTRAORGANICS_PANEL_IMEIS = ['MEX1001', 'MEX2001', 'MEX3001'] as const;

/** Cuentas de la flota ULTRAORGANICS (*.ultraorganics@riper.local); sin menú usuarios/ajustes; mismo acceso a equipos vía identificador. */
export function isUltraorganicsFleetEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith('ultraorganics@riper.local');
}

export function isFleetDemoSession(): boolean {
  try {
    const u = getStoredUser();
    return (u?.email ?? '').toLowerCase() === FLEET_DEMO_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}

export function isUltraorganicsSession(): boolean {
  try {
    const u = getStoredUser();
    return isUltraorganicsFleetEmail(u?.email);
  } catch {
    return false;
  }
}

