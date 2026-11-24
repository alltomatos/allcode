-- Cota global por usuário definida pelo admin da empresa.
ALTER TABLE organization ADD COLUMN user_token_quota INTEGER;

-- Provedores globais registrados pelo superadmin ficam visíveis a todas as empresas.
ALTER TABLE provider_definition ADD COLUMN scope TEXT NOT NULL DEFAULT 'company';
CREATE INDEX IF NOT EXISTS provider_definition_scope_idx ON provider_definition(scope);
