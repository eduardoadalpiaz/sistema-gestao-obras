// Login, verificação da conta e proteção das rotas (RNF de segurança).
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const h = require("./helpers");

let srv, api;
before(async () => { await h.resetDb(); srv = await h.startServer(); api = h.client(srv.url); });
after(async () => { await srv.close(); await h.pool.end(); });

describe("POST /auth/login", () => {
  test("entra com e-mail e senha corretos e devolve token sem dados secretos", async () => {
    const u = await h.createUser("Engenheiro");
    const r = await api("POST", "/auth/login", { body: { email: u.email, password: u.password } });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.ok(r.body.token);
    assert.equal(r.body.user.email, u.email);
    assert.equal(r.body.user.passwordHash, undefined);
    assert.equal(r.body.user.verificationCode, undefined);
    const payload = jwt.decode(r.body.token);
    assert.equal(payload.purpose, "session");
    assert.equal(payload.id, u.id);
  });

  test("ignora maiúsculas e espaços no e-mail", async () => {
    const u = await h.createUser("Dono");
    const r = await api("POST", "/auth/login", { body: { email: `  ${u.email.toUpperCase()} `, password: u.password } });
    assert.equal(r.status, 200);
  });

  test("exige e-mail e senha", async () => {
    const r = await api("POST", "/auth/login", { body: { email: "a@b.com" } });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /e-mail e senha/i);
  });

  test("senha errada e e-mail inexistente dão a mesma resposta (não revela quem existe)", async () => {
    const u = await h.createUser("Visualizador");
    const wrong = await api("POST", "/auth/login", { body: { email: u.email, password: "errada-errada" } });
    const ghost = await api("POST", "/auth/login", { body: { email: "naoexiste@teste.com", password: "qualquer-coisa" } });
    assert.equal(wrong.status, 401);
    assert.equal(ghost.status, 401);
    assert.deepEqual(wrong.body, ghost.body);
  });

  test("usuário inativo não entra", async () => {
    const u = await h.createUser("Engenheiro", { status: "Inativo" });
    const r = await api("POST", "/auth/login", { body: { email: u.email, password: u.password } });
    assert.equal(r.status, 403);
  });

  test("conta não verificada recebe token curto de verificação, não de sessão", async () => {
    const u = await h.createUser("Engenheiro", { verified: false });
    const r = await api("POST", "/auth/login", { body: { email: u.email, password: u.password } });
    assert.equal(r.status, 200);
    assert.equal(r.body.needsVerification, true);
    assert.equal(r.body.token, undefined);
    assert.equal(jwt.decode(r.body.verifyToken).purpose, "verify");
    // o token de verificação não abre as rotas protegidas
    const data = await api("GET", "/data", { token: r.body.verifyToken });
    assert.equal(data.status, 401);
  });

  test("bloqueia depois de 8 senhas erradas seguidas", async () => {
    const u = await h.createUser("Engenheiro");
    for (let i = 0; i < 8; i++) {
      const r = await api("POST", "/auth/login", { body: { email: u.email, password: "errada-errada" } });
      assert.equal(r.status, 401);
    }
    // mesmo com a senha certa, fica bloqueado
    const r = await api("POST", "/auth/login", { body: { email: u.email, password: u.password } });
    assert.equal(r.status, 429);
  });
});

describe("POST /auth/verify", () => {
  async function pendingUser() {
    const u = await h.createUser("Engenheiro", { verified: false, code: "654321" });
    const login = await api("POST", "/auth/login", { body: { email: u.email, password: u.password } });
    return { u, verifyToken: login.body.verifyToken };
  }

  test("código certo ativa a conta e entrega a sessão", async () => {
    const { u, verifyToken } = await pendingUser();
    const r = await api("POST", "/auth/verify", { body: { verifyToken, code: "654321" } });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    const { rows } = await h.pool.query("SELECT verified FROM usuarios WHERE id = $1", [u.id]);
    assert.equal(rows[0].verified, true);
  });

  test("código errado é recusado e a conta continua pendente", async () => {
    const { u, verifyToken } = await pendingUser();
    const r = await api("POST", "/auth/verify", { body: { verifyToken, code: "000000" } });
    assert.equal(r.status, 400);
    const { rows } = await h.pool.query("SELECT verified FROM usuarios WHERE id = $1", [u.id]);
    assert.equal(rows[0].verified, false);
  });

  test("bloqueia depois de 5 códigos errados", async () => {
    const { verifyToken } = await pendingUser();
    for (let i = 0; i < 5; i++) {
      assert.equal((await api("POST", "/auth/verify", { body: { verifyToken, code: "111111" } })).status, 400);
    }
    const r = await api("POST", "/auth/verify", { body: { verifyToken, code: "654321" } });
    assert.equal(r.status, 429);
  });

  test("token inválido ou de sessão não serve para verificar", async () => {
    const u = await h.createUser("Engenheiro", { verified: false });
    assert.equal((await api("POST", "/auth/verify", { body: { verifyToken: "lixo", code: "123456" } })).status, 401);
    const session = h.tokenFor(u, { purpose: "session" });
    assert.equal((await api("POST", "/auth/verify", { body: { verifyToken: session, code: "123456" } })).status, 401);
  });
});

describe("proteção das rotas (authenticate)", () => {
  test("sem token, token falso ou vencido: 401", async () => {
    const u = await h.createUser("Administrativo");
    assert.equal((await api("GET", "/data")).status, 401);
    assert.equal((await api("GET", "/data", { token: "abc.def.ghi" })).status, 401);
    const expired = h.tokenFor(u, { expiresIn: -10 });
    assert.equal((await api("GET", "/data", { token: expired })).status, 401);
  });

  test("token assinado com outro segredo é recusado", async () => {
    const u = await h.createUser("Administrativo");
    const forged = jwt.sign({ id: u.id, purpose: "session" }, "outro-segredo-qualquer-1234567890", { algorithm: "HS256" });
    assert.equal((await api("GET", "/data", { token: forged })).status, 401);
  });

  test("usuário desativado perde o acesso na hora, mesmo com token válido", async () => {
    const u = await h.createUser("Engenheiro");
    const token = h.tokenFor(u);
    assert.equal((await api("GET", "/data", { token })).status, 200);
    await h.pool.query("UPDATE usuarios SET status = 'Inativo' WHERE id = $1", [u.id]);
    assert.equal((await api("GET", "/data", { token })).status, 401);
  });

  test("usuário apagado perde o acesso", async () => {
    const u = await h.createUser("Engenheiro");
    const token = h.tokenFor(u);
    await h.pool.query("DELETE FROM usuarios WHERE id = $1", [u.id]);
    assert.equal((await api("GET", "/data", { token })).status, 401);
  });
});
