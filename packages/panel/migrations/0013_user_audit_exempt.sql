-- Isenção de auditoria de sessões para usuários com privilégios especiais (ex.: proprietários)
ALTER TABLE panel_user ADD COLUMN audit_exempt INTEGER NOT NULL DEFAULT 0;
