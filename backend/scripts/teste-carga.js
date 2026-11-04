// Teste de carga: vários usuários virtuais chamam a API por alguns segundos e o script mostra a latência.
// Uso: BASE=http://localhost:3001 EMAIL=... SENHA=... node scripts/teste-carga.js [conexoes] [segundos]

// valor abaixo do qual ficam p% das medidas (medidas já em ordem crescente)
function percentil(ordenadas, p) {
  if (ordenadas.length === 0) return 0;
  const posicao = Math.ceil((p / 100) * ordenadas.length) - 1;
  return ordenadas[Math.max(0, posicao)];
}

// transforma as medidas (em ms) nos números do relatório
function resumir(latencias, segundos, erros) {
  const ordenadas = [...latencias].sort((a, b) => a - b);
  const soma = ordenadas.reduce((total, ms) => total + ms, 0);
  return {
    requisicoes: ordenadas.length,
    porSegundo: ordenadas.length / segundos,
    media: ordenadas.length ? soma / ordenadas.length : 0,
    p50: percentil(ordenadas, 50),
    p95: percentil(ordenadas, 95),
    p99: percentil(ordenadas, 99),
    max: ordenadas.length ? ordenadas[ordenadas.length - 1] : 0,
    erros,
  };
}

// IP de mentira por pedido, para o limite de 300 por minuto não esconder a capacidade do servidor
function ipAleatorio() {
  const parte = () => 1 + Math.floor(Math.random() * 250);
  return `10.${parte()}.${parte()}.${parte()}`;
}

// rotas testadas: a de saúde (sem login) e a carga inicial das telas (com login)
function cenarios() {
  return [
    { nome: "GET /health", caminho: "/health", comLogin: false },
    { nome: "GET /data", caminho: "/data", comLogin: true },
  ];
}

// só o computador local, a menos que a pessoa confirme que o destino é de verdade
function destinoPermitido(base, confirmou) {
  const { hostname } = new URL(base);
  return confirmou || hostname === "localhost" || hostname === "127.0.0.1";
}

// um usuário virtual: pede a rota em sequência até o tempo acabar
async function usuarioVirtual(url, headers, fim, latencias) {
  let erros = 0;
  while (Date.now() < fim) {
    const inicio = performance.now();
    const resposta = await fetch(url, { headers: { ...headers, "x-forwarded-for": ipAleatorio() } });
    await resposta.arrayBuffer();
    latencias.push(performance.now() - inicio);
    if (!resposta.ok) erros += 1;
  }
  return erros;
}

// roda uma rota com N usuários virtuais ao mesmo tempo
async function rodar(base, cenario, token, conexoes, segundos) {
  const headers = cenario.comLogin ? { authorization: `Bearer ${token}` } : {};
  const fim = Date.now() + segundos * 1000;
  const latencias = [];
  const erros = await Promise.all(
    Array.from({ length: conexoes }, () => usuarioVirtual(base + cenario.caminho, headers, fim, latencias))
  );
  return resumir(latencias, segundos, erros.reduce((total, n) => total + n, 0));
}

// entra com o e-mail e a senha e devolve o token de sessão
async function entrar(base, email, senha) {
  const resposta = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const corpo = await resposta.json();
  if (!corpo.token) throw new Error("Login recusado: confira EMAIL e SENHA.");
  return corpo.token;
}

async function main() {
  const base = process.env.BASE || "http://localhost:3001";
  const conexoes = Number(process.argv[2] || 20);
  const segundos = Number(process.argv[3] || 10);
  if (!destinoPermitido(base, process.env.CONFIRMO_DESTINO === "sim")) {
    throw new Error("Destino não é o computador local. Para testar outro endereço, defina CONFIRMO_DESTINO=sim.");
  }
  const token = await entrar(base, process.env.EMAIL, process.env.SENHA);
  for (const cenario of cenarios()) {
    const r = await rodar(base, cenario, token, conexoes, segundos);
    console.log(
      `${cenario.nome} | ${conexoes} usuários, ${segundos}s | ${r.porSegundo.toFixed(0)} req/s | ` +
        `média ${r.media.toFixed(0)} ms, p50 ${r.p50.toFixed(0)}, p95 ${r.p95.toFixed(0)}, p99 ${r.p99.toFixed(0)}, ` +
        `máx ${r.max.toFixed(0)} ms | respostas com erro: ${r.erros}`
    );
  }
}

module.exports = { percentil, resumir, ipAleatorio, cenarios, destinoPermitido, rodar, entrar };

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
