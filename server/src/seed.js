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

/** Usuario demo Gourmet Trading: datos locales desde data_gourmet.json (solo si no existe). */
export async function seedGourmetDemoUser() {
  const email = 'gourmettrading@ztrack.app';
  const { rows } = await pool.query(
    `SELECT id FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL`,
    [email]
  );
  if (rows.length === 0) {
    const password = process.env.GOURMET_DEMO_PASSWORD || 'GourmetDemo2026!';
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active, identificador)
       VALUES ($1, $2, 'viewer', $3, 'Gourmet Trading', false, true, '1001')`,
      ['Gourmet Trading', email, hash]
    );
    console.log(`[seed] gourmet demo user: ${email} (set GOURMET_DEMO_PASSWORD in production)`);
  }

  await pool.query(
    `UPDATE app_users SET identificador = '1001', updated_at = now()
     WHERE lower(email) = 'gourmettrading@ztrack.app' AND deleted_at IS NULL
       AND (identificador IS NULL OR btrim(identificador) = '')`
  );
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
