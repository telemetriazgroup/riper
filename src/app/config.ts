/**
 * Configuración centralizada de la aplicación.
 * Modificar la API desde un solo lugar: variables de entorno (Vite).
 *
 * Para evitar CORS en desarrollo:
 * - Definir VITE_API_BASE_URL=/api
 * - Definir VITE_API_PROXY_TARGET con la URL real del backend (ej. http://192.168.1.10:9055)
 * - El servidor de Vite hará proxy de /api hacia ese backend
 *
 * En producción: la API debe permitir el origen del frontend (CORS)
 * o servir ambos tras el mismo proxy inverso.
 */

const env = typeof import.meta !== 'undefined' && (import.meta as any).env;

/** URL base de la API TermoKing. Sin barra final. */
export const API_BASE_URL: string =
  (env?.VITE_API_BASE_URL as string) ||
  (env?.VITE_TERMOKING_API_URL as string) ||
  'http://localhost:9055';

/** Devuelve la URL base de la API (mismo valor que API_BASE_URL, por si se necesita en runtime). */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
