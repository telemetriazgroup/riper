import { getStoredUser } from '@/app/lib/auth';
import { isGourmetTunnelCommandDevice } from '@/app/lib/gourmet';

/** Cuenta demo: datos desde API Madurador (ver `maduradorFleetDirect.ts`). */
export const FLEET_DEMO_EMAIL = 'demo-flota@riper.local';

/** Demo Madurador: empresas upstream 6001 + 7001 (lista completa vía /madurador/dispositivos). */
export const DEMO_MADURADOR_EMAIL = 'demo-madurador@riper.local';

export function isDemoMaduradorSession(): boolean {
  const email = (getStoredUser()?.email ?? '').trim().toLowerCase();
  const envEmail =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as unknown as { env?: { VITE_DEMO_MADURADOR_EMAIL?: string } }).env
        ?.VITE_DEMO_MADURADOR_EMAIL)) ||
    DEMO_MADURADOR_EMAIL;
  return email === String(envEmail).trim().toLowerCase();
}

/** Flota ULTRAORGANICS: misma carga vía `identificador` (GET /api/v1/madurador/dispositivos → upstream listar_dispositivos…). */
export const ULTRAORGANICS_DEMO_EMAIL = 'ultraorganics@riper.local';

/** Orden fijo en el panel: un dispositivo por “familia” 1001 / 2001 / 3001. */
export const ULTRAORGANICS_PANEL_IMEIS = ['MEX1001', 'MEX2001', 'MEX3001'] as const;

/** IMEI visibles UltraOrganics (debe coincidir con servidor `ULTRAORGANICS_PANEL_IMEIS`). */
export function getUltraorganicsPanelImeis(): string[] {
  const raw =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as unknown as { env?: { VITE_ULTRAORGANICS_PANEL_IMEIS?: string } }).env
        ?.VITE_ULTRAORGANICS_PANEL_IMEIS)) ||
    'MEX1001,MEX2001,MEX3001';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Los 5 IMEI físicos (panel + companions). Debe coincidir con servidor `ultraorganicsAllPhysicalImeis()`. */
export function getUltraorganicsAllImeis(): string[] {
  const raw =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as unknown as { env?: { VITE_ULTRAORGANICS_ALL_IMEIS?: string } }).env
        ?.VITE_ULTRAORGANICS_ALL_IMEIS)) ||
    'MEX1001,MEX1002,MEX2001,MEX2002,MEX3001';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** IMEI panel para un IMEI físico del grupo (MEX1002 → MEX1001). */
export function getUltraorganicsPanelForImei(imei: string): string {
  const id = String(imei || '').trim();
  const panels = getUltraorganicsPanelImeis();
  if (panels.includes(id)) return id;
  const groups: Record<string, string[]> = {
    MEX1001: parseUltraorganicsGroupEnv('VITE_ULTRAORGANICS_DEVICE_1_IMEIS', 'MEX1001,MEX1002'),
    MEX2001: parseUltraorganicsGroupEnv('VITE_ULTRAORGANICS_DEVICE_2_IMEIS', 'MEX2001,MEX2002'),
    MEX3001: parseUltraorganicsGroupEnv('VITE_ULTRAORGANICS_DEVICE_3_IMEIS', 'MEX3001'),
  };
  for (const [panel, imeis] of Object.entries(groups)) {
    if (imeis.includes(id)) return panel;
  }
  return id;
}

function parseUltraorganicsGroupEnv(key: string, fallback: string): string[] {
  const raw =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key])) ||
    fallback;
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Cuenta ThermoKing: un solo equipo (empresa pin 3001). Login email por defecto; override con `VITE_THERMOKING_EMAIL`. */
export function thermoKingLoginEmail(): string {
  const raw =
    (typeof import.meta !== 'undefined' && ((import.meta as unknown as { env?: { VITE_THERMOKING_EMAIL?: string } }).env?.VITE_THERMOKING_EMAIL)) ||
    'thermoking@riper.local';
  return String(raw).trim().toLowerCase() || 'thermoking@riper.local';
}

/** IMEI del único equipo visible para ThermoKing (debe coincidir con servidor `THERMOKING_DEVICE_IMEI`). */
export function getThermoKingPinnedImei(): string {
  const raw =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as unknown as { env?: { VITE_THERMOKING_DEVICE_IMEI?: string } }).env?.VITE_THERMOKING_DEVICE_IMEI)) ||
    'PRUEBA_CA000001';
  return String(raw).trim() || 'PRUEBA_CA000001';
}

export function isThermoKingFleetEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === thermoKingLoginEmail().toLowerCase();
}

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

export function isThermoKingSession(): boolean {
  try {
    const u = getStoredUser();
    return isThermoKingFleetEmail(u?.email);
  } catch {
    return false;
  }
}

export function greenyardLoginEmail(): string {
  const raw =
    (typeof import.meta !== 'undefined' && ((import.meta as unknown as { env?: { VITE_GREENYARD_EMAIL?: string } }).env?.VITE_GREENYARD_EMAIL)) ||
    'greenyard@riper.local';
  return String(raw).trim().toLowerCase() || 'greenyard@riper.local';
}

export function isGreenyardFleetEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === greenyardLoginEmail().toLowerCase();
}

export function isGreenyardSession(): boolean {
  try {
    const u = getStoredUser();
    return isGreenyardFleetEmail(u?.email);
  } catch {
    return false;
  }
}

/** IMEI visibles para Greenyard (debe coincidir con servidor `GREENYARD_DEVICE_IMEIS`). */
export function getGreenyardPinnedImeis(): string[] {
  const raw =
    (typeof import.meta !== 'undefined' &&
      ((import.meta as unknown as { env?: { VITE_GREENYARD_DEVICE_IMEIS?: string } }).env?.VITE_GREENYARD_DEVICE_IMEIS)) ||
    'NEWY2001,NEWY1001';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Equipos con control automático de procesos vía upstream (Gourmet túnel + Greenyard + UltraOrganics TermoKing). */
export function isAutomatedControlDevice(deviceId?: string | null): boolean {
  if (!deviceId) return false;
  const id = String(deviceId).trim();
  if (isGourmetTunnelCommandDevice(id)) return true;
  if (isGreenyardSession() && getGreenyardPinnedImeis().includes(id)) return true;
  if (isUltraorganicsSession() && getUltraorganicsAllImeis().includes(id)) return true;
  return false;
}

