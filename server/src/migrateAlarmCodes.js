const SQL_ALARM_CODES = `
CREATE TABLE IF NOT EXISTS app_alarm_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code INT NOT NULL,
  title_es VARCHAR(500) NOT NULL,
  title_en VARCHAR(500) NOT NULL,
  description_es TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  corrective_action_es TEXT NOT NULL DEFAULT '',
  corrective_action_en TEXT NOT NULL DEFAULT '',
  model VARCHAR(64) NOT NULL DEFAULT 'MP4000',
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_alarm_codes_code_active
  ON app_alarm_codes (code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_app_alarm_codes_deleted ON app_alarm_codes (deleted_at);
`;

export { SQL_ALARM_CODES };
