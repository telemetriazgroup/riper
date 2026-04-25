import type { Device } from '@/app/data';

/**
 * Clave estable para almacenar el alias: coincide con el identificador del equipo (p. ej. IMEI) sin espacios.
 * Debe usarse al guardar en API y al buscar en el mapa de sobrenombres; no es un alias legible.
 */
export function deviceNameStorageKey(id: string | undefined | null): string {
  if (id == null) return '';
  return String(id).trim();
}

function sobrenombreFromMap(sobrenombres: Record<string, string>, deviceKey: string): string | null {
  if (!deviceKey) return null;
  const raw = sobrenombres[deviceKey];
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw).trim();
}

/**
 * Etiqueta que ve el usuario: alias (sobrenombre) de la app, o si no, nombre de la API, o el id.
 * El IMEI/identificador de equipo (device.id) es otra cosa: va aparte, como referencia.
 */
export function resolveDeviceDisplayName(d: Device): string {
  const s = d.sobrenombre?.trim();
  if (s) return s;
  const api = d.nombreApi?.trim() || d.name?.trim() || d.id;
  return (api && api.trim()) || d.id;
}

/**
 * Aplica el mapa de sobrenombres (servidor + caché) a un dispositivo recién traído de la API.
 * Mantiene `nombreApi` fijado a lo que viene de la API; el alias no lo aporta el Madurador/TermoKing.
 */
export function applySobrenombresToDevice(d: Device, sobrenombres: Record<string, string>): Device {
  const deviceKey = deviceNameStorageKey(d.id) || d.id;
  const nombreApi = (d.nombreApi ?? d.name ?? d.id).toString().trim() || deviceKey;
  const sobrenombre = sobrenombreFromMap(sobrenombres, deviceKey);
  return {
    ...d,
    nombreApi,
    sobrenombre,
    name: sobrenombre ?? nombreApi,
  };
}

export function mergeDevicesWithSobrenombres(devices: Device[], sobrenombres: Record<string, string>): Device[] {
  return devices.map((d) => applySobrenombresToDevice(d, sobrenombres));
}
