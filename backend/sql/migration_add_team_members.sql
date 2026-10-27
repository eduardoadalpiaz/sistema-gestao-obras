-- Migração: adiciona a coluna com os nomes (opcionais) da equipe de cada obra.
-- Nas obras que já existem ela fica vazia.

-- acrescenta a lista de nomes da equipe (vazia nas obras antigas); IF NOT EXISTS evita erro se rodar 2 vezes
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS team_members TEXT[] DEFAULT '{}'::text[];
