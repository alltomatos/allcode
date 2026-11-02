-- Migration 0012: commercial plans (per-seat and fixed packages)

CREATE TABLE IF NOT EXISTS plan (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  pricing_mode TEXT NOT NULL DEFAULT 'per_user',
  price_cents INTEGER NOT NULL DEFAULT 0,
  included_users INTEGER,
  extra_user_price_cents INTEGER,
  min_users INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_active ON plan(is_active);

ALTER TABLE organization ADD COLUMN plan_id TEXT;

CREATE INDEX IF NOT EXISTS idx_organization_plan ON organization(plan_id);

INSERT INTO plan (id, name, slug, description, pricing_mode, price_cents, included_users, extra_user_price_cents, min_users, max_users, is_active, sort_order, created_at)
SELECT 'plan_user_65', 'Licença por Usuário', 'licenca-por-usuario',
       'Cobrança mensal por colaborador ativo.', 'per_user', 6500, NULL, NULL, 1, NULL, 1, 10,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM plan);
