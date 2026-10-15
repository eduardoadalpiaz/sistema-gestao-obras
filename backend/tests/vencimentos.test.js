// Aviso de documento vencendo (RF17): criado em TDD, o teste veio antes do código.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let srv, api, token, obra;
before(async () => {
  await h.resetDb();
  srv = await h.startServer();
  api = h.client(srv.url);
  const admin = await h.createUser("Administrativo");
  token = h.tokenFor(admin);
  obra = (await api("POST", "/obras", { token, body: { name: "Obra Teste", client: "Cliente" } })).body.obra;
});
after(async () => { await srv.close(); await h.pool.end(); });

// devolve a data daqui a N dias no formato AAAA-MM-DD
const emDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe("aviso de documento vencendo", () => {
  test("documento que vence em 10 dias gera uma notificação", async () => {
    await api("POST", "/documentos", {
      token,
      body: { obraId: obra.id, title: "Alvará da prefeitura", type: "Alvará de Construção", expiryDate: emDias(10) },
    });

    const r = await api("POST", "/notifications/vencimentos", { token });

    assert.equal(r.status, 200);
    assert.equal(r.body.criadas, 1);
    const { rows } = await h.pool.query("SELECT type, message FROM notificacoes WHERE obra_id = $1", [obra.id]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, "warning");
    assert.match(rows[0].message, /Alvará da prefeitura/);
  });

  test("chamar de novo não duplica o aviso", async () => {
    const r = await api("POST", "/notifications/vencimentos", { token });

    assert.equal(r.status, 200);
    assert.equal(r.body.criadas, 0);
    const { rows } = await h.pool.query("SELECT id FROM notificacoes WHERE obra_id = $1", [obra.id]);
    assert.equal(rows.length, 1);
  });
});