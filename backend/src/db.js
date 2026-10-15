const { Pool, types } = require("pg");

// Por padrão o pg devolve colunas DATE como objeto Date, que no JSON vira
// "2026-09-09T00:00:00.000Z". O front espera só "AAAA-MM-DD", então devolvemos o
// texto cru. (1082 = DATE)
types.setTypeParser(1082, (value) => value);

// Colunas NUMERIC (dinheiro, área...) chegam como texto, tipo "40000.00". Com
// isso o front concatenava em vez de somar (0 + "40000.00" dava "040000.00"),
// então convertemos pra número. (1700 = NUMERIC)
types.setTypeParser(1700, (value) => (value === null ? null : Number.parseFloat(value)));

// Tamanho do pool e timeouts podem ser ajustados por variável de ambiente.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),           // máximo de conexões abertas
  idleTimeoutMillis: 30_000,                              // fecha conexões paradas
  connectionTimeoutMillis: 5_000,                         // desiste se não conseguir conexão a tempo
});

// Se uma conexão parada der erro (banco reiniciou, rede caiu), só registra no log
// e deixa o pool se recuperar. Não vale derrubar o servidor por isso.
pool.on("error", (err) => {
  console.error("[db] Erro inesperado em conexão ociosa do pool:", err.message);
});

// Erros temporários de conexão: vale tentar de novo antes de devolver erro pro usuário.
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "57P03", // 57P03 = cannot_connect_now
]);

// Roda a query e, se der erro de conexão ou rede, tenta de novo até 3 vezes
// com uma pequena espera. Erro de dado (ex: violou constraint) não adianta repetir.
async function query(text, params, attempt = 1) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    const isTransient = TRANSIENT_ERROR_CODES.has(err.code);
    if (isTransient && attempt <= 3) {
      const delayMs = attempt * 300;
      console.warn(`[db] Falha transitória (${err.code}), tentativa ${attempt}/3 em ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return query(text, params, attempt + 1);
    }
    throw err;
  }
}

// Confere se o banco está respondendo (usado no /health).
async function checkConnection() {
  await pool.query("SELECT 1");
}

module.exports = { pool, query, checkConnection };
