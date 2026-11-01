-- Tenant provider catalog and per-scope allowlist.
-- provider_definition is the set of providers the tenant knows about (builtin or custom).
-- provider_grant is a sparse override: a missing row means "inherit".
ALTER TABLE organization ADD COLUMN provider_policy TEXT;
ALTER TABLE organization ADD COLUMN allow_local_providers INTEGER NOT NULL DEFAULT 1;

CREATE TABLE provider_definition (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'builtin',
  npm TEXT,
  base_url TEXT,
  api_key TEXT,
  models_json TEXT NOT NULL DEFAULT '[]',
  headers_json TEXT NOT NULL DEFAULT '[]',
  env_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX provider_definition_org_provider_idx ON provider_definition (org_id, provider_id);

CREATE TABLE provider_grant (
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  effect TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (scope, scope_id, provider_id)
);

CREATE INDEX provider_grant_scope_idx ON provider_grant (scope, scope_id);
