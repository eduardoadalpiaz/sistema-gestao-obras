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

describe("verificação de vencimentos com vários pedidos e documentos", () => {
  test("a verificação usa um número fixo de consultas, não uma por documento", async () => {
    const obra2 = (await api("POST", "/obras", { token, body: { name: "Obra Volume", client: "Cliente" } })).body.obra;
    for (let i = 1; i <= 5; i++) {
      await api("POST", "/documentos", {
        token,
        body: { obraId: obra2.id, title: `Documento ${i}`, type: "Laudo Técnico", expiryDate: emDias(i) },
      });
    }

    // conta as consultas que mexem em notificações durante a verificação
    const original = h.pool.query.bind(h.pool);
    let consultas = 0;
    h.pool.query = (texto, ...resto) => {
      if (typeof texto === "string" && texto.includes("notificacoes")) consultas += 1;
      return original(texto, ...resto);
    };
    let r;
    try {
      r = await api("POST", "/notifications/vencimentos", { token });
    } finally {
      h.pool.query = original;
    }

    assert.equal(r.body.criadas, 5);
    assert.ok(consultas <= 2, `esperava no máximo 2 consultas em notificações, houve ${consultas}`);
  });

  test("dois documentos iguais na mesma obra geram um aviso só", async () => {
    const obra3 = (await api("POST", "/obras", { token, body: { name: "Obra Repetida", client: "Cliente" } })).body.obra;
    for (let i = 0; i < 2; i++) {
      await api("POST", "/documentos", {
        token,
        body: { obraId: obra3.id, title: "ART do engenheiro", type: "ART/RRT", expiryDate: emDias(7) },
      });
    }

    const r = await api("POST", "/notifications/vencimentos", { token });

    assert.equal(r.body.criadas, 1);
    const { rows } = await h.pool.query("SELECT id FROM notificacoes WHERE obra_id = $1", [obra3.id]);
    assert.equal(rows.length, 1);
  });

  test("documentos de obras diferentes recebem avisos separados", async () => {
    const a = (await api("POST", "/obras", { token, body: { name: "Obra A", client: "Cliente" } })).body.obra;
    const b = (await api("POST", "/obras", { token, body: { name: "Obra B", client: "Cliente" } })).body.obra;
    for (const o of [a, b]) {
      await api("POST", "/documentos", {
        token,
        body: { obraId: o.id, title: "Licença ambiental", type: "Licença Ambiental", expiryDate: emDias(3) },
      });
    }

    const r = await api("POST", "/notifications/vencimentos", { token });

    assert.equal(r.body.criadas, 2);
  });
});
