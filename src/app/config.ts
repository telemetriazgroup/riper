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

/**
 * API propia del sistema (usuarios, etc.). Sin barra final.
 * En desarrollo con Docker/Vite: suele ser `/ripener-api` (proxy → backend :4000).
 * En producción detrás de nginx: `/ripener-api` o URL absoluta.
 */
export const RIPENER_API_URL: string =
  (env?.VITE_RIPENER_API_URL as string) || 'http://localhost:4000';

/**
 * Si se define (URL absoluta o ruta tipo `/tunel-api/...`), el cliente llama ahí directamente.
 * Si no se define, se usa el proxy autenticado en Ripener: `GET /api/v1/tunel/grupo` (recomendado; evita CORS).
 */
export const VITE_TUNEL_GRUPO_URL_RAW: string | undefined = env?.VITE_TUNEL_GRUPO_URL as string | undefined;

/** Devuelve la URL base de la API (mismo valor que API_BASE_URL, por si se necesita en runtime). */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
