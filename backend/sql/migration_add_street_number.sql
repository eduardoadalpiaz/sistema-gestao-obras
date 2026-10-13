-- Migração: número do endereço da obra (opcional). Pode rodar mais de uma vez sem problema.
ALTER TABLE obras ADD COLUMN IF NOT EXISTS street_number VARCHAR(20);
