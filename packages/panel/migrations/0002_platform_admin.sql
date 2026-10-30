ALTER TABLE organization ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE organization ADD COLUMN max_users INTEGER NOT NULL DEFAULT 10;
ALTER TABLE organization ADD COLUMN contact_email TEXT;

ALTER TABLE panel_user ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0;

-- Marcar o utilizador inicial como superadmin da plataforma
UPDATE panel_user SET is_platform_admin = 1 WHERE email = 'ronaldodavi@gmail.com';
