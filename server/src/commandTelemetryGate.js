/**
 * Antes de enviar un comando: el último dato en vivo del equipo debe ser reciente
 * respecto al reloj del servidor (ambos en UTC/GMT equivalente).
 */
import {
  minutesSinceUtcMs,
  rowLastSeenMs,
} from './maduradorConnection.js';
import { fetchDeviceRowByImei } from './tunnelCommandTelemetry.js';

export const COMMAND_STALE_TELEMETRY_MINUTES = (() => {
  const n = Number(process.env.COMMAND_STALE_TELEMETRY_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 10;
})();

export class CommandTelemetryStaleError extends Error {
  /**
   * @param {string} message
   * @param {{ code: string, imei: string, ageMinutes: number|null, lastSeenUtcIso: string|null, serverNowUtcIso: string }} details
   */
  constructor(message, details) {
    super(message);
    this.name = 'CommandTelemetryStaleError';
    this.code = details.code;
    this.imei = details.imei;
    this.ageMinutes = details.ageMinutes;
    this.lastSeenUtcIso = details.lastSeenUtcIso;
    this.serverNowUtcIso = details.serverNowUtcIso;
    this.details = details;
  }
}

/**
 * Compara último dato (UTC) vs ahora del servidor (UTC).
 * @param {object|null|undefined} row
 * @param {number} [nowMs]
 */
export function evaluateLiveTelemetryForCommand(row, nowMs = Date.now()) {
  const serverNowUtcIso = new Date(nowMs).toISOString();
  const lastSeenMs = rowLastSeenMs(row);
  if (lastSeenMs == null || !Number.isFinite(lastSeenMs)) {
    return {
      ok: false,
      code: 'telemetry_missing',
      ageMinutes: null,
      lastSeenMs: null,
      lastSeenUtcIso: null,
      serverNowUtcIso,
      maxAgeMinutes: COMMAND_STALE_TELEMETRY_MINUTES,
    };
  }
  const ageMinutes = minutesSinceUtcMs(lastSeenMs, nowMs);
  const lastSeenUtcIso = new Date(lastSeenMs).toISOString();
  if (ageMinutes > COMMAND_STALE_TELEMETRY_MINUTES) {
    return {
      ok: false,
      code: 'telemetry_stale',
      ageMinutes,
      lastSeenMs,
      lastSeenUtcIso,
      serverNowUtcIso,
      maxAgeMinutes: COMMAND_STALE_TELEMETRY_MINUTES,
    };
  }
  return {
    ok: true,
    code: null,
    ageMinutes,
    lastSeenMs,
    lastSeenUtcIso,
    serverNowUtcIso,
    maxAgeMinutes: COMMAND_STALE_TELEMETRY_MINUTES,
  };
}

/**
 * Carga telemetría en vivo y exige frescura ≤ 10 min (UTC vs UTC).
 * @param {string} imei
 * @param {string} [identificador]
 */
export async function assertLiveTelemetryForCommand(imei, identificador) {
  const id = String(imei || '').trim();
  if (!id) throw new Error('imei required');
  const row = await fetchDeviceRowByImei(id, identificador);
  const check = evaluateLiveTelemetryForCommand(row);
  if (check.ok) return check;

  const ageTxt =
    check.ageMinutes != null && Number.isFinite(check.ageMinutes)
      ? `${Math.round(check.ageMinutes)} min`
      : 'desconocido';
  const msg =
    check.code === 'telemetry_missing'
      ? `No se envía comando: sin fecha de último dato en vivo (${id})`
      : `No se envía comando: último dato hace ${ageTxt} (> ${COMMAND_STALE_TELEMETRY_MINUTES} min). Equipo no conectado. último=${check.lastSeenUtcIso} servidor=${check.serverNowUtcIso} (UTC)`;

  throw new CommandTelemetryStaleError(msg, {
    code: check.code,
    imei: id,
    ageMinutes: check.ageMinutes,
    lastSeenUtcIso: check.lastSeenUtcIso,
    serverNowUtcIso: check.serverNowUtcIso,
    maxAgeMinutes: check.maxAgeMinutes,
  });
}

export function isCommandTelemetryStaleError(err) {
  return (
    err instanceof CommandTelemetryStaleError ||
    err?.name === 'CommandTelemetryStaleError' ||
    err?.code === 'telemetry_stale' ||
    err?.code === 'telemetry_missing'
  );
}
