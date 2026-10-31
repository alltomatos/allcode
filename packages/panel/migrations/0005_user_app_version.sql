-- Tracks which AllCode Desktop build each collaborator is running so the tenant
-- portal can show the app version reported by the client.
ALTER TABLE panel_user ADD COLUMN app_version TEXT;
ALTER TABLE panel_user ADD COLUMN app_version_at TEXT;
