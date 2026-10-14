// Testes de unidade: funções puras e middlewares, sem banco.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { checkFileField, cleanFileName, isStringList, isProgress } = require("../src/utils/validators");
const { toCamel, toSnake, mapRows, mapRow } = require("../src/utils/caseConvert");
const { rateLimit, attemptLimiter } = require("../src/middleware/rateLimit");
const { errorHandler } = require("../src/middleware/errorHandler");
const { asyncHandler } = require("../src/middleware/asyncHandler");
const { requireRole } = require("../src/middleware/auth");

const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).toString("base64");

function fakeRes() {
  return {
    code: 200, payload: null, headers: {},
    status(c) { this.code = c; return this; },
    json(p) { this.payload = p; return this; },
    set(k, v) { this.headers[k] = v; return this; },
  };
}

describe("validators", () => {
  test("aceita campo vazio ou ausente", () => {
    assert.equal(checkFileField(undefined, "Arquivo"), null);
    assert.equal(checkFileField(null, "Arquivo"), null);
    assert.equal(checkFileField("", "Arquivo"), null);
  });
  test("aceita imagem cujo conteúdo bate com o tipo", () => {
    assert.equal(checkFileField(png, "Arquivo"), null);
  });
  test("recusa tipo fora da lista (SVG, HTML) e valor que não é texto", () => {
    assert.match(checkFileField("data:image/svg+xml;base64,PHN2Zy8+", "Arquivo"), /formato não permitido/);
    assert.match(checkFileField("data:text/html;base64,PGI+", "Arquivo"), /formato não permitido/);
    assert.match(checkFileField(123, "Arquivo"), /inválido/);
  });
  test("recusa arquivo que diz ser PNG mas tem outro conteúdo", () => {
    const fake = "data:image/png;base64," + Buffer.from("texto qualquer").toString("base64");
    assert.match(checkFileField(fake, "Arquivo"), /não bate com o tipo/);
  });
  test("recusa arquivo maior que 6 MB", () => {
    const big = "data:application/pdf;base64," + "A".repeat(9 * 1024 * 1024);
    assert.match(checkFileField(big, "Arquivo"), /muito grande/);
  });
  test("cleanFileName tira barras e limita o tamanho", () => {
    assert.equal(cleanFileName("../../etc/passwd"), ".._.._etc_passwd");
    assert.equal(cleanFileName("a".repeat(500)).length, 200);
    assert.equal(cleanFileName(undefined), undefined);
  });
  test("isProgress só aceita de 0 a 100", () => {
    for (const ok of [0, 50, 100, "75"]) assert.equal(isProgress(ok), true);
    for (const no of [-1, 101, "abc", NaN, Infinity]) assert.equal(isProgress(no), false);
  });
  test("isStringList confere tipo, quantidade e tamanho", () => {
    assert.equal(isStringList(["a", "b"], 3, 5), true);
    assert.equal(isStringList(["a", "b", "c", "d"], 3, 5), false);
    assert.equal(isStringList(["abcdefg"], 3, 5), false);
    assert.equal(isStringList([1], 3, 5), false);
    assert.equal(isStringList("a", 3, 5), false);
  });
});

describe("caseConvert", () => {
  test("converte snake_case <-> camelCase", () => {
    assert.deepEqual(toCamel({ start_date: 1, obra_id: 2 }), { startDate: 1, obraId: 2 });
    assert.deepEqual(toSnake({ startDate: 1, obraId: 2 }), { start_date: 1, obra_id: 2 });
  });
  test("trata valores vazios", () => {
    assert.equal(toCamel(null), null);
    assert.equal(toSnake(undefined), undefined);
    assert.equal(mapRow(undefined), null);
    assert.deepEqual(mapRows(undefined), []);
    assert.deepEqual(mapRows([{ a_b: 1 }]), [{ aB: 1 }]);
  });
});

describe("rateLimit", () => {
  test("bloqueia depois do máximo e informa Retry-After", () => {
    const limit = rateLimit({ windowMs: 60_000, max: 2 });
    const req = { ip: "1.1.1.1" };
    let passed = 0;
    for (let i = 0; i < 2; i++) limit(req, fakeRes(), () => passed++);
    const res = fakeRes();
    limit(req, res, () => passed++);
    assert.equal(passed, 2);
    assert.equal(res.code, 429);
    assert.ok(Number(res.headers["Retry-After"]) > 0);
  });
  test("cada chave tem a sua contagem", () => {
    const limit = rateLimit({ windowMs: 60_000, max: 1, keyFn: (r) => r.k });
    let passed = 0;
    limit({ k: "a" }, fakeRes(), () => passed++);
    limit({ k: "b" }, fakeRes(), () => passed++);
    assert.equal(passed, 2);
  });
  test("libera de novo quando a janela passa", async () => {
    const limit = rateLimit({ windowMs: 30, max: 1 });
    const req = { ip: "2.2.2.2" };
    limit(req, fakeRes(), () => {});
    await new Promise((r) => setTimeout(r, 50));
    let passed = false;
    limit(req, fakeRes(), () => { passed = true; });
    assert.equal(passed, true);
  });
});

describe("attemptLimiter", () => {
  test("bloqueia após o máximo de erros e o acerto zera", () => {
    const l = attemptLimiter({ windowMs: 60_000, max: 3 });
    assert.equal(l.blockedFor("x"), 0);
    l.fail("x"); l.fail("x");
    assert.equal(l.blockedFor("x"), 0);
    l.fail("x");
    assert.ok(l.blockedFor("x") > 0);
    l.clear("x");
    assert.equal(l.blockedFor("x"), 0);
  });
});

describe("errorHandler", () => {
  const run = (err) => { const res = fakeRes(); errorHandler(err, { method: "GET", originalUrl: "/x" }, res, () => {}); return res; };
  test("traduz erros conhecidos", () => {
    assert.equal(run({ type: "entity.too.large", message: "" }).code, 413);
    assert.equal(run({ type: "entity.parse.failed", message: "" }).code, 400);
    assert.equal(run({ status: 400, message: "ruim" }).payload.message, "ruim");
    assert.equal(run({ code: "23505", message: "dup" }).code, 409);
    assert.equal(run({ code: "23514", message: "check" }).code, 400);
    assert.equal(run({ code: "22P02", message: "uuid" }).code, 400);
    assert.equal(run({ code: "ECONNREFUSED", message: "" }).code, 503);
  });
  test("erro desconhecido vira 500 sem vazar detalhe", () => {
    const res = run(new Error("segredo interno"));
    assert.equal(res.code, 500);
    assert.doesNotMatch(JSON.stringify(res.payload), /segredo/);
  });
  test("erro de dado não devolve o conteúdo da linha", () => {
    const res = run({ code: "23505", message: "dup", detail: "Key (email)=(a@b.com) already exists" });
    assert.doesNotMatch(JSON.stringify(res.payload), /a@b\.com/);
  });
});

describe("middlewares simples", () => {
  test("asyncHandler manda o erro da rota async pro next", async () => {
    const boom = new Error("falhou");
    let received;
    await asyncHandler(async () => { throw boom; })({}, {}, (e) => { received = e; });
    assert.equal(received, boom);
  });
  test("requireRole libera só os perfis informados", () => {
    const mw = requireRole("Administrativo");
    let ok = false;
    mw({ user: { role: "Administrativo" } }, fakeRes(), () => { ok = true; });
    assert.equal(ok, true);
    const res = fakeRes();
    mw({ user: { role: "Visualizador" } }, res, () => { ok = "chamou"; });
    assert.equal(res.code, 403);
    assert.equal(ok, true);
  });
});
