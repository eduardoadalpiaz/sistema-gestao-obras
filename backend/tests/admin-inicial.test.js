// Primeiro administrador criado por função, sem senha fixa no código (TDD).
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");
const bcrypt = require("bcryptjs");
const { createInitialAdmin } = require("../src/utils/adminInicial");

before(async () => { await h.resetDb(); });
beforeEach(async () => { await h.resetDb(); });
after(async () => { await h.pool.end(); });

describe("primeiro administrador", () => {
  test("cria o administrador com a senha informada, guardada com bcrypt", async () => {
    const admin = await createInitialAdmin({ email: "Dono@Empresa.com", password: "uma-senha-bem-longa-1" });

    assert.equal(admin.email, "dono@empresa.com");
    const { rows } = await h.pool.query(
      "SELECT password_hash, role, status, verified FROM usuarios WHERE email = $1",
      ["dono@empresa.com"]
    );
    assert.equal(rows[0].role, "Administrativo");
    assert.equal(rows[0].status, "Ativo");
    assert.equal(rows[0].verified, true);
    assert.ok(await bcrypt.compare("uma-senha-bem-longa-1", rows[0].password_hash));
  });

  test("recusa senha com menos de 12 caracteres", async () => {
    await assert.rejects(
      () => createInitialAdmin({ email: "a@b.com", password: "curta123" }),
      /12 caracteres/
    );
  });

  test("não cria nada se já existe algum usuário", async () => {
    await h.createUser("Engenheiro");

    const resultado = await createInitialAdmin({ email: "novo@empresa.com", password: "uma-senha-bem-longa-1" });

    assert.equal(resultado, null);
    const { rows } = await h.pool.query("SELECT count(*)::int AS n FROM usuarios");
    assert.equal(rows[0].n, 1);
  });
});