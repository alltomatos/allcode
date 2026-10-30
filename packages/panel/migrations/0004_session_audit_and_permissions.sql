-- Adicionar permissões granulares à tabela panel_user
ALTER TABLE panel_user ADD COLUMN can_use_agentui INTEGER NOT NULL DEFAULT 1;
ALTER TABLE panel_user ADD COLUMN can_use_routines INTEGER NOT NULL DEFAULT 1;
ALTER TABLE panel_user ADD COLUMN can_change_password INTEGER NOT NULL DEFAULT 1;

-- Tabela para auditoria executiva de sessões dos colaboradores
CREATE TABLE IF NOT EXISTS session_audit (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  title TEXT,
  summary TEXT NOT NULL,
  workspace TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  tokens_total INTEGER NOT NULL DEFAULT 0,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  tokens_reasoning INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  messages_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_audit_user ON session_audit(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_audit_org ON session_audit(org_id, started_at DESC);
