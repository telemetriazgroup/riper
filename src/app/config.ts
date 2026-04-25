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

/**
 * Convierte una ruta pública o URL absoluta en la URL de cliente que el navegador debe usar.
 * - URLs absolutas se devuelven sin barra final.
 * - Rutas que empiezan con `/` se resuelven con el mismo origen.
 *   Si VITE_BASE_PATH es `/madurador/` y la API se configuró como `/ripener-api` (sin el prefijo),
 *   se antepone el base path para no llamar a `/{path}` (otro vhost, p. ej. otra app en :8080).
 */
function resolveClientApiUrl(value: string, absoluteFallback: string): string {
  const v = value?.trim() || absoluteFallback;
  if (!v) return absoluteFallback;
  if (/^https?:\/\//i.test(v)) {
    return v.replace(/\/$/, '');
  }
  const path = v.startsWith('/') ? v : `/${v}`.replace(/\/+/g, '/');
  if (typeof window === 'undefined') {
    return path;
  }
  const basePath = (env?.BASE_URL as string) || '/';
  const b = basePath === '/' || basePath === '' ? '' : String(basePath).replace(/\/$/, '');
  if (b === '') {
    return `${window.location.origin}${path}`.replace(/\/$/, '');
  }
  if (path === b || path.startsWith(`${b}/`)) {
    return `${window.location.origin}${path}`.replace(/\/$/, '');
  }
  return `${window.location.origin}${b}${path}`.replace(/\/$/, '');
}

/** URL base de la API TermoKing. Sin barra final. */
export const API_BASE_URL: string =
  (env?.VITE_API_BASE_URL as string) ||
  (env?.VITE_TERMOKING_API_URL as string) ||
  'http://localhost:9055';

const ripenerFromEnv: string = (env?.VITE_RIPENER_API_URL as string) || 'http://localhost:4000';

/**
 * API propia del sistema (usuarios, etc.). Sin barra final.
 * En desarrollo con Docker/Vite: suele ser `/ripener-api` (proxy → backend :4000).
 * En producción detrás de nginx: `/ripener-api` o URL absoluta.
 */
export const RIPENER_API_URL: string = resolveClientApiUrl(ripenerFromEnv, 'http://localhost:4000');

/**
 * Misma base que `RIPENER_API_URL` (útil si en el futuro hiciera falta leer de nuevo en runtime).
 */
export function getRipenerApiBase(): string {
  return RIPENER_API_URL;
}

/**
 * API Madurador para la cuenta demo: por defecto mismo origen vía Ripener
 * (`GET /api/v1/madurador-demo/Madurador/...` → servidor reenvía a MADURADOR_DEMO_API_BASE).
 * Así no hay CORS (nunca se llama a :9090 desde el navegador).
 * Override: VITE_MADURADOR_DEMO_API_URL (p. ej. `/madurador-demo` si usas solo proxy Vite a :9090).
 */
const maduradorFromEnv: string | undefined = env?.VITE_MADURADOR_DEMO_API_URL as string | undefined;
export const MADURADOR_DEMO_API_URL: string = maduradorFromEnv?.trim()
  ? resolveClientApiUrl(maduradorFromEnv, `${RIPENER_API_URL}/api/v1/madurador-demo`)
  : `${RIPENER_API_URL}/api/v1/madurador-demo`;

/** identificador de empresa en listar_dispositivos_proceso_identificador_empresa (cuenta demo). */
export const FLEET_DEMO_IDENTIFICADOR: string =
  (env?.VITE_FLEET_DEMO_IDENTIFICADOR as string) || '1010';

/**
 * Si se define (URL absoluta o ruta tipo `/tunel-api/...`), el cliente llama ahí directamente.
 * Si no se define, se usa el proxy autenticado en Ripener: `GET /api/v1/tunel/grupo` (recomendado; evita CORS).
 */
export const VITE_TUNEL_GRUPO_URL_RAW: string | undefined = env?.VITE_TUNEL_GRUPO_URL as string | undefined;

/** Devuelve la URL base de la API (mismo valor que API_BASE_URL, por si se necesita en runtime). */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
