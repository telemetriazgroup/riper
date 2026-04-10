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
  if (rows.length > 0) return;

  const password = process.env.GOURMET_DEMO_PASSWORD || 'GourmetDemo2026!';
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO app_users (name, email, role, password_hash, company, is_superuser, active)
     VALUES ($1, $2, 'viewer', $3, 'Gourmet Trading', false, true)`,
    ['Gourmet Trading', email, hash]
  );
  console.log(`[seed] gourmet demo user: ${email} (set GOURMET_DEMO_PASSWORD in production)`);
}
