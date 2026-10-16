// Ambientes separados: desenvolvimento (local), staging (teste na nuvem) e produção.
// Estes testes leem os arquivos de configuração e falham se o staging for desfeito.
const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..", "..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

describe("ambiente de staging (configuração)", () => {
  it("existe um compose próprio do staging, com banco e volume separados da produção", () => {
    const staging = ler("docker-compose.staging.yml");
    assert.match(staging, /name:\s*obras-staging/);
    assert.match(staging, /pgdata_staging:/);
    assert.doesNotMatch(staging, /^\s+- pgdata:/m, "staging não pode usar o volume da produção");
  });

  it("o staging usa segredos próprios, diferentes dos da produção", () => {
    const staging = ler("docker-compose.staging.yml");
    assert.match(staging, /STAGING_JWT_SECRET/);
    assert.match(staging, /STAGING_POSTGRES_PASSWORD/);
    assert.doesNotMatch(staging, /\$\{JWT_SECRET\}|\$\{POSTGRES_PASSWORD\}/);
  });

  it("o staging não publica portas na internet (só a produção encaminha)", () => {
    assert.doesNotMatch(ler("docker-compose.staging.yml"), /^\s+ports:/m);
  });

  it("o staging sobe o schema do banco e tem Caddy simples na porta 8081", () => {
    const staging = ler("docker-compose.staging.yml");
    assert.match(staging, /backend\/sql\/schema\.sql:\/docker-entrypoint-initdb\.d/);
    assert.match(staging, /Caddyfile\.staging/);
    assert.match(ler("frontend/Caddyfile.staging"), /http:\/\/:8081/);
  });

  it("o Caddy da produção encaminha {$DOMAIN}:8443 para o staging", () => {
    const caddy = ler("frontend/Caddyfile");
    assert.match(caddy, /\{\$DOMAIN\}:8443\s*\{/);
    assert.match(caddy, /reverse_proxy staging-web:8081/);
  });

  it("a produção publica a porta 8443 e enxerga a rede do staging", () => {
    const prod = ler("docker-compose.yml");
    assert.match(prod, /"8443:8443"/);
    assert.match(prod, /obras-staging-net/);
  });

  it("o deploy sobe o staging, confere se ficou saudável e só depois atualiza a produção", () => {
    const deploy = ler(".github/workflows/deploy.yml");
    const staging = deploy.indexOf("docker-compose.staging.yml up");
    const conferencia = deploy.indexOf("/api/health");
    const producao = deploy.search(/docker compose up -d --build/);
    assert.ok(staging > 0, "deploy não sobe o staging");
    assert.ok(conferencia > staging, "deploy não confere o staging");
    assert.ok(producao > conferencia, "produção precisa vir depois da conferência");
    assert.match(deploy, /set -e|script_stop:\s*true/, "erro no staging tem que parar o deploy");
  });

  it("o exemplo de .env documenta as variáveis do staging", () => {
    const exemplo = ler(".env.producao.example");
    assert.match(exemplo, /STAGING_POSTGRES_PASSWORD=/);
    assert.match(exemplo, /STAGING_JWT_SECRET=/);
  });
});
