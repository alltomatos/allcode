-- Migration 0011: Resellers module, hierarchical tenancy, and trial lifecycle

CREATE TABLE IF NOT EXISTS reseller (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  commission_rate REAL NOT NULL DEFAULT 0.20,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reseller_slug ON reseller(slug);

ALTER TABLE organization ADD COLUMN reseller_id TEXT;
ALTER TABLE organization ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE organization ADD COLUMN trial_ends_at TEXT;
CREATE INDEX IF NOT EXISTS idx_organization_reseller ON organization(reseller_id);

ALTER TABLE panel_user ADD COLUMN is_reseller INTEGER NOT NULL DEFAULT 0;
ALTER TABLE panel_user ADD COLUMN reseller_id TEXT;
CREATE INDEX IF NOT EXISTS idx_panel_user_reseller ON panel_user(reseller_id);
