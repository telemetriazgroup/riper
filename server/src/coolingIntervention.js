/**
 * Modo intervención Cooling (solo superadmin):
 * pausa la lógica automática sin detener el contador del proceso,
 * permite set_point / controlling_mode / defrost y devolver el control al automático.
 */
import { pool } from './db.js';
import { resolveProcessControlAdapter } from './processControlAdapter.js';
import { isCommandTelemetryStaleError } from './commandTelemetryGate.js';
import { appendTunnelEventLog } from './tunnelEventLog.js';
import { effectiveSessionParams } from './controlProcessParams.js';
import { formatTunnelDato } from './tunelControlClient.js';

export const INTERVENTION_ALLOWED_TIPOS = new Set([1, 8, 11]);

function nowIso() {
  return new Date().toISOString();
}

function parseParams(session) {
  return effectiveSessionParams(session);
}

async function loadActiveCoolingSession(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT * FROM app_device_control_sessions
     WHERE id = $1::uuid AND archived_at IS NULL`,
    [id]
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (row.status !== 'active') return null;
  if (String(row.process_type || '').trim() !== 'Cooling') return null;
  return row;
}

async function saveSessionParams(sessionId, nextParams) {
  await pool.query(
    `UPDATE app_device_control_sessions SET params = $1::jsonb, updated_at = now() WHERE id = $2::uuid`,
    [JSON.stringify(nextParams), sessionId]
  );
}

function commandTargets(adapter, deviceId, tipo) {
  if (adapter.commandImeis) return adapter.commandImeis(deviceId, tipo);
  return adapter.fanOutUnits(deviceId);
}

async function sendToTargets(adapter, deviceId, tipo, dato) {
  const targets = commandTargets(adapter, deviceId, tipo);
  const urls = [];
  for (const unitId of targets) {
    try {
      const sent = await adapter.sendCommand(unitId, tipo, dato);
      urls.push({ imei: unitId, url: sent.url, dato: sent.dato, ok: true });
    } catch (err) {
      if (isCommandTelemetryStaleError(err)) {
        urls.push({
          imei: unitId,
          skipped: true,
          ok: false,
          reason: err.code || 'telemetry_stale',
          ageMinutes: err.ageMinutes ?? err.details?.ageMinutes ?? null,
          lastSeenUtcIso: err.lastSeenUtcIso ?? err.details?.lastSeenUtcIso ?? null,
          serverNowUtcIso: err.serverNowUtcIso ?? err.details?.serverNowUtcIso ?? null,
          message: String(err.message || ''),
        });
        continue;
      }
      throw err;
    }
  }
  return urls;
}

function anySent(urls) {
  return Array.isArray(urls) && urls.some((u) => u && u.url && !u.skipped);
}

/**
 * Activa o desactiva intervención. No toca estimated_end_at.
 * @returns {Promise<object>} sesión actualizada
 */
export async function setCoolingInterventionActive(sessionId, { active, userEmail }) {
  const session = await loadActiveCoolingSession(sessionId);
  if (!session) {
    const err = new Error('Cooling session not found or not active');
    err.status = 404;
    throw err;
  }

  const params = parseParams(session);
  const auto =
    params.processAutomation && typeof params.processAutomation === 'object'
      ? { ...params.processAutomation }
      : {};

  const want = Boolean(active);
  const was = Boolean(auto.interventionActive);
  if (want === was) {
    return { ...session, params };
  }

  const email = String(userEmail || '').trim() || null;
  if (want) {
    auto.interventionActive = true;
    auto.interventionStartedAt = nowIso();
    auto.interventionStartedBy = email;
    auto.interventionEndedAt = null;
    auto.interventionEndedBy = null;
  } else {
    auto.interventionActive = false;
    auto.interventionEndedAt = nowIso();
    auto.interventionEndedBy = email;
    // Reanudar tick automático de inmediato.
    auto.nextActionAt = nowIso();
  }

  let nextParams = {
    ...params,
    processAutomation: auto,
    tunnelSyncedAt: nowIso(),
  };
  nextParams = {
    ...nextParams,
    tunnelEventLog: appendTunnelEventLog(nextParams, {
      source: 'intervention',
      action: want ? 'intervention_started' : 'intervention_ended',
      by: email,
      processType: 'Cooling',
      analysisEs: want
        ? 'Modo intervención activado: lógica Cooling en pausa; el contador del proceso continúa.'
        : 'Modo intervención finalizado: control devuelto al automático Cooling.',
    }),
  };

  await saveSessionParams(session.id, nextParams);
  const { rows } = await pool.query(`SELECT * FROM app_device_control_sessions WHERE id = $1::uuid`, [
    session.id,
  ]);
  const row = rows[0];
  row.params = nextParams;
  return row;
}

/**
 * Envía comando durante intervención (tipo 1 set, 8 defrost, 11 controlling_mode).
 */
export async function sendCoolingInterventionCommand(sessionId, { tipo, dato, userEmail }) {
  const session = await loadActiveCoolingSession(sessionId);
  if (!session) {
    const err = new Error('Cooling session not found or not active');
    err.status = 404;
    throw err;
  }

  const params = parseParams(session);
  const auto = params.processAutomation;
  if (!auto?.interventionActive) {
    const err = new Error('Intervention mode is not active');
    err.status = 409;
    throw err;
  }

  const t = Number(tipo);
  if (!INTERVENTION_ALLOWED_TIPOS.has(t)) {
    const err = new Error('tipo must be 1 (set_point), 8 (defrost) or 11 (controlling_mode)');
    err.status = 400;
    throw err;
  }

  let formatted;
  try {
    formatted = formatTunnelDato(t, dato);
  } catch {
    const err = new Error('invalid dato');
    err.status = 400;
    throw err;
  }

  if (t === 1) {
    const sp = Number(formatted);
    if (!Number.isFinite(sp) || sp < -40 || sp > 30) {
      const err = new Error('set_point out of range (−40…30 °C)');
      err.status = 400;
      throw err;
    }
  }
  if (t === 8) {
    formatted = 1;
  }
  if (t === 11) {
    const mode = Math.round(Number(formatted));
    if (!Number.isFinite(mode) || mode < 0 || mode > 20) {
      const err = new Error('controlling_mode out of range (0…20)');
      err.status = 400;
      throw err;
    }
    formatted = mode;
  }

  const adapter = resolveProcessControlAdapter(session.device_id);
  if (!adapter) {
    const err = new Error('No process control adapter for device');
    err.status = 400;
    throw err;
  }

  const urls = await sendToTargets(adapter, session.device_id, t, formatted);
  if (!anySent(urls)) {
    const err = new Error(
      urls[0]?.message || 'Command not sent: device telemetry stale or offline'
    );
    err.status = 409;
    err.urls = urls;
    throw err;
  }

  const email = String(userEmail || '').trim() || null;
  let action = 'intervention_setpoint';
  let analysisEs = `Intervención: set_point → ${formatted} °C.`;
  if (t === 8) {
    action = 'intervention_defrost';
    analysisEs = 'Intervención: envío DEFROST (tipo 8).';
  } else if (t === 11) {
    action = 'intervention_controlling_mode';
    analysisEs = `Intervención: controlling_mode → ${formatted} (tipo 11).`;
  }

  let nextParams = {
    ...params,
    processAutomation: {
      ...auto,
      interventionLastCommandAt: nowIso(),
      interventionLastTipo: t,
      interventionLastDato: formatted,
    },
    tunnelSyncedAt: nowIso(),
  };
  nextParams = {
    ...nextParams,
    tunnelEventLog: appendTunnelEventLog(nextParams, {
      source: 'intervention',
      action,
      by: email,
      tipo: t,
      dato: formatted,
      urls,
      processType: 'Cooling',
      analysisEs,
    }),
  };

  await saveSessionParams(session.id, nextParams);
  const { rows } = await pool.query(`SELECT * FROM app_device_control_sessions WHERE id = $1::uuid`, [
    session.id,
  ]);
  const row = rows[0];
  row.params = nextParams;
  return { session: row, urls, tipo: t, dato: formatted };
}
