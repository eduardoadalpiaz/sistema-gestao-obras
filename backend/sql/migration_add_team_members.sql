-- Migração: adiciona a coluna com os nomes (opcionais) da equipe de cada obra.
-- Nas obras que já existem ela fica vazia.

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS team_members TEXT[] DEFAULT '{}'::text[];
