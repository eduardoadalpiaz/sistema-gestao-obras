// Regras de negócio de obras e etapas: quem pode o quê, limites de progresso e efeitos em cascata.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

let srv, api, users = {}, tokens = {};
before(async () => {
  await h.resetDb();
  srv = await h.startServer();
  api = h.client(srv.url);
  for (const role of ["Administrativo", "Engenheiro", "Mestre de Obras", "Visualizador", "TI", "Dono"]) {
    users[role] = await h.createUser(role);
    tokens[role] = h.tokenFor(users[role]);
  }
});
after(async () => { await srv.close(); await h.pool.end(); });

const obraBody = (extra = {}) => ({ name: "Edifício Aurora", client: "Dal Piaz", city: "Criciúma", state: "SC", estimatedCost: 1500000.5, teamMembers: ["João", "Ana"], ...extra });
const criarObra = async (extra) => (await api("POST", "/obras", { token: tokens.Administrativo, body: obraBody(extra) })).body.obra;

describe("obras - criação e leitura", () => {
  test("administrativo e engenheiro criam obra; valores vêm com tipo certo", async () => {
    for (const role of ["Administrativo", "Engenheiro"]) {
      const r = await api("POST", "/obras", { token: tokens[role], body: obraBody() });
      assert.equal(r.status, 200, role);
      assert.equal(r.body.obra.estimatedCost, 1500000.5); // NUMERIC chega como número
      assert.equal(typeof r.body.obra.estimatedCost, "number");
      assert.deepEqual(r.body.obra.teamMembers, ["João", "Ana"]);
      assert.equal(r.body.obra.status, "Em andamento");
      assert.equal(r.body.obra.progress, 0);
    }
  });

  test("datas voltam como texto AAAA-MM-DD, sem fuso", async () => {
    const o = await criarObra({ startDate: "2026-03-10", endDate: "2026-12-31" });
    assert.equal(o.startDate, "2026-03-10");
    assert.equal(o.endDate, "2026-12-31");
  });

  test("mestre, visualizador, TI e dono não criam obra", async () => {
    for (const role of ["Mestre de Obras", "Visualizador", "TI", "Dono"]) {
      assert.equal((await api("POST", "/obras", { token: tokens[role], body: obraBody() })).status, 403, role);
    }
  });

  test("rejeita progresso fora de 0-100 e equipe inválida", async () => {
    const t = tokens.Administrativo;
    assert.equal((await api("POST", "/obras", { token: t, body: obraBody({ progress: 150 }) })).status, 400);
    assert.equal((await api("POST", "/obras", { token: t, body: obraBody({ progress: -1 }) })).status, 400);
    assert.equal((await api("POST", "/obras", { token: t, body: obraBody({ teamMembers: "João" }) })).status, 400);
  });

  test("campos obrigatórios e valores fora da lista voltam 400", async () => {
    const t = tokens.Administrativo;
    assert.equal((await api("POST", "/obras", { token: t, body: { client: "Sem nome" } })).status, 400);
    assert.equal((await api("POST", "/obras", { token: t, body: obraBody({ status: "Inventado" }) })).status, 400);
    assert.equal((await api("POST", "/obras", { token: t, body: {} })).status, 400);
  });

  test("campos desconhecidos (id, createdAt, SQL) são descartados", async () => {
    const fakeId = "11111111-1111-1111-1111-111111111111";
    const r = await api("POST", "/obras", { token: tokens.Administrativo, body: obraBody({ id: fakeId, "name; DROP TABLE obras": "x", lixo: 1 }) });
    assert.equal(r.status, 200);
    assert.notEqual(r.body.obra.id, fakeId);
    const { rows } = await h.pool.query("SELECT to_regclass('public.obras') AS t");
    assert.ok(rows[0].t);
  });

  test("GET /data traz a obra criada para qualquer perfil logado", async () => {
    const o = await criarObra({ name: "Obra Visível" });
    const r = await api("GET", "/data", { token: tokens.Visualizador });
    assert.equal(r.status, 200);
    assert.ok(r.body.obras.some((x) => x.id === o.id));
  });
});

describe("obras - edição", () => {
  test("engenheiro edita qualquer campo", async () => {
    const o = await criarObra();
    const r = await api("PUT", `/obras/${o.id}`, { token: tokens.Engenheiro, body: { name: "Novo nome", status: "Paralisada" } });
    assert.equal(r.status, 200);
    assert.equal(r.body.obra.name, "Novo nome");
    assert.equal(r.body.obra.status, "Paralisada");
  });

  test("mestre de obras só altera o progresso", async () => {
    const o = await criarObra();
    const t = tokens["Mestre de Obras"];
    const ok = await api("PUT", `/obras/${o.id}`, { token: t, body: { progress: 40 } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.obra.progress, 40);
    const no = await api("PUT", `/obras/${o.id}`, { token: t, body: { progress: 50, name: "Hackeada" } });
    assert.equal(no.status, 403);
    const { rows } = await h.pool.query("SELECT name, progress FROM obras WHERE id = $1", [o.id]);
    assert.equal(rows[0].name, "Edifício Aurora");
    assert.equal(rows[0].progress, 40);
  });

  test("visualizador, TI e dono não editam", async () => {
    const o = await criarObra();
    for (const role of ["Visualizador", "TI", "Dono"]) {
      assert.equal((await api("PUT", `/obras/${o.id}`, { token: tokens[role], body: { progress: 10 } })).status, 403, role);
    }
  });

  test("progresso inválido, obra inexistente e id malformado", async () => {
    const o = await criarObra();
    const t = tokens.Administrativo;
    assert.equal((await api("PUT", `/obras/${o.id}`, { token: t, body: { progress: 101 } })).status, 400);
    assert.equal((await api("PUT", "/obras/00000000-0000-0000-0000-000000000000", { token: t, body: { progress: 10 } })).status, 404);
    assert.equal((await api("PUT", "/obras/xyz", { token: t, body: { progress: 10 } })).status, 400);
  });

  test("atualiza o updated_at", async () => {
    const o = await criarObra();
    await new Promise((r) => setTimeout(r, 20));
    const r = await api("PUT", `/obras/${o.id}`, { token: tokens.Administrativo, body: { progress: 5 } });
    assert.ok(new Date(r.body.obra.updatedAt) > new Date(o.updatedAt));
  });
});

describe("obras - exclusão em cascata", () => {
  test("apagar a obra leva etapas, gastos e documentos junto", async () => {
    const o = await criarObra();
    const t = tokens.Administrativo;
    await api("POST", "/stages", { token: t, body: { obraId: o.id, name: "Fundação" } });
    await api("POST", "/gastos", { token: t, body: { obraId: o.id, description: "Cimento", category: "Materiais", value: 100, date: "2026-05-01" } });
    await api("POST", "/documentos", { token: t, body: { obraId: o.id, title: "Alvará", type: "Alvará de Construção" } });
    assert.equal((await api("DELETE", `/obras/${o.id}`, { token: t })).status, 200);
    for (const table of ["etapas", "despesas_obra", "documentos_obra"]) {
      const { rows } = await h.pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE obra_id = $1`, [o.id]);
      assert.equal(rows[0].n, 0, table);
    }
  });

  test("só administrativo e engenheiro apagam", async () => {
    const o = await criarObra();
    for (const role of ["Mestre de Obras", "Visualizador", "TI", "Dono"]) {
      assert.equal((await api("DELETE", `/obras/${o.id}`, { token: tokens[role] })).status, 403, role);
    }
    assert.equal((await api("DELETE", `/obras/${o.id}`, { token: tokens.Engenheiro })).status, 200);
  });
});

describe("etapas", () => {
  test("administrativo, engenheiro e mestre gerenciam etapas", async () => {
    const o = await criarObra();
    for (const role of ["Administrativo", "Engenheiro", "Mestre de Obras"]) {
      const c = await api("POST", "/stages", { token: tokens[role], body: { obraId: o.id, name: `Etapa ${role}`, plannedStart: "2026-04-01", plannedEnd: "2026-05-01" } });
      assert.equal(c.status, 200, role);
      assert.equal(c.body.stage.status, "Não iniciada");
      assert.equal(c.body.stage.plannedEnd, "2026-05-01");
      const u = await api("PUT", `/stages/${c.body.stage.id}`, { token: tokens[role], body: { progress: 60, status: "Em andamento" } });
      assert.equal(u.status, 200);
      assert.equal(u.body.stage.progress, 60);
      assert.equal((await api("DELETE", `/stages/${c.body.stage.id}`, { token: tokens[role] })).status, 200);
    }
  });

  test("visualizador, TI e dono não mexem em etapas", async () => {
    const o = await criarObra();
    for (const role of ["Visualizador", "TI", "Dono"]) {
      assert.equal((await api("POST", "/stages", { token: tokens[role], body: { obraId: o.id, name: "X" } })).status, 403, role);
    }
  });

  test("valida progresso, obra existente e id", async () => {
    const o = await criarObra();
    const t = tokens.Engenheiro;
    assert.equal((await api("POST", "/stages", { token: t, body: { obraId: o.id, name: "X", progress: 200 } })).status, 400);
    assert.equal((await api("POST", "/stages", { token: t, body: { obraId: "00000000-0000-0000-0000-000000000000", name: "X" } })).status, 400); // obra não existe
    assert.equal((await api("PUT", "/stages/00000000-0000-0000-0000-000000000000", { token: t, body: { progress: 1 } })).status, 404);
    assert.equal((await api("POST", "/stages", { token: t, body: { obraId: o.id, name: "X", status: "Inventada" } })).status, 400);
  });
});
