-- Uso agregado de provedores/modelos por sessão, enviado pelo AllCode Desktop
-- (calculado a partir das mensagens reais do agente) para relatórios de consumo.
ALTER TABLE session_audit ADD COLUMN model_usage TEXT NOT NULL DEFAULT '[]';
