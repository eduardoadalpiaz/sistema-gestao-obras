// Gestão de usuários: só o Administrativo mexe, com travas para não se trancar fora.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const h = require("./helpers");

let srv, api, admin, adminToken;
before(async () => {
  await h.resetDb();
  srv = await h.startServer();
  api = h.client(srv.url);
  admin = await h.createUser("Administrativo");
  adminToken = h.tokenFor(admin);
});
after(async () => { await srv.close(); await h.pool.end(); });

const novo = (extra = {}) => ({ name: "Maria", email: `maria${Math.random().toString(36).slice(2)}@teste.com`, role: "Engenheiro", ...extra });

describe("POST /users", () => {
  test("cria usuário com senha em hash, código de 6 dígitos e conta não verificada", async () => {
    const r = await api("POST", "/users", { token: adminToken, body: novo({ password: "senha-muito-boa" }) });
    assert.equal(r.status, 200);
    assert.match(r.body.verificationCode, /^\d{6}$/);
    assert.equal(r.body.user.passwordHash, undefined);
    const { rows } = await h.pool.query("SELECT * FROM usuarios WHERE id = $1", [r.body.user.id]);
    assert.notEqual(rows[0].password_hash, "senha-muito-boa");
    assert.equal(await bcrypt.compare("senha-muito-boa", rows[0].password_hash), true);
    assert.equal(rows[0].verified, false);
  });

  test("sem senha informada, gera uma aleatória", async () => {
    const r = await api("POST", "/users", { token: adminToken, body: novo() });
    assert.equal(r.status, 200);
    const { rows } = await h.pool.query("SELECT password_hash FROM usuarios WHERE id = $1", [r.body.user.id]);
    assert.ok(rows[0].password_hash.startsWith("$2"));
  });

  test("novo usuário completa o primeiro acesso de ponta a ponta", async () => {
    const body = novo({ password: "senha-muito-boa" });
    const created = await api("POST", "/users", { token: adminToken, body });
    const login = await api("POST", "/auth/login", { body: { email: body.email, password: "senha-muito-boa" } });
    assert.equal(login.body.needsVerification, true);
    const ver = await api("POST", "/auth/verify", { body: { verifyToken: login.body.verifyToken, code: created.body.verificationCode } });
    assert.equal(ver.status, 200);
    assert.equal((await api("GET", "/data", { token: ver.body.token })).status, 200);
  });

  test("valida os campos", async () => {
    const t = adminToken;
    assert.equal((await api("POST", "/users", { token: t, body: novo({ email: "invalido" }) })).status, 400);
    assert.equal((await api("POST", "/users", { token: t, body: novo({ role: "Chefe" }) })).status, 400);
    assert.equal((await api("POST", "/users", { token: t, body: novo({ name: "   " }) })).status, 400);
    assert.equal((await api("POST", "/users", { token: t, body: novo({ status: "Talvez" }) })).status, 400);
    assert.equal((await api("POST", "/users", { token: t, body: novo({ password: "curta" }) })).status, 400);
    assert.equal((await api("POST", "/users", { token: t, body: { name: "Só nome" } })).status, 400);
  });

  test("e-mail repetido volta 409", async () => {
    const body = novo();
    assert.equal((await api("POST", "/users", { token: adminToken, body })).status, 200);
    assert.equal((await api("POST", "/users", { token: adminToken, body })).status, 409);
  });

  test("outros perfis não criam usuário", async () => {
    for (const role of ["Engenheiro", "Mestre de Obras", "Visualizador", "TI", "Dono"]) {
      const u = await h.createUser(role);
      const r = await api("POST", "/users", { token: h.tokenFor(u), body: novo() });
      assert.equal(r.status, 403, role);
    }
  });
});

describe("PUT /users/:id", () => {
  test("administrador troca perfil e senha de outra pessoa", async () => {
    const u = await h.createUser("Visualizador");
    const r = await api("PUT", `/users/${u.id}`, { token: adminToken, body: { role: "Engenheiro", password: "nova-senha-123" } });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.role, "Engenheiro");
    const { rows } = await h.pool.query("SELECT password_hash FROM usuarios WHERE id = $1", [u.id]);
    assert.equal(await bcrypt.compare("nova-senha-123", rows[0].password_hash), true);
  });

  test("não deixa o administrador mudar o próprio perfil nem se desativar", async () => {
    const a = await h.createUser("Administrativo");
    const t = h.tokenFor(a);
    assert.equal((await api("PUT", `/users/${a.id}`, { token: t, body: { role: "Visualizador" } })).status, 400);
    assert.equal((await api("PUT", `/users/${a.id}`, { token: t, body: { status: "Inativo" } })).status, 400);
    // editar o próprio nome pode
    assert.equal((await api("PUT", `/users/${a.id}`, { token: t, body: { name: "Novo Nome" } })).status, 200);
  });

  test("usuário inexistente volta 404 e id malformado volta 400", async () => {
    assert.equal((await api("PUT", "/users/00000000-0000-0000-0000-000000000000", { token: adminToken, body: { name: "X" } })).status, 404);
    assert.equal((await api("PUT", "/users/nao-e-uuid", { token: adminToken, body: { name: "X" } })).status, 400);
  });
});

describe("DELETE /users/:id", () => {
  test("remove outro usuário", async () => {
    const u = await h.createUser("Visualizador");
    assert.equal((await api("DELETE", `/users/${u.id}`, { token: adminToken })).status, 200);
    const { rows } = await h.pool.query("SELECT 1 FROM usuarios WHERE id = $1", [u.id]);
    assert.equal(rows.length, 0);
  });

  test("não remove a si mesmo", async () => {
    assert.equal((await api("DELETE", `/users/${admin.id}`, { token: adminToken })).status, 400);
  });

  test("um administrador pode remover outro, mas sempre sobra pelo menos um", async () => {
    const outro = await h.createUser("Administrativo");
    assert.equal((await api("DELETE", `/users/${outro.id}`, { token: adminToken })).status, 200);
    const { rows } = await h.pool.query("SELECT COUNT(*)::int AS n FROM usuarios WHERE role = 'Administrativo'");
    assert.ok(rows[0].n >= 1);
    // o próprio administrador que sobrou não consegue se remover
    assert.equal((await api("DELETE", `/users/${admin.id}`, { token: adminToken })).status, 400);
  });
});
