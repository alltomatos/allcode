-- A auditoria passa a enviar o resumo executivo a cada turno do agente, então
-- cada sessão deve existir uma única vez e ser atualizada (UPSERT) por session_id.
DELETE FROM session_audit
WHERE rowid NOT IN (
  SELECT MAX(rowid) FROM session_audit GROUP BY session_id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_audit_session_id ON session_audit(session_id);
