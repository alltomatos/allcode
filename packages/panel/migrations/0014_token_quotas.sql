-- Cotas de tokens: pool compartilhado da empresa + sub-limite individual.
ALTER TABLE organization ADD COLUMN token_quota INTEGER;
ALTER TABLE organization ADD COLUMN token_quota_cycle_day INTEGER NOT NULL DEFAULT 1;

ALTER TABLE panel_user ADD COLUMN token_quota INTEGER;

-- Consumo por sessão dentro do ciclo de faturamento. O UPSERT por session_id
-- mantém o total cumulativo da sessão sem duplicar quando a auditoria é
-- reenviada a cada turno.
CREATE TABLE IF NOT EXISTS token_usage_ledger (
  session_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  cycle_start TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_usage_ledger_org ON token_usage_ledger(org_id, cycle_start);
CREATE INDEX IF NOT EXISTS idx_token_usage_ledger_user ON token_usage_ledger(user_id, cycle_start);

-- Semeia o consumo do mês corrente a partir do histórico já existente.
INSERT INTO token_usage_ledger (session_id, org_id, user_id, tokens, cycle_start, updated_at)
SELECT session_id, org_id, user_id, tokens_total, date('now', 'start of month'), datetime('now')
FROM session_audit
WHERE started_at >= date('now', 'start of month')
ON CONFLICT(session_id) DO NOTHING;
