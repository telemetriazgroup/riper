import tls from 'node:tls';
import { pool } from './db.js';

export async function loadEmailConfig() {
  const { rows } = await pool.query(
    `SELECT from_email, api_key, provider, enabled, updated_at FROM app_email_config WHERE id = 1`
  );
  return rows[0] || null;
}

function maskApiKey(key) {
  const s = String(key || '').trim();
  if (!s) return '';
  if (s.length <= 4) return '****';
  return `****${s.slice(-4)}`;
}

export function configToPublic(row) {
  if (!row) {
    return {
      from_email: '',
      provider: 'gmail',
      enabled: false,
      has_api_key: false,
      api_key_hint: '',
      updated_at: null,
    };
  }
  const apiKey = String(row.api_key || '').trim();
  return {
    from_email: row.from_email || '',
    provider: row.provider || 'gmail',
    enabled: Boolean(row.enabled),
    has_api_key: apiKey.length > 0,
    api_key_hint: maskApiKey(apiKey),
    updated_at: row.updated_at,
  };
}

/**
 * Envía correo vía Resend HTTP API.
 * @param {{ from: string, to: string[], subject: string, html: string, apiKey: string }} opts
 */
export async function sendEmailResend({ from, to, subject, html, apiKey }) {
  const recipients = [...new Set(to.map((e) => String(e || '').trim()).filter(Boolean))];
  if (!recipients.length) {
    throw new Error('no recipients');
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html,
    }),
  });
  const text = await r.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!r.ok) {
    const msg =
      (body && typeof body === 'object' && (body.message || body.error)) ||
      text ||
      `HTTP ${r.status}`;
    throw new Error(String(msg));
  }
  return body;
}

function encodeSubject(subject) {
  const s = String(subject || '');
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function buildMimeMessage({ from, to, subject, html }) {
  const boundary = `riper_${Date.now().toString(36)}`;
  const toList = to.join(', ');
  const plain = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  return [
    `From: ${from}`,
    `To: ${toList}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    plain,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    String(html || ''),
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/**
 * Cliente SMTP mínimo (AUTH LOGIN) sobre TLS — Gmail App Password.
 * @param {{ host: string, port: number, user: string, pass: string, from: string, to: string[], subject: string, html: string }} opts
 */
export async function sendEmailSmtpTls(opts) {
  const { host, port, user, pass, from, to, subject, html } = opts;
  const recipients = [...new Set(to.map((e) => String(e || '').trim()).filter(Boolean))];
  if (!recipients.length) throw new Error('no recipients');

  const socket = await new Promise((resolve, reject) => {
    const s = tls.connect(
      { host, port, servername: host, rejectUnauthorized: true },
      () => resolve(s)
    );
    s.setEncoding('utf8');
    s.on('error', reject);
  });

  let buffer = '';
  const readResponse = () =>
    new Promise((resolve, reject) => {
      const tryParse = () => {
        const lines = [];
        let rest = buffer;
        for (;;) {
          const idx = rest.indexOf('\r\n');
          if (idx < 0) {
            buffer = rest;
            return false;
          }
          const line = rest.slice(0, idx);
          rest = rest.slice(idx + 2);
          if (!/^\d{3}[ -]/.test(line)) continue;
          lines.push(line);
          if (line.charAt(3) === ' ') {
            buffer = rest;
            resolve(lines);
            return true;
          }
        }
      };
      if (tryParse()) return;
      const onData = () => {
        if (tryParse()) {
          socket.off('data', onData);
          socket.off('error', onErr);
        }
      };
      const onErr = (e) => {
        socket.off('data', onData);
        reject(e);
      };
      socket.on('data', onData);
      socket.on('error', onErr);
    });

  const expect = async (code) => {
    const lines = await readResponse();
    const last = lines[lines.length - 1] || '';
    const c = Number(last.slice(0, 3));
    if (c !== code) throw new Error(`SMTP ${last}`);
    return lines;
  };

  const write = (cmd) =>
    new Promise((resolve, reject) => {
      socket.write(`${cmd}\r\n`, (err) => (err ? reject(err) : resolve()));
    });

  try {
    await expect(220);
    await write('EHLO ripener.local');
    await expect(250);
    await write('AUTH LOGIN');
    await expect(334);
    await write(Buffer.from(user, 'utf8').toString('base64'));
    await expect(334);
    await write(Buffer.from(pass, 'utf8').toString('base64'));
    await expect(235);
    await write(`MAIL FROM:<${from}>`);
    await expect(250);
    for (const rcpt of recipients) {
      await write(`RCPT TO:<${rcpt}>`);
      await expect(250);
    }
    await write('DATA');
    await expect(354);
    const mime = buildMimeMessage({ from, to: recipients, subject, html });
    await new Promise((resolve, reject) => {
      socket.write(`${mime.replace(/^\./gm, '..')}\r\n.\r\n`, (err) =>
        err ? reject(err) : resolve()
      );
    });
    await expect(250);
    await write('QUIT');
  } finally {
    try {
      socket.end();
    } catch {
      /* ignore */
    }
  }
  return { ok: true, provider: 'gmail', to: recipients };
}

/**
 * Gmail: correo remitente + contraseña de aplicación (Google Account → App passwords).
 */
export async function sendEmailGmail({ from, to, subject, html, appPassword }) {
  const user = String(from || '').trim();
  const pass = String(appPassword || '').replace(/\s+/g, '');
  if (!user) throw new Error('Gmail from email required');
  if (!pass) throw new Error('Gmail app password required');
  return sendEmailSmtpTls({
    host: 'smtp.gmail.com',
    port: 465,
    user,
    pass,
    from: user,
    to,
    subject,
    html,
  });
}

export async function sendConfiguredEmail({ to, subject, html }) {
  const cfg = await loadEmailConfig();
  if (!cfg?.enabled) throw new Error('email notifications disabled');
  const from = String(cfg.from_email || '').trim();
  const apiKey = String(cfg.api_key || '').trim();
  if (!from) throw new Error('from_email not configured');
  if (!apiKey) throw new Error('api_key / app password not configured');
  const provider = String(cfg.provider || 'gmail').toLowerCase();
  if (provider === 'gmail') {
    return sendEmailGmail({ from, to, subject, html, appPassword: apiKey });
  }
  if (provider === 'resend') {
    return sendEmailResend({ from, to, subject, html, apiKey });
  }
  throw new Error(`unsupported provider: ${provider}`);
}
