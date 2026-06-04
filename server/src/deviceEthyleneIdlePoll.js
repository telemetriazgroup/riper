/**
 * Consulta periódica de etileno (tipo 0, dato 1) en equipos en línea
 * cuando no hubo comandos a ese link en bitácora en ≥ 10 min.
 */
import { pool } from './db.js';
import { fetchDeviceRowByImei } from './tunnelCommandTelemetry.js';
import { isDeviceRowOnline } from './maduradorConnection.js';
import {
  deviceIdRelatesToImei,
  IDLE_COMMAND_QUIET_MS,
  lastCommandAtForImei,
  noteImeiCommandSent,
} from './deviceCommandLedger.js';
import { gourmetTradingEmpresaIdentificador, gourmetTradingMaduradorFleetImeis } from './gourmetFleet.js';
import { greenyardDeviceImeis, greenyardEmpresaIdentificador } from './greenyardFleet.js';
import {
  identificadorForUltraorganicsImei,
  ultraorganicsAllPhysicalImeis,
} from './ultraorganicsFleet.js';
import { sendEthylenePollCommand } from './tunelControlClient.js';
import { sendTermoKingEthylenePollCommand } from './termokingControlClient.js';
import { appendSessionTunnelEvent } from './tunnelEventLog.js';

let pollCursor = 0;

function listPollTargets() {
  const seen = new Set();
  const out = [];

  const add = (imei, identificador, fleet) => {
    const id = String(imei || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ imei: id, identificador, fleet });
  };

  for (const imei of gourmetTradingMaduradorFleetImeis()) {
    add(imei, gourmetTradingEmpresaIdentificador(), 'gourmet');
  }
  for (const imei of greenyardDeviceImeis()) {
    add(imei, greenyardEmpresaIdentificador(), 'greenyard');
  }
  for (const imei of ultraorganicsAllPhysicalImeis()) {
    add(imei, identificadorForUltraorganicsImei(imei), 'ultraorganics');
  }

  return out;
}

async function sendPollForTarget(target) {
  if (target.fleet === 'gourmet') {
    return sendEthylenePollCommand(target.imei);
  }
  return sendTermoKingEthylenePollCommand(target.imei);
}

async function appendIdlePollToBitacora(imei, poll) {
  const entry = {
    action: 'ethylene_idle_poll',
    source: 'idle_ethylene_poll',
    imei,
    tipo: 0,
    dato: 1,
    url: poll.url,
  };

  const { rows: sessions } = await pool.query(
    `SELECT id, device_id FROM app_device_control_sessions
     WHERE status = 'active' AND archived_at IS NULL`
  );
  for (const row of sessions) {
    if (!deviceIdRelatesToImei(row.device_id, imei)) continue;
    await appendSessionTunnelEvent(pool, row.id, entry).catch(() => {});
  }

  const { rows: tracking } = await pool.query(
    `SELECT id, payload FROM app_ripening_processes
     WHERE status = 'active' AND deleted_at IS NULL`
  );
  for (const row of tracking) {
    const deviceId = String(row.payload?.deviceId ?? '').trim();
    if (!deviceIdRelatesToImei(deviceId, imei)) continue;
    const payload = row.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
    const log = Array.isArray(payload.tunnelEventLog) ? [...payload.tunnelEventLog] : [];
    log.push({ at: new Date().toISOString(), ...entry });
    payload.tunnelEventLog = log.slice(-500);
    payload.tunnelSyncedAt = new Date().toISOString();
    await pool.query(
      `UPDATE app_ripening_processes SET payload = $1::jsonb, updated_at = now() WHERE id = $2::uuid`,
      [JSON.stringify(payload), row.id]
    );
  }
}

/** Evalúa equipos en round-robin; devuelve cuántos polls se enviaron. */
export async function processOnlineDeviceEthyleneIdlePolls(limit = 6) {
  const targets = listPollTargets();
  if (!targets.length) return 0;

  let polled = 0;
  const n = targets.length;
  let idx = pollCursor;
  for (let step = 0; step < n && polled < limit; step++, idx = (idx + 1) % n) {
    const target = targets[idx];

    const row = await fetchDeviceRowByImei(target.imei, target.identificador);
    if (!isDeviceRowOnline(row)) continue;

    const lastCmd = await lastCommandAtForImei(target.imei);
    if (lastCmd != null && Date.now() - lastCmd < IDLE_COMMAND_QUIET_MS) continue;

    try {
      const poll = await sendPollForTarget(target);
      noteImeiCommandSent(target.imei, poll);
      await appendIdlePollToBitacora(target.imei, poll);
      polled += 1;
    } catch (e) {
      console.warn('[ethylene-idle-poll]', target.imei, e.message);
    }
  }

  pollCursor = idx % n;
  return polled;
}
