// Gastos e documentos da obra: permissões, validação de valores e de arquivos anexados.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let srv, api, tokens = {}, users = {}, obra;
before(async () => {
  await h.resetDb();
  srv = await h.startServer();
  api = h.client(srv.url);
  for (const role of ["Administrativo", "Engenheiro", "Mestre de Obras", "Visualizador", "TI", "Dono"]) {
    users[role] = await h.createUser(role);
    tokens[role] = h.tokenFor(users[role]);
  }
  obra = (await api("POST", "/obras", { token: tokens.Administrativo, body: { name: "Obra Teste", client: "Cliente" } })).body.obra;
});
after(async () => { await srv.close(); await h.pool.end(); });

const gasto = (extra = {}) => ({ obraId: obra.id, description: "Cimento", category: "Materiais", value: 1234.56, date: "2026-05-10", ...extra });
const doc = (extra = {}) => ({ obraId: obra.id, title: "Alvará da prefeitura", type: "Alvará de Construção", ...extra });

describe("gastos", () => {
  test("lança gasto, registra quem lançou e devolve o valor como número", async () => {
    const r = await api("POST", "/gastos", { token: tokens.Engenheiro, body: gasto() });
    assert.equal(r.status, 200);
    assert.equal(r.body.gasto.value, 1234.56);
    assert.equal(r.body.gasto.createdBy, users.Engenheiro.id);
  });

  test("não dá pra fingir que outra pessoa lançou o gasto", async () => {
    const r = await api("POST", "/gastos", { token: tokens.Engenheiro, body: gasto({ createdBy: users.Dono.id }) });
    assert.equal(r.body.gasto.createdBy, users.Engenheiro.id);
  });

  test("todos os perfis, menos o visualizador, lançam gastos", async () => {
    for (const role of ["Administrativo", "Engenheiro", "Mestre de Obras", "TI", "Dono"]) {
      assert.equal((await api("POST", "/gastos", { token: tokens[role], body: gasto() })).status, 200, role);
    }
    assert.equal((await api("POST", "/gastos", { token: tokens.Visualizador, body: gasto() })).status, 403);
  });

  test("valor negativo, não numérico ou gigante é recusado", async () => {
    const t = tokens.Administrativo;
    for (const value of [-5, "abc", 1e13, null]) {
      const r = await api("POST", "/gastos", { token: t, body: gasto({ value }) });
      assert.equal(r.status, 400, String(value));
    }
  });

  test("categoria fora da lista e obra inexistente são recusadas", async () => {
    const t = tokens.Administrativo;
    assert.equal((await api("POST", "/gastos", { token: t, body: gasto({ category: "Churrasco" }) })).status, 400);
    assert.equal((await api("POST", "/gastos", { token: t, body: gasto({ obraId: "00000000-0000-0000-0000-000000000000" }) })).status, 400);
  });

  test("comprovante: aceita PNG e PDF reais, recusa SVG e arquivo disfarçado", async () => {
    const t = tokens.Administrativo;
    const okPng = await api("POST", "/gastos", { token: t, body: gasto({ receipt: h.FILES.png, receiptName: "nota.png" }) });
    assert.equal(okPng.status, 200);
    assert.equal((await api("POST", "/gastos", { token: t, body: gasto({ receipt: h.FILES.pdf }) })).status, 200);
    assert.equal((await api("POST", "/gastos", { token: t, body: gasto({ receipt: h.FILES.svg }) })).status, 400);
    assert.equal((await api("POST", "/gastos", { token: t, body: gasto({ receipt: h.FILES.fakePng }) })).status, 400);
  });

  test("nome do arquivo não carrega barras", async () => {
    const r = await api("POST", "/gastos", { token: tokens.Administrativo, body: gasto({ receipt: h.FILES.png, receiptName: "../../segredo.png" }) });
    assert.equal(r.body.gasto.receiptName, ".._.._segredo.png");
  });

  test("edita e apaga gasto; id inexistente volta 404", async () => {
    const t = tokens.Administrativo;
    const g = (await api("POST", "/gastos", { token: t, body: gasto() })).body.gasto;
    const up = await api("PUT", `/gastos/${g.id}`, { token: t, body: { value: 99.9, createdBy: users.Dono.id } });
    assert.equal(up.status, 200);
    assert.equal(up.body.gasto.value, 99.9);
    assert.equal(up.body.gasto.createdBy, users.Administrativo.id); // autoria não é trocada na edição
    assert.equal((await api("PUT", "/gastos/00000000-0000-0000-0000-000000000000", { token: t, body: { value: 1 } })).status, 404);
    assert.equal((await api("DELETE", `/gastos/${g.id}`, { token: t })).status, 200);
  });

  test("o total por obra bate com a soma dos lançamentos", async () => {
    const o = (await api("POST", "/obras", { token: tokens.Administrativo, body: { name: "Obra Soma", client: "C" } })).body.obra;
    for (const value of [100.25, 200.5, 300.25]) {
      await api("POST", "/gastos", { token: tokens.Administrativo, body: gasto({ obraId: o.id, value }) });
    }
    const data = (await api("GET", "/data", { token: tokens.Administrativo })).body;
    const total = data.gastos.filter((g) => g.obraId === o.id).reduce((s, g) => s + g.value, 0);
    assert.equal(total, 601);
  });
});

describe("documentos", () => {
  test("anexa documento com PDF e registra quem enviou", async () => {
    const r = await api("POST", "/documentos", { token: tokens["Mestre de Obras"], body: doc({ file: h.FILES.pdf, fileName: "alvara.pdf", expiryDate: "2027-01-31" }) });
    assert.equal(r.status, 200);
    assert.equal(r.body.documento.uploadedBy, users["Mestre de Obras"].id);
    assert.equal(r.body.documento.expiryDate, "2027-01-31");
    assert.equal(r.body.documento.status, "Pendente");
  });

  test("visualizador não anexa; os demais sim", async () => {
    for (const role of ["Administrativo", "Engenheiro", "Mestre de Obras", "TI", "Dono"]) {
      assert.equal((await api("POST", "/documentos", { token: tokens[role], body: doc() })).status, 200, role);
    }
    assert.equal((await api("POST", "/documentos", { token: tokens.Visualizador, body: doc() })).status, 403);
  });

  test("recusa arquivo com tipo não permitido ou conteúdo falso", async () => {
    const t = tokens.Administrativo;
    assert.equal((await api("POST", "/documentos", { token: t, body: doc({ file: h.FILES.svg }) })).status, 400);
    assert.equal((await api("POST", "/documentos", { token: t, body: doc({ file: h.FILES.fakePng }) })).status, 400);
  });

  test("tipo e status precisam estar na lista", async () => {
    const t = tokens.Administrativo;
    assert.equal((await api("POST", "/documentos", { token: t, body: doc({ type: "Documento Secreto" }) })).status, 400);
    assert.equal((await api("POST", "/documentos", { token: t, body: doc({ status: "Quase" }) })).status, 400);
  });

  test("edita o status e apaga", async () => {
    const t = tokens.Engenheiro;
    const d = (await api("POST", "/documentos", { token: t, body: doc() })).body.documento;
    const up = await api("PUT", `/documentos/${d.id}`, { token: t, body: { status: "Vencido" } });
    assert.equal(up.body.documento.status, "Vencido");
    assert.equal((await api("PUT", "/documentos/00000000-0000-0000-0000-000000000000", { token: t, body: { status: "Válido" } })).status, 404);
    assert.equal((await api("DELETE", `/documentos/${d.id}`, { token: t })).status, 200);
  });

  test("corpo acima do limite de 9 MB é recusado com 413", async () => {
    const huge = "data:application/pdf;base64," + "A".repeat(10 * 1024 * 1024);
    const r = await api("POST", "/documentos", { token: tokens.Administrativo, body: doc({ file: huge }) });
    assert.equal(r.status, 413);
  });
});
