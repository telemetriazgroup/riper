import { pool } from './db.js';
import { sendConfiguredEmail } from './emailSender.js';
import {
  fetchDeviceRowByImei,
  readTelemetryField,
  rowImeiFromMaduradorRow,
} from './tunnelCommandTelemetry.js';
import { resolvePowerState } from './powerState.js';

export const EMAIL_EVENT_TYPES = [
  'manual_control',
  'process_start',
  'tracking_start',
  'phase_complete',
  'tracking_complete',
  'sampling',
];

const EVENT_LABELS = {
  manual_control: 'Control manual',
  process_start: 'Inicio de proceso',
  tracking_start: 'Inicio de seguimiento',
  phase_complete: 'Etapa / proceso completado',
  tracking_complete: 'Seguimiento completado',
  sampling: 'Registro de muestra',
};

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMetaLines(meta) {
  if (!meta || typeof meta !== 'object') return '';
  const skip = new Set(['deviceId']);
  const lines = [];
  for (const [k, v] of Object.entries(meta)) {
    if (skip.has(k) || v == null || v === '') continue;
    if (typeof v === 'object') {
      lines.push(`<tr><td style="padding:4px 12px 4px 0;color:#64748b;">${escHtml(k)}</td><td><pre style="margin:0;font-size:12px;">${escHtml(JSON.stringify(v, null, 2))}</pre></td></tr>`);
    } else {
      lines.push(`<tr><td style="padding:4px 12px 4px 0;color:#64748b;">${escHtml(k)}</td><td>${escHtml(String(v))}</td></tr>`);
    }
  }
  if (!lines.length) return '';
  return `<table style="font-size:14px;border-collapse:collapse;">${lines.join('')}</table>`;
}

function buildDeviceStatusSection(row) {
  if (!row) {
    return '<p style="color:#64748b;">Estado del dispositivo no disponible en este momento.</p>';
  }
  const imei = rowImeiFromMaduradorRow(row);
  const temp = readTelemetryField(row, 'set_point');
  const humidity = readTelemetryField(row, 'humidity_set_point');
  const ethylene = readTelemetryField(row, 'campo_1');
  const fan = readTelemetryField(row, 'avl');
  const flat = row.ultimo_dato && typeof row.ultimo_dato === 'object' ? { ...row, ...row.ultimo_dato } : row;
  const rawPs = flat.power_state ?? flat.ultimo_power_state ?? row.ultimo_power_state;
  const psNum = rawPs === 1 || rawPs === '1' ? 1 : rawPs === 0 || rawPs === '0' ? 0 : null;
  const powerResolved = resolvePowerState(flat, psNum);
  const powerLabel = powerResolved === 1 ? 'Encendido' : 'Apagado';
  const connection = flat.connection ?? flat.conexion ?? flat.online ?? null;

  const rows = [
    ['IMEI', imei || '—'],
    ['Temperatura set point', temp != null ? `${temp} °C` : '—'],
    ['Humedad set point', humidity != null ? `${humidity} %` : '—'],
    ['Etileno (campo_1)', ethylene != null ? String(ethylene) : '—'],
    ['Ventilación', fan != null ? `${fan} %` : '—'],
    ['Encendido / power', powerLabel],
    ['Conexión', connection != null ? String(connection) : '—'],
  ];
  const body = rows
    .map(
      ([label, val]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#64748b;white-space:nowrap;">${escHtml(label)}</td><td style="padding:6px 0;font-weight:500;">${escHtml(val)}</td></tr>`
    )
    .join('');
  return `<table style="font-size:14px;border-collapse:collapse;">${body}</table>`;
}

async function resolveRecipients(deviceId, eventType) {
  const { rows } = await pool.query(
    `SELECT DISTINCT r.email
     FROM app_email_groups g
     JOIN app_email_group_recipients r ON r.group_id = g.id
     JOIN app_email_group_devices d ON d.group_id = g.id
     WHERE g.active = TRUE
       AND d.device_id = $1
       AND g.events ? $2`,
    [deviceId, eventType]
  );
  return rows.map((r) => String(r.email || '').trim()).filter(Boolean);
}

async function fetchDeviceSnapshot(deviceId) {
  try {
    return await fetchDeviceRowByImei(deviceId);
  } catch (e) {
    console.error('[email] telemetry:', e.message);
    return null;
  }
}

function buildEmailHtml({ eventType, deviceId, meta, actorEmail, deviceRow }) {
  const label = EVENT_LABELS[eventType] || eventType;
  const when = new Date().toLocaleString('es-MX', { timeZone: 'UTC' }) + ' UTC';
  return `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:640px;">
  <h2 style="margin:0 0 8px;color:#1e40af;">Ripener — ${escHtml(label)}</h2>
  <p style="margin:0 0 16px;color:#64748b;">Notificación automática del sistema</p>
  <p><strong>Dispositivo:</strong> ${escHtml(deviceId)}</p>
  <p><strong>Acción:</strong> ${escHtml(label)}</p>
  ${actorEmail ? `<p><strong>Usuario:</strong> ${escHtml(actorEmail)}</p>` : ''}
  <p><strong>Fecha:</strong> ${escHtml(when)}</p>
  ${formatMetaLines(meta) ? `<h3 style="margin:24px 0 8px;font-size:15px;">Detalle</h3>${formatMetaLines(meta)}` : ''}
  <h3 style="margin:24px 0 8px;font-size:15px;">Estado actual de la máquina</h3>
  ${buildDeviceStatusSection(deviceRow)}
  <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e2e8f0;" />
  <p style="font-size:12px;color:#94a3b8;">Mensaje generado por Ripener. No responda a este correo.</p>
</body></html>`;
}

export async function notifyDeviceEvent({ deviceId, eventType, meta = {}, actorEmail = null }) {
  const id = String(deviceId || '').trim();
  if (!id) return { skipped: true, reason: 'no_device' };
  if (!EMAIL_EVENT_TYPES.includes(eventType)) {
    return { skipped: true, reason: 'invalid_event' };
  }

  const recipients = await resolveRecipients(id, eventType);
  if (!recipients.length) return { skipped: true, reason: 'no_recipients' };

  const deviceRow = await fetchDeviceSnapshot(id);
  const subject = `[Ripener] ${EVENT_LABELS[eventType] || eventType} — ${id}`;
  const html = buildEmailHtml({ eventType, deviceId: id, meta, actorEmail, deviceRow });

  await sendConfiguredEmail({ to: recipients, subject, html });
  return { sent: true, recipients: recipients.length };
}

/** Fire-and-forget wrapper for route handlers. */
export function fireEmailNotification(payload) {
  void notifyDeviceEvent(payload).catch((e) => {
    console.error('[email]', payload?.eventType, payload?.deviceId, e.message);
  });
}
