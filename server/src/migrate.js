import 'dotenv/config';
import { pool } from './db.js';

const SQL_INITIAL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_active
  ON app_users (lower(email))
  WHERE deleted_at IS NULL;
`;

const SQL_ALTER = `
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS company VARCHAR(255) NOT NULL DEFAULT 'sin empresa';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(1024) NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN NOT NULL DEFAULT false;
`;

const SQL_CATALOG = `
CREATE TABLE IF NOT EXISTS app_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_products_name_active
  ON app_products (lower(name))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS app_recipes (
  id TEXT PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  fruit VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_recipes_deleted ON app_recipes (deleted_at);
`;

/** Actualiza CHECK de role para incluir superadmin */
async function migrateRoleConstraint(client) {
  await client.query(`
    ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
  `);
  await client.query(`
    ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
      CHECK (role IN ('superadmin', 'admin', 'operator', 'viewer'));
  `);
}

export async function runMigrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SQL_INITIAL);
    await client.query(SQL_ALTER);
    await client.query(SQL_CATALOG);
    await migrateRoleConstraint(client);
    await client.query('COMMIT');
    console.log('[migrate] OK');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('migrate.js')) {
  runMigrate()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
