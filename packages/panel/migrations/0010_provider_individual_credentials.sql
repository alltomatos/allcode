-- Migration 0010: Provider protocol and individual collaborator credentials

ALTER TABLE provider_definition ADD COLUMN protocol TEXT NOT NULL DEFAULT 'openai';

CREATE TABLE IF NOT EXISTS user_provider_credential (
  user_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_user_provider_cred_user ON user_provider_credential(user_id);
