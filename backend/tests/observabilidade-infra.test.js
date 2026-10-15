// Testes da infraestrutura de observabilidade: lê os arquivos de configuração e confere as regras.
const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..", "..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

describe("observabilidade (infraestrutura)", () => {
  it("o Prometheus lê as métricas da API pela rede interna", () => {
    const prometheus = ler("observability/prometheus.yml");
    assert.match(prometheus, /api:3001/);
    assert.match(prometheus, /metrics_path:\s*\/metrics/);
  });

  it("o Prometheus e o Grafana existem no docker-compose e o Prometheus não é exposto na internet", () => {
    const compose = ler("docker-compose.yml");
    assert.match(compose, /^\s{2}prometheus:/m);
    assert.match(compose, /^\s{2}grafana:/m);
    const trechoPrometheus = compose.split(/^\s{2}prometheus:/m)[1].split(/^\s{2}grafana:/m)[0];
    assert.doesNotMatch(trechoPrometheus, /ports:/);
  });

  it("o Grafana exige senha vinda do .env e não aceita acesso anônimo", () => {
    const compose = ler("docker-compose.yml");
    assert.match(compose, /GF_SECURITY_ADMIN_PASSWORD:\s*\$\{GRAFANA_PASSWORD:\?/);
    assert.match(compose, /GF_AUTH_ANONYMOUS_ENABLED:\s*"false"/);
    assert.match(ler(".env.producao.example"), /^GRAFANA_PASSWORD=/m);
  });

  it("o Caddy bloqueia /api/metrics antes de repassar /api/* para a API", () => {
    const caddy = ler("frontend/Caddyfile");
    const posicaoBloqueio = caddy.indexOf("/api/metrics");
    const posicaoApi = caddy.indexOf("handle_path /api/*");
    assert.ok(posicaoBloqueio >= 0, "falta o bloqueio de /api/metrics");
    assert.ok(posicaoBloqueio < posicaoApi, "o bloqueio precisa vir antes do /api/*");
    assert.match(caddy, /respond\s+404/);
  });

  it("o painel do Grafana tem os gráficos principais da API", () => {
    const painel = JSON.parse(ler("observability/grafana/dashboards/api.json"));
    const consultas = painel.panels.map((p) => p.targets[0].expr).join("\n");
    assert.match(consultas, /http_requests_total/);
    assert.match(consultas, /http_request_duration_seconds_bucket/);
    assert.match(consultas, /process_resident_memory_bytes/);
  });
});
