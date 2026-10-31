-- Tenant access groups plus per-user provider/model defaults and access
-- overrides. Everything is nullable / defaulted so existing rows keep working
-- with the current "full access" behaviour.

ALTER TABLE organization ADD COLUMN default_provider TEXT;
ALTER TABLE organization ADD COLUMN default_model TEXT;

ALTER TABLE panel_user ADD COLUMN default_provider TEXT;
ALTER TABLE panel_user ADD COLUMN default_model TEXT;
ALTER TABLE panel_user ADD COLUMN access_overrides TEXT;
ALTER TABLE panel_user ADD COLUMN can_open_settings INTEGER;

CREATE TABLE IF NOT EXISTS access_group (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  access TEXT NOT NULL DEFAULT '{}',
  can_open_settings INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS access_group_org_idx ON access_group (org_id);

CREATE TABLE IF NOT EXISTS access_group_member (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS access_group_member_user_idx ON access_group_member (user_id);
