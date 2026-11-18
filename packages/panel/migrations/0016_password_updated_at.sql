-- Registra quando o cadastro foi alterado pela ultima vez. A troca de senha
-- passa a exige-lo para confirmar que o UPDATE foi realmente persistido no D1.
ALTER TABLE panel_user ADD COLUMN updated_at TEXT;

UPDATE panel_user SET updated_at = created_at WHERE updated_at IS NULL;
