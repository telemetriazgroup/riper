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
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS identificador VARCHAR(64) NULL;
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

const SQL_RECIPE_SYSTEM = `
ALTER TABLE app_recipes ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;
`;

const SQL_RECIPE_VISUAL = `
ALTER TABLE app_recipes ADD COLUMN IF NOT EXISTS icon_key VARCHAR(64) NULL;
ALTER TABLE app_recipes ADD COLUMN IF NOT EXISTS custom_image_url VARCHAR(2048) NULL;
`;

const SQL_DEVICE_NAMES = `
CREATE TABLE IF NOT EXISTS app_user_device_names (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_app_user_device_names_user ON app_user_device_names (user_id);
`;

const SQL_PROCESS_FOLLOW = `
CREATE TABLE IF NOT EXISTS app_user_device_process_follow (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id VARCHAR(128) NOT NULL,
  proceso VARCHAR(128) NOT NULL DEFAULT '',
  id_proceso BIGINT NULL,
  fecha_inicio TIMESTAMPTZ NULL,
  hasta TIMESTAMPTZ NULL,
  progress INT NULL,
  numero_alarma INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_app_user_device_process_follow_user ON app_user_device_process_follow (user_id);
`;

const SQL_RIPENING_PROCESSES = `
CREATE TABLE IF NOT EXISTS app_ripening_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  display_name VARCHAR(500) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_ripening_user ON app_ripening_processes (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_app_ripening_created ON app_ripening_processes (created_at DESC) WHERE deleted_at IS NULL;
`;

const SQL_DEVICE_CONTROL = `
CREATE TABLE IF NOT EXISTS app_device_control_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id VARCHAR(128) NOT NULL,
  process_type VARCHAR(32) NOT NULL,
  display_label VARCHAR(500) NOT NULL DEFAULT '',
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  started_at TIMESTAMPTZ NOT NULL,
  estimated_end_at TIMESTAMPTZ NOT NULL,
  duration_hours NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dctrl_user_dev_active
  ON app_device_control_sessions (user_id, device_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_dctrl_user_created
  ON app_device_control_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dctrl_device
  ON app_device_control_sessions (device_id, status);
`;

const SQL_DEVICE_CONTROL_CANCEL_META = `
ALTER TABLE app_device_control_sessions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL;
ALTER TABLE app_device_control_sessions ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL;
`;

const SQL_DEVICE_CONTROL_ARCHIVE = `
ALTER TABLE app_device_control_sessions ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_dctrl_sessions_not_archived ON app_device_control_sessions (created_at DESC) WHERE archived_at IS NULL;
`;

/** Trazabilidad: solo inserción; no hay DELETE desde la aplicación. */
const SQL_AUDIT = `
CREATE TABLE IF NOT EXISTS app_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID NULL REFERENCES app_users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  actor_role VARCHAR(32),
  action VARCHAR(96) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(128),
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_app_audit_logs_created ON app_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_audit_logs_action ON app_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_app_audit_logs_entity ON app_audit_logs (entity_type, entity_id);
`;

const SQL_COMPANIES = `
CREATE TABLE IF NOT EXISTS app_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  ruc_id VARCHAR(64) NULL,
  address TEXT NULL,
  email VARCHAR(255) NULL,
  contact_name VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_companies_active_name ON app_companies (lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_app_companies_created ON app_companies (created_at DESC) WHERE deleted_at IS NULL;
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
    await client.query(SQL_RECIPE_SYSTEM);
    await client.query(SQL_RECIPE_VISUAL);
    await client.query(SQL_DEVICE_NAMES);
    await client.query(SQL_PROCESS_FOLLOW);
    await client.query(SQL_RIPENING_PROCESSES);
    await client.query(SQL_DEVICE_CONTROL);
    await client.query(SQL_DEVICE_CONTROL_CANCEL_META);
    await client.query(SQL_DEVICE_CONTROL_ARCHIVE);
    await client.query(SQL_AUDIT);
    await client.query(SQL_COMPANIES);
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
