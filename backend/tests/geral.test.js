// Itens transversais: saúde do serviço, carga inicial, auditoria, notificações, tempo real, IA e cabeçalhos.
const { test, describe, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const h = require("./helpers");

let srv, api, tokens = {}, users = {};
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

describe("saúde e cabeçalhos", () => {
  test("/health confere o banco e não exige login", async () => {
    const r = await api("GET", "/health");
    assert.equal(r.status, 200);
    assert.equal(r.body.status, "ok");
    assert.equal(r.body.database, "connected");
  });

  test("respostas trazem cabeçalhos de segurança e não revelam o Express", async () => {
    const r = await api("GET", "/health");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(r.headers.get("x-powered-by"), null);
  });

  test("CORS só libera a origem configurada", async () => {
    const ok = await api("GET", "/health", { headers: { Origin: "http://localhost:5173" } });
    assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:5173");
    const no = await api("GET", "/health", { headers: { Origin: "http://site-malicioso.com" } });
    assert.notEqual(no.headers.get("access-control-allow-origin"), "http://site-malicioso.com");
  });

  test("JSON quebrado volta 400 em vez de erro 500", async () => {
    const r = await api("POST", "/auth/login", { raw: "{ isto não é json" });
    assert.equal(r.status, 400);
  });
});

describe("GET /data (carga inicial)", () => {
  test("traz todas as coleções e nunca devolve hash de senha", async () => {
    const r = await api("GET", "/data", { token: tokens.Administrativo });
    assert.equal(r.status, 200);
    for (const k of ["users", "obras", "stages", "notifications", "gastos", "documentos", "audit"]) {
      assert.ok(Array.isArray(r.body[k]), k);
    }
    assert.ok(r.body.users.length >= 6);
    assert.ok(r.body.users.every((u) => u.passwordHash === undefined));
  });

  test("código de verificação aparece só para o administrador", async () => {
    const asAdmin = (await api("GET", "/data", { token: tokens.Administrativo })).body.users;
    assert.ok(asAdmin.some((u) => u.verificationCode));
    for (const role of ["Engenheiro", "Mestre de Obras", "Visualizador", "TI", "Dono"]) {
      const users = (await api("GET", "/data", { token: tokens[role] })).body.users;
      assert.ok(users.every((u) => u.verificationCode === undefined), role);
    }
  });

  test("histórico de alterações só vai para TI e Dono", async () => {
    await api("POST", "/audit", { token: tokens.Engenheiro, body: { action: "Criou", module: "Obras", targetName: "Obra X" } });
    for (const role of ["TI", "Dono"]) {
      assert.ok((await api("GET", "/data", { token: tokens[role] })).body.audit.length >= 1, role);
    }
    for (const role of ["Administrativo", "Engenheiro", "Mestre de Obras", "Visualizador"]) {
      assert.equal((await api("GET", "/data", { token: tokens[role] })).body.audit.length, 0, role);
    }
  });
});

describe("auditoria", () => {
  test("o autor vem do login, mesmo que o corpo tente informar outro", async () => {
    const r = await api("POST", "/audit", { token: tokens.Engenheiro, body: { action: "Editou", module: "Obras", targetName: "Obra Y", field: "progress", oldValue: "10", newValue: "20", userId: users.Dono.id, userName: "Falsário" } });
    assert.equal(r.status, 200);
    assert.equal(r.body.entry.userId, users.Engenheiro.id);
    assert.equal(r.body.entry.userName, users.Engenheiro.name);
  });

  test("ação ou módulo inválidos são recusados", async () => {
    assert.equal((await api("POST", "/audit", { token: tokens.Engenheiro, body: { action: "Hackeou", module: "Obras" } })).status, 400);
    assert.equal((await api("POST", "/audit", { token: tokens.Engenheiro, body: { action: "Criou", module: "Nada" } })).status, 400);
  });

  test("consulta é só para TI e Dono, com paginação opcional", async () => {
    for (let i = 0; i < 5; i++) await api("POST", "/audit", { token: tokens.Administrativo, body: { action: "Criou", module: "Obras", targetName: `Obra ${i}` } });
    for (const role of ["Administrativo", "Engenheiro", "Mestre de Obras", "Visualizador"]) {
      assert.equal((await api("GET", "/audit", { token: tokens[role] })).status, 403, role);
    }
    const all = await api("GET", "/audit", { token: tokens.TI });
    assert.ok(all.body.audit.length >= 6);
    const page = await api("GET", "/audit?page=2&pageSize=2", { token: tokens.Dono });
    assert.equal(page.body.audit.length, 2);
    assert.equal(page.body.page, 2);
    assert.equal(page.body.pageSize, 2);
    assert.ok(page.body.total >= 6);
    // tamanho de página é limitado a 200
    assert.equal((await api("GET", "/audit?page=1&pageSize=99999", { token: tokens.TI })).body.pageSize, 200);
  });

  test("lista vem da mais nova para a mais antiga", async () => {
    const { audit } = (await api("GET", "/audit", { token: tokens.TI })).body;
    for (let i = 1; i < audit.length; i++) assert.ok(new Date(audit[i - 1].createdAt) >= new Date(audit[i].createdAt));
  });
});

describe("notificações", () => {
  test("cria, marca uma como lida e marca todas", async () => {
    const t = tokens.Engenheiro;
    const a = (await api("POST", "/notifications", { token: t, body: { type: "warning", message: "Etapa atrasada" } })).body.notification;
    const b = (await api("POST", "/notifications", { token: t, body: { type: "info", message: "Documento vencendo" } })).body.notification;
    assert.equal(a.read, false);
    const one = await api("PUT", `/notifications/${a.id}`, { token: t, body: { read: true } });
    assert.equal(one.body.notification.read, true);
    await api("PUT", "/notifications/mark-all-read", { token: t });
    const { rows } = await h.pool.query("SELECT read FROM notificacoes WHERE id = $1", [b.id]);
    assert.equal(rows[0].read, true);
  });

  test("tipo e mensagem são validados", async () => {
    const t = tokens.Engenheiro;
    assert.equal((await api("POST", "/notifications", { token: t, body: { type: "erro-estranho", message: "x" } })).status, 400);
    assert.equal((await api("POST", "/notifications", { token: t, body: { type: "info", message: "   " } })).status, 400);
    assert.equal((await api("POST", "/notifications", { token: t, body: { type: "info", message: "a".repeat(501) } })).status, 400);
    assert.equal((await api("PUT", "/notifications/00000000-0000-0000-0000-000000000000", { token: t, body: { read: true } })).status, 404);
  });
});

describe("tempo real (SSE)", () => {
  function openStream(token) {
    return new Promise((resolve, reject) => {
      const req = http.get(srv.url + "/events", { headers: { Authorization: `Bearer ${token}` } }, (res) => {
        const stream = { res, req, text: "", close: () => req.destroy() };
        res.setEncoding("utf8");
        res.on("data", (c) => { stream.text += c; });
        resolve(stream);
      });
      req.on("error", reject);
    });
  }
  const until = async (fn, ms = 2000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 25)); }
    return false;
  };

  test("exige login", async () => {
    assert.equal((await api("GET", "/events")).status, 401);
  });

  test("avisa as telas abertas quando algo muda e junta várias mudanças em um aviso", async () => {
    const s = await openStream(tokens.Visualizador);
    assert.equal(s.res.statusCode, 200);
    assert.match(s.res.headers["content-type"], /text\/event-stream/);
    await api("POST", "/obras", { token: tokens.Administrativo, body: { name: "A", client: "C" } });
    await api("POST", "/obras", { token: tokens.Administrativo, body: { name: "B", client: "C" } });
    assert.ok(await until(() => s.text.includes("event: changed")));
    await new Promise((r) => setTimeout(r, 400));
    assert.equal((s.text.match(/event: changed/g) || []).length, 1);
    s.close();
  });

  test("alteração que falhou não gera aviso", async () => {
    const s = await openStream(tokens.Visualizador);
    await api("POST", "/obras", { token: tokens.Visualizador, body: { name: "Proibida", client: "C" } }); // 403
    await new Promise((r) => setTimeout(r, 450));
    assert.doesNotMatch(s.text, /event: changed/);
    s.close();
  });

  test("limita a 5 conexões abertas por usuário", async () => {
    const u = await h.createUser("Visualizador");
    const t = h.tokenFor(u);
    const open = [];
    for (let i = 0; i < 5; i++) open.push(await openStream(t));
    const sixth = await api("GET", "/events", { token: t });
    assert.equal(sixth.status, 429);
    open.forEach((s) => s.close());
  });
});

describe("análise por IA", () => {
  const realFetch = global.fetch;
  let obraId;
  before(async () => {
    const o = (await api("POST", "/obras", { token: tokens.Administrativo, body: { name: "Obra IA", client: "C", startDate: "2026-01-01", endDate: "2026-12-31", estimatedCost: 100000 } })).body.obra;
    obraId = o.id;
    await api("POST", "/gastos", { token: tokens.Administrativo, body: { obraId, description: "Tijolos", category: "Materiais", value: 500, date: "2026-02-01" } });
    await api("POST", "/stages", { token: tokens.Administrativo, body: { obraId, name: "Fundação", status: "Atrasada" } });
  });
  afterEach(() => { global.fetch = realFetch; delete process.env.GEMINI_API_KEY; });

  // troca só as chamadas ao Gemini; as chamadas à API de teste seguem normais
  function mockGemini(handler) {
    global.fetch = (url, opts) => (String(url).includes("generativelanguage.googleapis.com") ? handler(url, opts) : realFetch(url, opts));
  }
  const ask = (body) => api("POST", "/ai/analyze-obra", { token: tokens.Engenheiro, body });

  test("sem obraId volta 400; sem chave configurada volta 503", async () => {
    assert.equal((await ask({})).status, 400);
    assert.equal((await ask({ obraId })).status, 503);
  });

  test("obra inexistente volta 404", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    assert.equal((await ask({ obraId: "00000000-0000-0000-0000-000000000000" })).status, 404);
  });

  test("envia dados da obra no prompt, chave no cabeçalho, e devolve o texto", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    let seen;
    mockGemini(async (url, opts) => {
      seen = { url: String(url), opts };
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: " Obra no prazo. " }] } }] }), { status: 200 });
    });
    const r = await ask({ obraId });
    assert.equal(r.status, 200);
    assert.equal(r.body.analysis, "Obra no prazo.");
    assert.equal(seen.opts.headers["x-goog-api-key"], "chave-de-teste");
    assert.doesNotMatch(seen.url, /chave-de-teste/); // chave nunca vai na URL
    const prompt = JSON.parse(seen.opts.body).contents[0].parts[0].text;
    assert.match(prompt, /Obra IA/);
    assert.match(prompt, /Total gasto até agora: R\$ 500\.00/);
    assert.match(prompt, /Etapas atrasadas: 1 \(Fundação\)/);
  });

  test("falhas do Gemini viram 502 com mensagem amigável", async () => {
    process.env.GEMINI_API_KEY = "chave-de-teste";
    mockGemini(async () => new Response("quota", { status: 429 }));
    const limit = await ask({ obraId });
    assert.equal(limit.status, 502);
    assert.match(limit.body.message, /Limite de uso/);
    mockGemini(async () => { throw new Error("rede caiu"); });
    assert.equal((await ask({ obraId })).status, 502);
    mockGemini(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    assert.match((await ask({ obraId })).body.message, /não retornou/);
  });

  test("limita a 8 análises por minuto por usuário", async () => {
    const u = await h.createUser("Engenheiro");
    const t = h.tokenFor(u);
    const codes = [];
    for (let i = 0; i < 9; i++) codes.push((await api("POST", "/ai/analyze-obra", { token: t, body: {} })).status);
    assert.deepEqual(codes.slice(0, 8), Array(8).fill(400));
    assert.equal(codes[8], 429);
  });
});
