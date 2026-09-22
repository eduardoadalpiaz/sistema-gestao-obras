const { Pool, types } = require("pg");

// Por padrão, o driver "pg" converte colunas DATE em objetos Date do JS
// (que viram "2026-09-09T00:00:00.000Z" em JSON). O front-end espera a
// data pura "YYYY-MM-DD" (ele mesmo concatena o horário quando precisa).
// OID 1082 = tipo DATE do PostgreSQL.
types.setTypeParser(1082, (value) => value);

// Colunas NUMERIC (valores em dinheiro, área etc.) vêm do "pg" como texto
// (ex: "40000.00"), não como número, pra não perder casas decimais.
// Isso faz o front, ao somar, concatenar texto em vez de somar (0 + "40000.00" = "040000.00").
// OID 1700 = tipo NUMERIC do PostgreSQL. Convertemos pra número aqui.
types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

// ── Desempenho / Escalabilidade ─────────────────────────────────────────────
// Tamanho do pool de conexões e timeouts configuráveis por variável de
// ambiente, para ajustar sem redeploy conforme a carga (nº de usuários
// simultâneos) cresce.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),           // conexões simultâneas no pool
  idleTimeoutMillis: 30_000,                              // libera conexões ociosas
  connectionTimeoutMillis: 5_000,                         // não trava indefinidamente esperando conexão
});

// ── Resiliência ──────────────────────────────────────────────────────────────
// Erros de conexão ociosa (ex: banco reiniciou, rede caiu) não devem derrubar
// o processo Node inteiro — só registramos e deixamos o pool se recuperar
// sozinho na próxima query.
pool.on("error", (err) => {
  console.error("[db] Erro inesperado em conexão ociosa do pool:", err.message);
});

// Códigos de erro do PostgreSQL/rede considerados transitórios — vale a pena
// tentar de novo automaticamente em vez de já devolver erro pro usuário.
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "57P03", // 57P03 = cannot_connect_now
]);

/**
 * Executa uma query com retry automático (até 3 tentativas, com pequeno
 * backoff) quando a falha é de conexão/rede — não quando é erro de dados
 * (ex: violação de constraint), que nunca vai "se resolver sozinho".
 */
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

/** Testa se o banco está realmente respondendo (usado pelo /health). */
async function checkConnection() {
  await pool.query("SELECT 1");
}

module.exports = { pool, query, checkConnection };
