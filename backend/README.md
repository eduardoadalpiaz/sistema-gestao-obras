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

Crie um banco PostgreSQL (local ou no Docker) e rode o schema:

```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

Isso cria as tabelas `usuarios`, `obras`, `etapas`, `despesas_obra`,
`documentos_obra`, `notificacoes`, `historico_alteracoes` (com FKs, CASCADE e
índices). Depois, crie o primeiro administrador com uma senha de 12 ou mais caracteres,
escolhida por você (ela não fica guardada em nenhum arquivo do projeto):

```bash
ADMIN_EMAIL=voce@empresa.com ADMIN_PASSWORD='sua-senha-longa-aqui' node scripts/criar-admin.js
```

O comando só cria o administrador se o banco ainda não tiver nenhum usuário.

## 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com a `DATABASE_URL` do seu banco, um `JWT_SECRET` forte, e o
`CORS_ORIGIN` apontando para onde o front-end está rodando.

### Análise por IA (opcional) — `GEMINI_API_KEY`

A tela de detalhes da obra tem um card "Análise Inteligente" que gera um resumo
curto da situação da obra usando a API do Google Gemini. A chamada é feita
**só pelo backend**; a chave nunca vai para o navegador.

1. Gere uma chave gratuita em https://aistudio.google.com/apikey
2. Local: coloque em `GEMINI_API_KEY` no `.env`. Servidor: arquivo `.env`
   do serviço do backend → `GEMINI_API_KEY` → **Deploy**.
3. (Opcional) `GEMINI_MODEL` troca o modelo (padrão: `gemini-3.5-flash-lite`).
   O Google desliga modelos antigos periodicamente — veja
   https://ai.google.dev/gemini-api/docs/deprecations se a análise começar a falhar.

Sem a chave configurada, o resto do sistema funciona normalmente.

## 3. Instalar e rodar

```bash
npm install
npm run dev     # desenvolvimento (recarrega sozinho)
npm start       # produção
```

A API sobe em `http://localhost:3001` (ou a porta definida em `PORT`).

## 4. Deploy (Azure + Docker Compose)

Em produção, tudo roda em uma máquina virtual na Azure (banco PostgreSQL, API, site com
Caddy, Prometheus e Grafana). Ao lado dela roda o **staging**, uma cópia com banco e
segredos próprios (`docker-compose.staging.yml`), que recebe cada versão antes da
produção. Na raiz do repositório:

1. Instale Docker e Git na máquina e clone o repositório
2. Copie `.env.producao.example` para `.env` e preencha `DOMAIN`, `POSTGRES_PASSWORD`,
   `JWT_SECRET` (e `GEMINI_API_KEY`, se usar a IA)
3. Suba tudo: `docker compose up -d --build`
4. Crie o banco rodando `backend/sql/schema.sql` (ou restaure um backup com `psql`)
5. Para o staging, preencha também `STAGING_POSTGRES_PASSWORD` e `STAGING_JWT_SECRET` no `.env`
   e abra a porta 8443 no firewall da VM
6. A cada push na `main`, o GitHub Actions roda o CI e, se passar, o workflow `Deploy`
   sobe o staging (`docker compose -f docker-compose.staging.yml up -d --build --wait`),
   confere o `/api/health` dele e só então atualiza a produção
   (segredos `SERVER_HOST`, `SERVER_USER` e `SERVER_SSH_KEY`)

O Caddy serve o site em HTTPS e encaminha `/api/*` para a API.

## 5. Endereço da API no front-end

O front lê o endereço da API da variável `VITE_API_BASE` (`src/app/utils/api.ts`).
Em produção o build usa `/api`; em desenvolvimento, sem a variável, usa
`http://localhost:3001`.

Todos os endpoints (`/data`, `/auth/login`, `/auth/verify`, `/users`, `/obras`,
`/stages`, `/gastos`, `/documentos`, `/notifications`, `/audit`) têm o formato de
resposta (JSON camelCase) que o front espera.

## Endpoints

Tudo exige login (header `Authorization: Bearer <token>`), menos `/health` e `/auth/*`.
A coluna "Quem pode" é conferida no servidor, a cada requisição.

| Método | Rota                          | Quem pode                                   | Descrição                          |
|--------|-------------------------------|---------------------------------------------|-------------------------------------|
| GET    | /health                       | público                                     | Checa o servidor e o banco          |
| POST   | /auth/login                   | público (8 erros → bloqueio de 15 min)      | Login (email + senha)               |
| POST   | /auth/verify                  | público, com o token do login               | Verificação de conta por código     |
| GET    | /data                         | qualquer logado                             | Dados iniciais (histórico só TI/Dono; código de verificação só Administrativo) |
| POST/PUT/DELETE | /users[/:id]         | Administrativo                              | Criar, editar e remover usuário     |
| POST/DELETE | /obras[/:id]             | Administrativo, Engenheiro                  | Criar e remover obra (cascade)      |
| PUT    | /obras/:id                    | Administrativo, Engenheiro; Mestre de Obras só o `progress` | Atualizar obra |
| POST/PUT/DELETE | /stages[/:id]        | Administrativo, Engenheiro, Mestre de Obras | Etapas do cronograma                |
| POST/PUT/DELETE | /gastos[/:id]        | todos menos Visualizador                    | Despesas (comprovante até 6 MB)     |
| POST/PUT/DELETE | /documentos[/:id]    | todos menos Visualizador                    | Documentos (arquivo até 6 MB)       |
| POST   | /notifications                | qualquer logado                             | Criar notificação                   |
| PUT    | /notifications/:id             | qualquer logado                             | Marcar como lida                    |
| PUT    | /notifications/mark-all-read   | qualquer logado                             | Marcar todas como lidas             |
| GET    | /audit                        | TI, Dono                                    | Histórico de alterações             |
| POST   | /audit                        | qualquer logado (autor vem do login)        | Registrar entrada no histórico      |
| POST   | /ai/analyze-obra              | qualquer logado (8/min e 60/dia por usuário)| Análise por IA (Gemini)             |

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

## Segurança

- **Login em todas as rotas.** O token (JWT, 8 horas) é conferido a cada requisição e o usuário é
  buscado no banco na hora: se alguém for desativado ou mudar de perfil, vale imediatamente.
- **Perfis no servidor.** As permissões da tabela acima são conferidas no backend (a tela só esconde
  botões). Quem não tem permissão recebe 403.
- **Senhas** com hash bcrypt (mínimo de 8 caracteres). O hash nunca sai do backend.
- **Tentativas limitadas.** 8 senhas erradas por IP+e-mail e 5 códigos de verificação errados
  bloqueiam por 15 minutos. Há também um limite geral por IP e um limite para a IA.
- **Verificação de conta** só funciona com o token curto (15 min) que o login entrega depois de
  conferir a senha.
- **SQL.** Os valores vão como parâmetros e os nomes de coluna aceitos ficam numa lista fixa
  (`repo.js`); o que não está na lista é descartado.
- **Arquivos.** Só JPG, PNG, WEBP, GIF e PDF, conferindo o conteúdo (não só o nome). SVG e HTML
  são recusados. O front reduz fotos antes de enviar.
- **Variáveis importantes:** `JWT_SECRET` (longo e aleatório; sem ele o servidor usa um temporário
  e os logins caem a cada reinício) e `CORS_ORIGIN` (endereço do front). Para gerar o segredo:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- **Primeiro administrador:** crie com `node scripts/criar-admin.js` (veja a seção 1); não existe mais senha padrão.
- **Conferir o sistema publicado:** `./verificar-producao.sh https://seu-dominio https://seu-dominio/api`
  (na raiz do projeto) faz as consultas de segurança (login obrigatório, CORS, cabeçalhos,
  senha padrão e segredos no código do front) e mostra OK, ATENÇÃO ou FALHA.
- **Banco antigo:** rode `sql/migration_add_team_members.sql` e `sql/migration_add_dono_role.sql`
  (a segunda garante que o perfil "Dono" seja aceito pelo banco; pode rodar mais de uma vez).
- O histórico de alterações é gravado com o autor vindo do login, não do corpo da requisição.
