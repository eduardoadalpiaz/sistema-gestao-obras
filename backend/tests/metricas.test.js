// Métricas para o Prometheus (observabilidade): criado em TDD, o teste veio antes do código.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let srv, api;
before(async () => {
  await h.resetDb();
  srv = await h.startServer();
  api = h.client(srv.url);
});
after(async () => { await srv.close(); await h.pool.end(); });

// procura a linha da métrica pelo nome e por pedaços dos rótulos, e devolve o valor
function valor(texto, nome, ...pedacos) {
  const linha = texto.split("\n").find((l) => l.startsWith(nome + "{") && pedacos.every((p) => l.includes(p)));
  return linha ? Number(linha.split(" ").pop()) : null;
}

describe("métricas do Prometheus", () => {
  test("/metrics responde em texto do Prometheus e inclui métricas do processo", async () => {
    const res = await fetch(srv.url + "/metrics");
    const texto = await res.text();

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/plain/);
    assert.match(texto, /process_cpu_seconds_total/);
  });

  test("conta as requisições por rota e status", async () => {
    await api("GET", "/health");
    await api("GET", "/health");

    const texto = await (await fetch(srv.url + "/metrics")).text();

    assert.equal(valor(texto, "http_requests_total", 'route="/health"', 'status="200"'), 2);
  });

  test("registra o tempo de resposta", async () => {
    await api("GET", "/health");

    const texto = await (await fetch(srv.url + "/metrics")).text();

    assert.ok(valor(texto, "http_request_duration_seconds_count", 'route="/health"') >= 1);
  });
});