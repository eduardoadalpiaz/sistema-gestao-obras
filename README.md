# Sistema de Gestão de Obras — Dal Piaz Incorporadora

[![CI](https://github.com/eduardoadalpiaz/sistema-gestao-obras/actions/workflows/ci.yml/badge.svg)](https://github.com/eduardoadalpiaz/sistema-gestao-obras/actions/workflows/ci.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=eduardoadalpiaz_sistema-gestao-obras&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=eduardoadalpiaz_sistema-gestao-obras)

Aplicação web para acompanhar as obras de uma incorporadora: etapas, andamento, prazos, gastos, documentos e equipe, com perfis de acesso e atualização em tempo real. Projeto de TCC / Portfólio da Católica SC.

| | Endereço |
|---|---|
| **Produção** | https://sistema-gestao-obras.northcentralus.cloudapp.azure.com |
| **Staging** (teste antes da produção) | https://sistema-gestao-obras.northcentralus.cloudapp.azure.com:8443 |
| **Wiki** (requisitos, C4, fluxos, deploy, testes) | https://github.com/eduardoadalpiaz/sistema-gestao-obras/wiki |

## Problema

Pequenas e médias incorporadoras costumam acompanhar obras por planilhas, grupos de mensagens e documentos espalhados. Isso gera informação desatualizada, atrasos difíceis de enxergar, custos pouco integrados e nenhuma rastreabilidade das alterações.

## O que o sistema faz

* Login com e-mail e senha e seis perfis de acesso (Administrativo, Engenheiro, Mestre de Obras, Visualizador, TI e Dono);
* Cadastro de obras com endereço preenchido pelo CEP e localização no mapa;
* Etapas com andamento (0–100%), andamento geral da obra e situação "No Prazo" ou "Atrasada";
* Estimativa de prazo de conclusão;
* Gastos com comprovante e comparação entre custo estimado e realizado;
* Documentos com validade (válido, vencendo, vencido);
* Painel com indicadores e relatórios em PDF e Excel;
* Histórico de auditoria (quem fez o quê e quando);
* Atualização em tempo real entre usuários e análise da obra por IA (extra).

A lista completa, com a situação de cada requisito, está na [Wiki](https://github.com/eduardoadalpiaz/sistema-gestao-obras/wiki).

## Tecnologias

React 18 + Vite + TypeScript + Tailwind · Node 22 + Express · PostgreSQL 16 · JWT + bcrypt · Docker Compose · Caddy (HTTPS automático) · Prometheus + Grafana · SonarQube Cloud · GitHub Actions · Azure (máquina virtual).

## Ambientes

| Ambiente | Onde roda | Para que serve |
|---|---|---|
| **Desenvolvimento** | no computador de quem desenvolve (`docker compose up --build`, ou back e front separados) | escrever e testar o código |
| **Staging** | na Azure, `docker-compose.staging.yml`, com banco e segredos próprios | receber cada versão primeiro e conferir se responde |
| **Produção** | na Azure, `docker-compose.yml` | o sistema usado de verdade |

A cada push na `main`, o GitHub Actions roda o CI. Se ele passar, o workflow Deploy sobe o staging, confere o `/api/health` e só então atualiza a produção. Se o staging falhar, a produção não é tocada.

## Como rodar

```bash
# banco + API + site
cp .env.producao.example .env      # preencha os valores (o .env nunca vai para o GitHub)
docker compose up --build
```

Sem Docker:

```bash
cd backend  && npm ci && npm run dev     # precisa de DATABASE_URL e JWT_SECRET
cd frontend && npm ci && npm run dev
```

O passo a passo do banco, do primeiro administrador e do deploy está em [`backend/README.md`](backend/README.md).

## Como testar

```bash
cd backend  && npm run test:coverage   # PostgreSQL real; o banco de teste precisa terminar em _test
cd frontend && npm run test:coverage
```

O CI falha se a cobertura de linhas ficar abaixo de **75%** no back-end ou de **25%** no front-end. Os números atuais ficam na página *Testes e Qualidade* da Wiki.

## Qualidade, observabilidade e segurança

* **CI/CD:** GitHub Actions (testes, build das imagens Docker, SonarQube Cloud e deploy automático).
* **Análise estática:** SonarQube Cloud com Quality Gate nos pull requests.
* **Observabilidade:** o back-end expõe métricas em `/metrics` (fechado para a internet), o Prometheus coleta e o Grafana mostra os painéis em `/grafana` (com login).
* **Segurança:** segredos só em variáveis de ambiente, HTTPS, senhas com bcrypt, rotas protegidas por JWT, Caddy sem rodar como root.

## Como contribuir

Veja o [`CONTRIBUTING.md`](CONTRIBUTING.md): como rodar, como testar, o ciclo de TDD e como abrir um pull request.

## Autor

Eduardo Alberto Dal Piaz — Universidade Católica de Santa Catarina.
