/**
 * Madurador de carne (p. ej. MAD_CARNE): sin inyección de etileno ni lectura CO₂.
 * Usa control de carnes (intercambio / renovación de aire) ya preparado en homogenización.
 */

const DEFAULT_MEAT_RIPENER_IDS = ['MAD_CARNE'];

function parseIdList(raw: string | undefined | null): string[] {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** IMEI / deviceId de maduradores de carne (+ opc. VITE_MEAT_RIPENER_DEVICE_IDS). */
export function meatRipenerDeviceIds(): string[] {
  const raw =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: { VITE_MEAT_RIPENER_DEVICE_IDS?: string } }).env
          ?.VITE_MEAT_RIPENER_DEVICE_IDS
      : undefined;
  const fromEnv = parseIdList(raw);
  const merged = [...DEFAULT_MEAT_RIPENER_IDS, ...fromEnv];
  const seen = new Set<string>();
  return merged.filter((id) => {
    const k = id.toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function normalizeDeviceId(deviceId: string | null | undefined): string {
  return String(deviceId || '').trim();
}

export function isMeatRipenerDevice(deviceId: string | null | undefined): boolean {
  const id = normalizeDeviceId(deviceId);
  if (!id) return false;
  const upper = id.toUpperCase();
  // ID canónico / variante con guiones bajos o espacios
  if (upper === 'MAD_CARNE' || upper.replace(/[\s-]+/g, '_') === 'MAD_CARNE') return true;
  if (upper.includes('MAD_CARNE') || upper.includes('MADCARNE')) return true;
  return meatRipenerDeviceIds().some((x) => {
    const t = String(x).trim().toUpperCase();
    return t === upper || upper.includes(t) || t.includes(upper);
  });
}

/** Sin etileno en UI / control / gráficas. */
export function deviceSupportsEthylene(deviceId: string | null | undefined): boolean {
  return !isMeatRipenerDevice(deviceId);
}

/** Sin CO₂ en UI de flota / detalle / maduración. */
export function deviceSupportsCo2(deviceId: string | null | undefined): boolean {
  return !isMeatRipenerDevice(deviceId);
}

/** Instalación / balón de etileno. */
export function deviceSupportsEthyleneInstallation(deviceId: string | null | undefined): boolean {
  return !isMeatRipenerDevice(deviceId);
}

/** Control de carnes (intercambio / renovación) forzado. */
export function deviceUsesMeatRipeningControl(deviceId: string | null | undefined): boolean {
  return isMeatRipenerDevice(deviceId);
}
