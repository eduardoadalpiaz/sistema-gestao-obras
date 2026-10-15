// Funções de validação sem expressão regular: e-mail e barras no fim do endereço (CORS).
require("./helpers");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { emailValido } = require("../src/routes/users");
const { semBarraNoFim } = require("../src/app");

describe("emailValido", () => {
  test("aceita e-mails comuns", () => {
    assert.equal(emailValido("ana@obras.com"), true);
    assert.equal(emailValido("ana.silva@dalpiaz.com.br"), true);
  });

  test("recusa e-mail sem arroba, com dois arrobas ou com espaço", () => {
    assert.equal(emailValido("ana.obras.com"), false);
    assert.equal(emailValido("a@b@obras.com"), false);
    assert.equal(emailValido("ana @obras.com"), false);
    assert.equal(emailValido("ana@obras .com"), false);
  });

  test("recusa e-mail sem nome, sem domínio ou com ponto mal colocado", () => {
    assert.equal(emailValido("@obras.com"), false);
    assert.equal(emailValido("ana@"), false);
    assert.equal(emailValido("ana@obras"), false);
    assert.equal(emailValido("ana@.com"), false);
    assert.equal(emailValido("ana@obras."), false);
  });

  test("responde rápido mesmo com texto malicioso e enorme", () => {
    const inicio = Date.now();
    emailValido("a@" + "a.".repeat(50000) + " ");
    assert.ok(Date.now() - inicio < 200);
  });
});

describe("semBarraNoFim", () => {
  test("tira todas as barras do final e só elas", () => {
    assert.equal(semBarraNoFim("https://site.com/"), "https://site.com");
    assert.equal(semBarraNoFim("https://site.com///"), "https://site.com");
    assert.equal(semBarraNoFim("https://site.com/app"), "https://site.com/app");
    assert.equal(semBarraNoFim("/"), "");
    assert.equal(semBarraNoFim(""), "");
  });
});
