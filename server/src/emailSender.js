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
      provider: 'resend',
      enabled: false,
      has_api_key: false,
      api_key_hint: '',
      updated_at: null,
    };
  }
  const apiKey = String(row.api_key || '').trim();
  return {
    from_email: row.from_email || '',
    provider: row.provider || 'resend',
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

export async function sendConfiguredEmail({ to, subject, html }) {
  const cfg = await loadEmailConfig();
  if (!cfg?.enabled) throw new Error('email notifications disabled');
  const from = String(cfg.from_email || '').trim();
  const apiKey = String(cfg.api_key || '').trim();
  if (!from) throw new Error('from_email not configured');
  if (!apiKey) throw new Error('api_key not configured');
  const provider = String(cfg.provider || 'resend').toLowerCase();
  if (provider !== 'resend') {
    throw new Error(`unsupported provider: ${provider}`);
  }
  return sendEmailResend({ from, to, subject, html, apiKey });
}
