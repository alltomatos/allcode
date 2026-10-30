CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sso_mode TEXT NOT NULL DEFAULT 'optional',
  offline_grace_hours INTEGER NOT NULL DEFAULT 72,
  session_max_age_hours INTEGER NOT NULL DEFAULT 12,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS panel_user (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS panel_user_org_status ON panel_user(org_id, status);

CREATE TABLE IF NOT EXISTS audit_event (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  result TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_event_at ON audit_event(at DESC);
CREATE INDEX IF NOT EXISTS audit_event_target ON audit_event(target_id, at DESC);
