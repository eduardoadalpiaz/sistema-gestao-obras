# Backend — Sistema de Gestão de Obras

API RESTful em **Node.js + Express + PostgreSQL**, conforme a arquitetura descrita no
artigo (Seção 3.2 e 3.3). Substitui a Edge Function do Supabase mantendo exatamente
o mesmo contrato de endpoints já usado pelo front-end (`construction-context.tsx`).

## Stack
- Node.js + Express (API RESTful)
- PostgreSQL (via `pg`) — banco relacional puro, sem Supabase
- JWT (`jsonwebtoken`) para autenticação
- bcrypt (`bcryptjs`) para hash de senha

## 1. Configurar o banco

Crie um banco PostgreSQL (local, Railway, Render, etc.) e rode o schema:

```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

Isso cria as tabelas `usuarios`, `obras`, `etapas`, `despesas_obra`,
`documentos_obra`, `notificacoes`, `historico_alteracoes` (com FKs, CASCADE e
índices) e insere um usuário administrador inicial:

- **email:** `admin@obras.com`
- **senha:** `admin123` (troque assim que logar pela primeira vez)

## 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com a `DATABASE_URL` do seu banco, um `JWT_SECRET` forte, e o
`CORS_ORIGIN` apontando para onde o front-end está rodando.

## 3. Instalar e rodar

```bash
npm install
npm run dev     # desenvolvimento (recarrega sozinho)
npm start       # produção
```

A API sobe em `http://localhost:3001` (ou a porta definida em `PORT`).

## 4. Deploy (conforme o artigo: Railway)

1. Suba este diretório `backend/` como um projeto no Railway (ou Render/Fly.io)
2. Adicione um serviço PostgreSQL no Railway e copie a `DATABASE_URL` gerada
3. Rode `sql/schema.sql` nesse banco (Railway tem um console SQL, ou use `psql`)
4. Configure as variáveis de ambiente do `.env.example` no painel do Railway
5. Copie a URL pública gerada pelo Railway (ex: `https://seu-app.up.railway.app`)

## 5. Único ajuste necessário no front-end

O front está correto e não precisa de nenhuma mudança de lógica — só aponta para
o endereço antigo do Supabase. Troque apenas a constante `API_BASE` em
`src/app/context/construction-context.tsx`:

```ts
// antes
const API_BASE = 'https://xvcineznlfvdkpujcgvp.supabase.co/functions/v1/server/make-server-19b26de2';

// depois
const API_BASE = 'https://seu-app.up.railway.app';
```

Todos os endpoints (`/data`, `/auth/login`, `/auth/verify`, `/users`, `/obras`,
`/stages`, `/gastos`, `/documentos`, `/notifications`, `/audit`) têm exatamente
o mesmo caminho e formato de resposta (JSON camelCase) que o front já espera —
por isso nenhuma outra linha do front precisa mudar.

## Endpoints

| Método | Rota                          | Descrição                          |
|--------|-------------------------------|-------------------------------------|
| GET    | /data                         | Carrega todos os dados iniciais     |
| POST   | /auth/login                   | Login (email + senha)               |
| POST   | /auth/verify                  | Verificação de conta por código     |
| POST   | /users                        | Criar usuário                       |
| PUT    | /users/:id                    | Atualizar usuário                   |
| DELETE | /users/:id                    | Remover usuário                     |
| POST   | /obras                        | Criar obra                          |
| PUT    | /obras/:id                    | Atualizar obra                      |
| DELETE | /obras/:id                    | Remover obra (cascade)              |
| POST   | /stages                       | Criar etapa                         |
| PUT    | /stages/:id                   | Atualizar etapa                     |
| DELETE | /stages/:id                   | Remover etapa                       |
| POST   | /gastos                       | Lançar despesa                      |
| PUT    | /gastos/:id                   | Atualizar despesa                   |
| DELETE | /gastos/:id                   | Remover despesa                     |
| POST   | /documentos                   | Anexar documento                    |
| PUT    | /documentos/:id                | Atualizar documento                 |
| DELETE | /documentos/:id                | Remover documento                   |
| POST   | /notifications                | Criar notificação                   |
| PUT    | /notifications/:id             | Marcar notificação como lida        |
| PUT    | /notifications/mark-all-read   | Marcar todas como lidas             |
| GET    | /audit                        | Listar histórico de alterações      |
| POST   | /audit                        | Registrar entrada de auditoria      |

## Princípios de Software Maduro

Referência rápida de onde cada pilar foi tratado no código — útil para a
seção de arquitetura do RFC/artigo.

| Pilar | Onde / como |
|---|---|
| **Desempenho** | `compression` (gzip nas respostas), pool de conexões dimensionado (`DB_POOL_MAX`), índices no schema (`obra_id`, `status`, `data_fim_prevista`) |
| **Escalabilidade** | Pool de conexões configurável por variável de ambiente; paginação opcional em `GET /audit` (`?page=1&pageSize=50`) sem quebrar quem não usa os parâmetros; rotas independentes por recurso facilitam extrair um recurso para um serviço próprio no futuro |
| **Disponibilidade** | `GET /health` testa o banco de verdade (`SELECT 1`), não só "processo de pé"; desligamento gracioso (`SIGTERM`/`SIGINT`) fecha conexões em andamento antes de encerrar, evitando respostas cortadas durante deploy |
| **Robustez** | Middleware de erro central (`errorHandler.js`) garante resposta estruturada para qualquer falha (validação do banco → 400, banco fora do ar → 503, erro genérico → 500) em vez de a API cair ou travar a conexão |
| **Extensibilidade** | API dividida em módulos por recurso (`src/routes/*.js`); adicionar um recurso novo = criar um arquivo de rota e montá-lo em `server.js`, sem tocar no resto |
| **Resiliência** | `db.js` faz retry automático (até 3 tentativas com backoff) em falhas transitórias de conexão (`ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`); erros de conexão ociosa no pool são capturados sem derrubar o processo |

**Teorema CAP:** o sistema prioriza **Consistência** sobre Disponibilidade
(CP) — usa um único banco PostgreSQL relacional, com transações ACID reais
(não é um banco distribuído com replicação multi-região). Em caso de
partição de rede entre a API e o banco, a API responde 503 (indisponível)
em vez de servir dados potencialmente desatualizados ou inconsistentes —
essa é uma escolha consciente e válida para um sistema de gestão de
obras/financeiro, onde uma leitura de custo acumulado errada é pior do que
uma indisponibilidade momentânea.

## Notas de segurança

- Senhas são armazenadas com hash bcrypt (o backend anterior comparava senha
  em texto puro — isso foi corrigido aqui).
- O front-end atual não envia o token JWT retornado no login em requisições
  seguintes (só usa `localStorage` para persistir a sessão). Por isso as rotas
  de escrita aqui **não exigem** `Authorization: Bearer <token>`, para
  continuar funcionando com o front sem nenhuma alteração. Se depois você
  quiser autenticação real por requisição, dá pra ligar isso — mas exigiria
  uma pequena mudança no front para enviar o token.
