-- Migração: adiciona o perfil "TI" à trava (CHECK) da coluna role,
-- sem precisar apagar/recriar a tabela usuarios nem os dados existentes.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'usuarios' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_role_check
    CHECK (role IN ('Administrativo','Engenheiro','Mestre de Obras','Visualizador','TI'));
END $$;
