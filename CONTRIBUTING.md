# Como contribuir

Obrigado por querer ajudar. Este guia mostra o caminho completo: rodar o sistema, testar e abrir um pull request.

## Como rodar

1. Instale Git, Node 22 e Docker.
2. Clone o repositório e copie o exemplo de variáveis:
   ```bash
   cp .env.producao.example .env
   ```
   Preencha os valores no `.env`. **Nunca** suba o `.env` para o GitHub.
3. Suba tudo com `docker compose up --build`, ou rode separado:
   ```bash
   cd backend  && npm ci && npm run dev
   cd frontend && npm ci && npm run dev
   ```
4. Crie as tabelas com `backend/sql/schema.sql` e o primeiro administrador com `backend/scripts/criar-admin.js` (passo a passo em `backend/README.md`).

## Como testar

```bash
cd backend  && npm run test:coverage
cd frontend && npm run test:coverage
```

* O back-end usa um PostgreSQL de verdade. Aponte `DATABASE_URL` para um banco cujo nome termine em `_test`, porque os testes apagam as tabelas e se recusam a rodar em outro banco.
* O CI exige cobertura de linhas de no mínimo **75%** no back-end e **25%** no front-end.
* Os testes do front rodam com Vitest e os do back com o executor nativo do Node (`node --test`).

## Como contribuir

1. Crie um branch a partir da `main` (`feat/...`, `fix/...` ou `docs/...`).
2. Siga o ciclo **TDD** em toda mudança de comportamento:
   1. escreva o teste que descreve o comportamento e confirme que ele **falha** (commit vermelho);
   2. escreva o código mínimo para ele passar (commit verde);
   3. refatore com os testes passando.
3. Abra o pull request contra a `main`. O CI roda testes, build das imagens e a análise do SonarQube; todos precisam ficar verdes.
4. Peça revisão de outra pessoa. Resolva os comentários com novos commits.
5. Faça o merge com **Create a merge commit** (sem squash), para o histórico mostrar o ciclo vermelho e verde.

Depois do merge na `main`, o deploy é automático: sobe o staging, confere o `/api/health` e só então atualiza a produção.

## Padrões

* Mensagens de commit curtas e claras: `feat:`, `fix:`, `test:`, `docs:`.
* Nenhum segredo no código: senhas, chaves e tokens ficam em variáveis de ambiente.
* Não use `git add .`; adicione só os arquivos da mudança.
* Texto de fora (corpo de requisição, resposta de API) nunca vai direto para logs, consultas ou HTML.
* O código deve passar no Quality Gate do SonarQube sem novos problemas.

## Encontrou um problema?

Abra uma *issue* descrevendo o que aconteceu, o que era esperado e como reproduzir. Para falhas de segurança, não publique detalhes na issue: fale direto com o autor.
