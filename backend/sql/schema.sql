-- ============================================================================
-- Sistema de Gestão de Obras — Schema Relacional (PostgreSQL)
-- Modelo conforme Seção 3.3 do artigo: Usuario, Obra, Etapa, HistoricoAlteracao,
-- Notificacao, DespesaObra, DocumentoObra.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ─── Usuario ────────────────────────────────────────────────────────────────
CREATE TABLE usuarios (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(150) NOT NULL,
  email              VARCHAR(150) NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  phone              VARCHAR(30),
  role               VARCHAR(30) NOT NULL
                       CHECK (role IN ('Administrativo','Engenheiro','Mestre de Obras','Visualizador','TI','Dono')),
  status             VARCHAR(10) NOT NULL DEFAULT 'Ativo'
                       CHECK (status IN ('Ativo','Inativo')),
  verified           BOOLEAN NOT NULL DEFAULT FALSE,
  verification_code  VARCHAR(6),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Obra ───────────────────────────────────────────────────────────────────
CREATE TABLE obras (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(150) NOT NULL,
  client          VARCHAR(150) NOT NULL,
  cep             VARCHAR(9),
  street          VARCHAR(200),
  neighborhood    VARCHAR(100),
  city            VARCHAR(100),
  state           VARCHAR(2),
  responsible_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'Em andamento'
                    CHECK (status IN ('Em andamento','Concluída','Paralisada')),
  progress        INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  start_date      DATE,
  end_date        DATE,
  area            NUMERIC(10,2),
  floors          INTEGER,
  units           INTEGER,
  team_size       INTEGER,
  estimated_cost  NUMERIC(14,2),
  client_budget   NUMERIC(14,2),
  tipo            VARCHAR(20) CHECK (tipo IN ('Residencial','Comercial','Industrial','Misto')),
  complexidade    VARCHAR(10) CHECK (complexidade IN ('Baixa','Média','Alta')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Etapa ──────────────────────────────────────────────────────────────────
CREATE TABLE etapas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  responsible_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  planned_start   DATE,
  planned_end     DATE,
  actual_end      DATE,
  progress        INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status          VARCHAR(20) NOT NULL DEFAULT 'Não iniciada'
                    CHECK (status IN ('Não iniciada','Em andamento','Concluída','Atrasada')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── DespesaObra ────────────────────────────────────────────────────────────
CREATE TABLE despesas_obra (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  etapa_id      UUID REFERENCES etapas(id) ON DELETE SET NULL,
  description   VARCHAR(200) NOT NULL,
  category      VARCHAR(30) NOT NULL
                  CHECK (category IN ('Materiais','Equipamentos','Mão de obra','Transporte','Serviços','Outros')),
  value         NUMERIC(14,2) NOT NULL,
  date          DATE NOT NULL,
  fornecedor    VARCHAR(150),
  notes         TEXT,
  receipt       TEXT,          -- base64 ou URL do comprovante
  receipt_name  VARCHAR(200),
  created_by    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── DocumentoObra ──────────────────────────────────────────────────────────
CREATE TABLE documentos_obra (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  type          VARCHAR(40) NOT NULL CHECK (type IN (
                  'Alvará de Construção','Alvará de Funcionamento','Licença Ambiental',
                  'ART/RRT','Projeto Aprovado','Matrícula do Imóvel','Habite-se',
                  'Contrato','Laudo Técnico','Outros'
                )),
  status        VARCHAR(15) NOT NULL DEFAULT 'Pendente'
                  CHECK (status IN ('Válido','Vencendo','Vencido','Pendente','Cancelado')),
  issue_date    DATE,
  expiry_date   DATE,
  notes         TEXT,
  file          TEXT,          -- base64 ou URL do arquivo
  file_name     VARCHAR(200),
  uploaded_by   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Notificacao ────────────────────────────────────────────────────────────
CREATE TABLE notificacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(10) NOT NULL CHECK (type IN ('success','warning','error','info')),
  message     TEXT NOT NULL,
  obra_id     UUID REFERENCES obras(id) ON DELETE CASCADE,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── HistoricoAlteracao (Audit Log) ────────────────────────────────────────
CREATE TABLE historico_alteracoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  user_name    VARCHAR(150),
  action       VARCHAR(10) NOT NULL CHECK (action IN ('Criou','Editou','Removeu')),
  module       VARCHAR(20) NOT NULL CHECK (module IN ('Obras','Etapas','Despesas','Documentos','Usuários')),
  target_name  VARCHAR(250),
  field        VARCHAR(60),
  old_value    TEXT,
  new_value    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX idx_etapas_obra_id            ON etapas(obra_id);
CREATE INDEX idx_etapas_status             ON etapas(status);
CREATE INDEX idx_etapas_planned_end        ON etapas(planned_end);
CREATE INDEX idx_despesas_obra_id          ON despesas_obra(obra_id);
CREATE INDEX idx_documentos_obra_id        ON documentos_obra(obra_id);
CREATE INDEX idx_notificacoes_obra_id      ON notificacoes(obra_id);
CREATE INDEX idx_notificacoes_read         ON notificacoes(read);
CREATE INDEX idx_historico_created_at      ON historico_alteracoes(created_at DESC);

-- ─── Usuário administrador inicial (senha: admin123 — troque depois do primeiro login) ──
-- Hash gerado com bcrypt (10 rounds). Gere o seu com: node -e "console.log(require('bcryptjs').hashSync('admin123',10))"
INSERT INTO usuarios (name, email, password_hash, phone, role, status, verified)
VALUES (
  'Administrador',
  'admin@obras.com',
  '$2a$10$Wu1ao1RW0v4oGfRAG74I5.xYZiPs1GEgJLOKQ5oWlyD1iXNWuzH6y', -- senha: admin123 — TROQUE após o primeiro login
  '(00) 00000-0000',
  'Administrativo',
  'Ativo',
  TRUE
);
