// Documentação mínima do repositório: se alguém apagar ou esvaziar um destes itens, o teste falha.
const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..", "..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");
const PRODUCAO = "https://sistema-gestao-obras.northcentralus.cloudapp.azure.com";

describe("README do repositório", () => {
  const readme = ler("README.md");

  it("mostra o sistema no ar (produção e staging) e a Wiki", () => {
    assert.ok(readme.includes(PRODUCAO), "link da produção");
    assert.ok(readme.includes(`${PRODUCAO}:8443`), "link do staging");
    assert.match(readme, /\/wiki/);
  });

  it("não fala mais como proposta: o sistema já está implementado", () => {
    assert.doesNotMatch(readme, /Funcionalidades previstas|Tecnologias previstas|Resultados esperados|fase de proposta/);
  });

  it("explica como rodar, testar e como é o CI/CD e a observabilidade", () => {
    for (const trecho of ["docker compose up", "npm run test:coverage", "GitHub Actions", "Prometheus", "Grafana", "SonarQube"]) {
      assert.ok(readme.includes(trecho), `falta no README: ${trecho}`);
    }
  });

  it("descreve os três ambientes e aponta o guia de contribuição", () => {
    for (const trecho of ["Desenvolvimento", "Staging", "Produção", "CONTRIBUTING.md"]) {
      assert.ok(readme.includes(trecho), `falta no README: ${trecho}`);
    }
  });
});

describe("guia de contribuição (CONTRIBUTING.md)", () => {
  const guia = ler("CONTRIBUTING.md");

  it("tem os passos para rodar, testar e abrir pull request", () => {
    for (const titulo of ["## Como rodar", "## Como testar", "## Como contribuir", "## Padrões"]) {
      assert.ok(guia.includes(titulo), `falta a seção: ${titulo}`);
    }
  });

  it("explica o TDD, as metas de cobertura e o cuidado com segredos", () => {
    assert.match(guia, /TDD/);
    assert.match(guia, /75%/);
    assert.match(guia, /25%/);
    assert.match(guia, /\.env/);
  });
});

describe("README do back-end", () => {
  it("o deploy cita o staging antes da produção", () => {
    const readme = ler("backend/README.md");
    assert.match(readme, /docker-compose\.staging\.yml/);
  });
});
