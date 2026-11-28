// Datas: o fim não pode vir antes do início (obra, etapa e documento) e etapa vencida aparece como Atrasada.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let srv, api, tokens = {}, obra;
before(async () => {
  await h.resetDb();
  srv = await h.startServer();
  api = h.client(srv.url);
  for (const role of ["Administrativo", "Engenheiro"]) {
    tokens[role] = h.tokenFor(await h.createUser(role));
  }
  obra = (await api("POST", "/obras", { token: tokens.Administrativo, body: { name: "Obra Datas", client: "Cliente" } })).body.obra;
});
after(async () => { await srv.close(); await h.pool.end(); });

const t = () => tokens.Administrativo;
const etapa = (extra = {}) => ({ obraId: obra.id, name: "Fundação", plannedStart: "2026-04-01", plannedEnd: "2026-05-01", ...extra });
const doc = (extra = {}) => ({ obraId: obra.id, title: "Alvará", type: "Alvará de Construção", ...extra });
const etapasDaApi = async () => (await api("GET", "/data", { token: t() })).body.stages;

describe("obra - término antes do início", () => {
  test("recusa criar obra com término antes do início", async () => {
    const r = await api("POST", "/obras", { token: t(), body: { name: "X", client: "Y", startDate: "2026-06-10", endDate: "2026-06-01" } });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /término/i);
  });

  test("aceita término igual ou depois do início, e obra sem datas", async () => {
    for (const datas of [{ startDate: "2026-06-10", endDate: "2026-06-10" }, { startDate: "2026-06-10", endDate: "2026-12-31" }, {}]) {
      assert.equal((await api("POST", "/obras", { token: t(), body: { name: "X", client: "Y", ...datas } })).status, 200);
    }
  });

  test("recusa editar para término antes do início", async () => {
    const r = await api("PUT", `/obras/${obra.id}`, { token: t(), body: { startDate: "2026-06-10", endDate: "2026-06-01" } });
    assert.equal(r.status, 400);
  });
});

describe("etapa - datas", () => {
  test("recusa término previsto antes do início previsto", async () => {
    const r = await api("POST", "/stages", { token: t(), body: etapa({ plannedStart: "2026-05-10", plannedEnd: "2026-05-01" }) });
    assert.equal(r.status, 400);
  });

  test("recusa data real de término antes do início previsto", async () => {
    const r = await api("POST", "/stages", { token: t(), body: etapa({ actualEnd: "2026-03-01" }) });
    assert.equal(r.status, 400);
  });

  test("recusa editar etapa com as datas invertidas", async () => {
    const c = await api("POST", "/stages", { token: t(), body: etapa() });
    const r = await api("PUT", `/stages/${c.body.stage.id}`, { token: t(), body: { plannedStart: "2026-05-10", plannedEnd: "2026-05-01" } });
    assert.equal(r.status, 400);
  });

  test("aceita datas em ordem", async () => {
    assert.equal((await api("POST", "/stages", { token: t(), body: etapa({ actualEnd: "2026-05-05" }) })).status, 200);
  });
});

describe("documento - validade antes da emissão", () => {
  test("recusa validade antes da emissão", async () => {
    const r = await api("POST", "/documentos", { token: t(), body: doc({ issueDate: "2026-05-10", expiryDate: "2026-05-01" }) });
    assert.equal(r.status, 400);
  });

  test("aceita validade depois da emissão e documento sem datas", async () => {
    assert.equal((await api("POST", "/documentos", { token: t(), body: doc({ issueDate: "2026-05-01", expiryDate: "2027-05-01" }) })).status, 200);
    assert.equal((await api("POST", "/documentos", { token: t(), body: doc() })).status, 200);
  });
});

describe("etapa vencida aparece como Atrasada", () => {
  const criar = async (extra) => (await api("POST", "/stages", { token: t(), body: etapa(extra) })).body.stage.id;
  const statusDe = async (id) => (await etapasDaApi()).find((s) => s.id === id).status;

  test("em andamento com prazo passado vira Atrasada", async () => {
    const id = await criar({ plannedStart: "2020-01-01", plannedEnd: "2020-02-01", status: "Em andamento" });
    assert.equal(await statusDe(id), "Atrasada");
  });

  test("não iniciada com prazo passado também vira Atrasada", async () => {
    const id = await criar({ plannedStart: "2020-01-01", plannedEnd: "2020-02-01" });
    assert.equal(await statusDe(id), "Atrasada");
  });

  test("concluída não vira Atrasada, mesmo com prazo passado", async () => {
    const id = await criar({ plannedStart: "2020-01-01", plannedEnd: "2020-02-01", status: "Concluída" });
    assert.equal(await statusDe(id), "Concluída");
  });

  test("prazo no futuro mantém o status salvo", async () => {
    const id = await criar({ plannedStart: "2020-01-01", plannedEnd: "2999-01-01", status: "Em andamento" });
    assert.equal(await statusDe(id), "Em andamento");
  });

  test("etapa sem data de término mantém o status salvo", async () => {
    const id = await criar({ plannedStart: undefined, plannedEnd: undefined, status: "Em andamento" });
    assert.equal(await statusDe(id), "Em andamento");
  });
});
