import bcrypt from 'bcryptjs';
import { pool } from './db.js';

/**
 * Crea el superusuario inicial si no existe ninguno con ese email.
 * Variables: SUPERUSER_EMAIL, SUPERUSER_PASSWORD (por defecto valores solo para desarrollo).
 */
export async function seedSuperuser() {
  const email = (process.env.SUPERUSER_EMAIL || 'superadmin@riper.local').trim().toLowerCase();
  const password = process.env.SUPERUSER_PASSWORD || 'changeme123';
  const name = process.env.SUPERUSER_NAME || 'Super Administrador';

  const { rows } = await pool.query(
    `SELECT id FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
  if (rows.length > 0) {
    console.log('[seed] superuser already exists');
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active)
     VALUES ($1, $2, 'superadmin', $3, 'sin empresa', true, true)`,
    [name, email, hash]
  );
  console.log(`[seed] superuser created: ${email} (change SUPERUSER_PASSWORD in production)`);
}

/** Usuario Gourmet Trading: Madurador identificador 5001, dos IMEI pin, rol admin. */
function gourmetTradingDefaultPassword() {
  return (
    process.env.GOURMET_TRADING_PASSWORD ||
    process.env.GOURMET_DEMO_PASSWORD ||
    '@gourmet2026!'
  );
}

/** `GOURMET_TRADING_SYNC_PASSWORD=1` fuerza la contraseña del README/env en cada arranque. */
function gourmetPasswordSyncForced() {
  const v = process.env.GOURMET_TRADING_SYNC_PASSWORD;
  return v === '1' || /^true$/i.test(String(v || '').trim());
}

async function syncGourmetTradingPassword(email) {
  const { rows } = await pool.query(
    `SELECT password_hash FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
  if (!rows.length) return;

  const newPw = gourmetTradingDefaultPassword();
  let shouldUpdate = gourmetPasswordSyncForced();

  if (!shouldUpdate) {
    const legacyPasswords = ['GourmetDemo2026!', 'GourmetDemo2026'];
    for (const legacy of legacyPasswords) {
      if (rows[0].password_hash && (await bcrypt.compare(legacy, rows[0].password_hash))) {
        shouldUpdate = true;
        break;
      }
    }
  }

  if (!shouldUpdate) return;

  const hash = await bcrypt.hash(newPw, 10);
  await pool.query(
    `UPDATE app_users SET password_hash = $1, active = true, updated_at = now()
     WHERE lower(email) = $2 AND deleted_at IS NULL`,
    [hash, email]
  );
  console.log(`[seed] Gourmet Trading password synced (${email})`);
}

export async function seedGourmetDemoUser() {
  const email = String(process.env.GOURMET_TRADING_EMAIL || 'gourmettrading@ztrack.app')
    .trim()
    .toLowerCase();
  const ident = String(process.env.GOURMET_TRADING_IDENTIFICADOR || '5001').trim() || '5001';
  const { rows } = await pool.query(
    `SELECT id FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
  if (rows.length === 0) {
    const password = gourmetTradingDefaultPassword();
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active, identificador)
       VALUES ($1, $2, 'admin', $3, 'Gourmet Trading', false, true, $4)`,
      ['Gourmet Trading', email, hash, ident]
    );
    console.log(`[seed] Gourmet Trading user: ${email} (set GOURMET_TRADING_PASSWORD in production)`);
  }

  await pool.query(
    `UPDATE app_users
        SET identificador = $2,
            role = 'admin',
            company = 'Gourmet Trading',
            active = true,
            updated_at = now()
      WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email, ident]
  );

  await syncGourmetTradingPassword(email);
}

/** Demo flota: dispositivos sintéticos en el front (todos los estados del panel / tarjetas). Sin identificador Madurador. */
export async function seedFleetDemoUser() {
  const email = 'demo-flota@riper.local';
  const { rows } = await pool.query(
    `SELECT id FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
  if (rows.length === 0) {
    const password = process.env.FLEET_DEMO_PASSWORD || 'DemoFlota2026!';
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active, identificador)
       VALUES ($1, $2, 'viewer', $3, 'Demo flota visual', false, true, '2001')`,
      ['Demo Flota (visual)', email, hash]
    );
    console.log(`[seed] fleet demo user: ${email} (set FLEET_DEMO_PASSWORD in production)`);
  }

  await pool.query(
    `UPDATE app_users SET identificador = '2001', updated_at = now()
     WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
}

/** ULTRAORGANICS: listado vía identificador 2001 (MADURADOR_API_BASE, p. ej. http://localhost:9059 en dev). Mismo patrón que demo-flota. */
export async function seedUltraorganicsUser() {
  const email = 'ultraorganics@riper.local';
  const { rows } = await pool.query(
    `SELECT id FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
  if (rows.length === 0) {
    const password = process.env.ULTRAORGANICS_DEMO_PASSWORD || 'UltraOrganics2026!';
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active, identificador)
       VALUES ($1, $2, 'viewer', $3, 'ULTRAORGANICS', false, true, '2001')`,
      ['ULTRAORGANICS', email, hash]
    );
    console.log(`[seed] ULTRAORGANICS user: ${email} (set ULTRAORGANICS_DEMO_PASSWORD in production)`);
  }

  await pool.query(
    `UPDATE app_users SET identificador = '2001', updated_at = now()
     WHERE lower(email) = $1 AND deleted_at IS NULL
       AND (identificador IS NULL OR btrim(identificador) = '')`,
    [email]
  );
}

/**
 * Equipo ULTRAORGANICS: mismos equipos que ultraorganics@riper.local (identificador 2001).
 * Sin alta/baja/edición de otros usuarios (controlado en api + ocultación de menú).
 * Overrides: RECEPCION_ULTRAORGANICS_PASSWORD, OPERACION_ULTRAORGANICS_PASSWORD, CALIDAD_ULTRAORGANICS_PASSWORD.
 */
export async function seedUltraorganicsTeamUsers() {
  const ident = '2001';
  const company = 'ULTRAORGANICS';

  const team = [
    {
      email: 'recepcionultraorganics@riper.local',
      name: 'Recepción ULTRAORGANICS',
      role: 'admin',
      password: process.env.RECEPCION_ULTRAORGANICS_PASSWORD || 'ultraorganics2026recepcion!',
    },
    {
      email: 'operacionultraorganics@riper.local',
      name: 'Operación ULTRAORGANICS',
      role: 'viewer',
      password: process.env.OPERACION_ULTRAORGANICS_PASSWORD || 'operacionultraorganics2026!',
    },
    {
      email: 'calidadultraorganics@riper.local',
      name: 'Calidad ULTRAORGANICS',
      role: 'viewer',
      password: process.env.CALIDAD_ULTRAORGANICS_PASSWORD || 'calidad2026ultraorganics!',
    },
  ];

  for (const u of team) {
    const em = u.email.trim().toLowerCase();
    const { rows } = await pool.query(
      `SELECT id FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
      [em]
    );
    if (rows.length > 0) continue;

    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active, identificador)
       VALUES ($1, $2, $3, $4, $5, false, true, $6)`,
      [u.name, em, u.role, hash, company, ident]
    );
    console.log(`[seed] ULTRAORGANICS team user created: ${em} (${u.role})`);
  }

  for (const u of team) {
    const em = u.email.trim().toLowerCase();
    await pool.query(
      `UPDATE app_users SET identificador = $1, company = $2, updated_at = now()
       WHERE lower(email) = $3 AND deleted_at IS NULL
         AND (identificador IS NULL OR btrim(identificador) = '')`,
      [ident, company, em]
    );
  }
}

/** Greenyard: empresa 4001, IMEI pin NEWY2001/NEWY1001, rol admin. */
export async function seedGreenyardUser() {
  const email = String(process.env.GREENYARD_EMAIL || 'greenyard@riper.local').trim().toLowerCase();
  const ident = String(process.env.GREENYARD_IDENTIFICADOR || '4001').trim() || '4001';
  const { rows } = await pool.query(
    `SELECT id FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
  if (rows.length === 0) {
    const password = process.env.GREENYARD_PASSWORD || 'greenyard2026!';
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active, identificador)
       VALUES ($1, $2, 'admin', $3, 'Greenyard', false, true, $4)`,
      ['Greenyard', email, hash, ident]
    );
    console.log(`[seed] Greenyard user: ${email} (set GREENYARD_PASSWORD in production)`);
  }

  await pool.query(
    `UPDATE app_users
        SET identificador = $2,
            role = 'admin',
            company = 'Greenyard',
            active = true,
            updated_at = now()
      WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email, ident]
  );
}

/** ThermoKing: empresa 3001, un solo IMEI (`THERMOKING_DEVICE_IMEI`, por defecto PRUEBA_CA000001). Contraseña vía THERMOKING_PASSWORD. */
export async function seedThermoKingUser() {
  const email = String(process.env.THERMOKING_EMAIL || 'thermoking@riper.local').trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT id FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
  if (rows.length === 0) {
    const password = process.env.THERMOKING_PASSWORD || 'thermoking2026!';
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active, identificador)
       VALUES ($1, $2, 'viewer', $3, 'ThermoKing CA', false, true, '3001')`,
      ['ThermoKing', email, hash]
    );
    console.log(`[seed] ThermoKing user: ${email} (set THERMOKING_PASSWORD in production)`);
  }

  await pool.query(
    `UPDATE app_users SET identificador = '3001', updated_at = now()
     WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
}
