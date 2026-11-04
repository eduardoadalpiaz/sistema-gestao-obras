// Script de teste de carga: cálculo dos números, cenários e trava contra rodar na produção.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { percentil, resumir, ipAleatorio, cenarios, destinoPermitido, rodar, entrar } = require("../scripts/teste-carga");

// servidor de mentira: guarda o que recebeu e responde com o status e o corpo combinados
async function servidorFalso(status, corpo) {
  const recebidos = [];
  const servidor = http.createServer((req, res) => {
    recebidos.push(req.headers);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(corpo));
  });
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${servidor.address().port}`, recebidos, fechar: () => { servidor.closeAllConnections(); servidor.close(); } };
}

describe("percentil", () => {
  test("devolve o valor que deixa p% das medidas abaixo", () => {
    const medidas = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentil(medidas, 50), 50);
    assert.equal(percentil(medidas, 95), 95);
    assert.equal(percentil(medidas, 99), 99);
  });

  test("sem medidas, devolve 0", () => {
    assert.equal(percentil([], 99), 0);
  });
});

describe("resumir", () => {
  test("calcula requisições por segundo, média, percentis e máximo", () => {
    const latencias = [10, 20, 30, 40];
    const r = resumir(latencias, 2, 1);
    assert.equal(r.requisicoes, 4);
    assert.equal(r.porSegundo, 2);
    assert.equal(r.media, 25);
    assert.equal(r.p50, 20);
    assert.equal(r.max, 40);
    assert.equal(r.erros, 1);
  });

  test("não depende da ordem em que as medidas chegaram", () => {
    assert.deepEqual(resumir([40, 10, 30, 20], 2, 0), resumir([10, 20, 30, 40], 2, 0));
  });
});

describe("ipAleatorio", () => {
  test("gera endereço de rede privada e muda a cada chamada", () => {
    const ips = new Set(Array.from({ length: 20 }, ipAleatorio));
    for (const ip of ips) assert.match(ip, /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    assert.ok(ips.size > 1);
  });
});

describe("cenarios", () => {
  test("testa a rota de saúde sem login e a carga inicial com login", () => {
    const lista = cenarios();
    const saude = lista.find((c) => c.caminho === "/health");
    const dados = lista.find((c) => c.caminho === "/data");
    assert.equal(saude.comLogin, false);
    assert.equal(dados.comLogin, true);
  });
});

describe("destinoPermitido", () => {
  test("libera o computador local", () => {
    assert.equal(destinoPermitido("http://localhost:3001", false), true);
    assert.equal(destinoPermitido("http://127.0.0.1:3001", false), true);
  });

  test("barra qualquer outro endereço, a menos que a pessoa confirme", () => {
    const producao = "https://sistema-gestao-obras.northcentralus.cloudapp.azure.com/api";
    assert.equal(destinoPermitido(producao, false), false);
    assert.equal(destinoPermitido(producao, true), true);
  });
});

describe("rodar", () => {
  test("conta as requisições feitas e nenhum erro quando o servidor responde 200", async () => {
    const falso = await servidorFalso(200, { status: "ok" });
    const r = await rodar(falso.base, { caminho: "/health", comLogin: false }, null, 2, 0.3);
    falso.fechar();
    assert.ok(r.requisicoes > 0);
    assert.equal(r.erros, 0);
  });

  test("conta como erro toda resposta que não for 2xx", async () => {
    const falso = await servidorFalso(500, { message: "falhou" });
    const r = await rodar(falso.base, { caminho: "/data", comLogin: false }, null, 2, 0.3);
    falso.fechar();
    assert.equal(r.erros, r.requisicoes);
  });

  test("manda o token só quando a rota pede login e muda o IP a cada pedido", async () => {
    const falso = await servidorFalso(200, {});
    await rodar(falso.base, { caminho: "/data", comLogin: true }, "meu-token", 1, 0.3);
    falso.fechar();
    assert.ok(falso.recebidos.length > 1);
    assert.ok(falso.recebidos.every((h) => h.authorization === "Bearer meu-token"));
    assert.ok(new Set(falso.recebidos.map((h) => h["x-forwarded-for"])).size > 1);
  });
});

describe("entrar", () => {
  test("devolve o token quando o login é aceito", async () => {
    const falso = await servidorFalso(200, { token: "abc" });
    const token = await entrar(falso.base, "a@b.com", "senha");
    falso.fechar();
    assert.equal(token, "abc");
  });

  test("avisa quando o login é recusado", async () => {
    const falso = await servidorFalso(401, { message: "recusado" });
    await assert.rejects(entrar(falso.base, "a@b.com", "errada"), /Login recusado/);
    falso.fechar();
  });
});
