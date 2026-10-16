// Texto de fora (usuário ou API externa) só entra no log sem quebra de linha e com tamanho limitado.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { paraLog } = require("../src/utils/log");

describe("paraLog", () => {
  test("troca quebras de linha por espaço, para não forjar linhas de log", () => {
    assert.equal(paraLog("erro\nINFO falso\r\nmais"), "erro INFO falso mais");
  });

  test("limita o tamanho do texto", () => {
    assert.equal(paraLog("a".repeat(1000)).length, 300);
    assert.equal(paraLog("a".repeat(1000), 10).length, 10);
  });

  test("aceita valores que não são texto", () => {
    assert.equal(paraLog(undefined), "undefined");
    assert.equal(paraLog(429), "429");
  });
});
