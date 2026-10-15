// Regras de segurança dos arquivos de configuração: se alguém desfizer uma delas, o teste falha.
const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..", "..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");
const workflows = fs.readdirSync(path.join(raiz, ".github/workflows")).map((f) => `.github/workflows/${f}`);

describe("políticas de segurança (configuração)", () => {
  it("toda ação do GitHub Actions é travada pelo hash completo do commit", () => {
    for (const arquivo of workflows) {
      const usos = ler(arquivo).match(/uses:\s*\S+/g) || [];
      assert.ok(usos.length > 0, `${arquivo} sem ações`);
      for (const uso of usos) assert.match(uso, /@[0-9a-f]{40}$/, `${arquivo}: ${uso}`);
    }
  });

  it("npm ci usa --ignore-scripts no CI e nos Dockerfiles", () => {
    for (const arquivo of [".github/workflows/ci.yml", "backend/Dockerfile", "frontend/Dockerfile"]) {
      const comandos = ler(arquivo).match(/npm ci[^\n]*/g) || [];
      assert.ok(comandos.length > 0, `${arquivo} sem npm ci`);
      for (const comando of comandos) assert.match(comando, /--ignore-scripts/, `${arquivo}: ${comando}`);
    }
  });

  it("o CI não tem senha fixa no banco de teste", () => {
    assert.doesNotMatch(ler(".github/workflows/ci.yml"), /POSTGRES_PASSWORD|postgres:postgres@/);
  });

  it("o schema do banco não traz senha nem hash de usuário", () => {
    assert.doesNotMatch(ler("backend/sql/schema.sql"), /\$2[aby]\$\d\d\$/);
  });

  it("o front não usa Math.random (gerador fraco)", () => {
    assert.doesNotMatch(ler("frontend/src/app/components/ui/sidebar.tsx"), /Math\.random/);
  });

  it("os testes do back não têm senha fixa escrita no código", () => {
    assert.doesNotMatch(ler("backend/tests/helpers.js"), /PASSWORD\s*=\s*"[^"]*"\s*;/);
  });

  it("no CSS do front, todos os @import vêm antes do primeiro @source", () => {
    const linhas = ler("frontend/src/styles/tailwind.css").split("\n");
    const primeiroSource = linhas.findIndex((l) => l.startsWith("@source"));
    const ultimoImport = linhas.reduce((n, l, i) => (l.startsWith("@import") ? i : n), -1);
    assert.ok(primeiroSource >= 0 && ultimoImport >= 0);
    assert.ok(ultimoImport < primeiroSource, "@import depois de @source é posição inválida");
  });

  it("o setup dos testes do front rejeita a promessa sempre com um Error", () => {
    assert.doesNotMatch(ler("frontend/tests/setup.ts"), /reject\(leitor\.error\)/);
  });
});
