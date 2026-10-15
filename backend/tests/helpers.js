// Apoio dos testes: variáveis de ambiente, banco de teste, servidor HTTP e login por perfil.
// Os testes usam um PostgreSQL de verdade (DATABASE_URL), não simulado.
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres@localhost:5433/obras_test";
process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-24-caracteres";
process.env.CORS_ORIGIN = "http://localhost:5173";
delete process.env.GEMINI_API_KEY;

// Trava: os testes apagam todas as tabelas, então só rodam em banco cujo nome termina em _test.
const dbName = new URL(process.env.DATABASE_URL).pathname.slice(1);
if (!dbName.endsWith("_test")) {
  throw new Error(`Testes recusados: o banco "${dbName}" não termina em _test. Use um banco só de testes.`);
}

const fs = require("fs");
const path = require("path");
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const { pool } = require("../src/db");
const { JWT_SECRET } = require("../src/config");

const PASSWORD = "Aa1-" + require("crypto").randomBytes(12).toString("hex"); // senha de teste gerada a cada execução
const HASH = bcrypt.hashSync(PASSWORD, 4); // custo baixo só pra o teste ficar rápido
let counter = 0;

// cria as tabelas se o banco de teste ainda estiver vazio
async function ensureSchema() {
  const { rows } = await pool.query("SELECT to_regclass('public.usuarios') AS t");
  if (!rows[0].t) {
    await pool.query(fs.readFileSync(path.join(__dirname, "../sql/schema.sql"), "utf8"));
  }
}

async function resetDb() {
  await ensureSchema();
  await pool.query(
    "TRUNCATE historico_alteracoes, notificacoes, documentos_obra, despesas_obra, etapas, obras, usuarios CASCADE"
  );
}

async function startServer() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }),
  };
}

async function createUser(role = "Administrativo", extra = {}) {
  counter += 1;
  const email = extra.email || `${role.toLowerCase().replace(/\s+/g, "")}${counter}@teste.com`;
  const { rows } = await pool.query(
    `INSERT INTO usuarios (name, email, password_hash, role, status, verified, verification_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [extra.name || `Usuário ${counter}`, email, extra.hash || HASH, role,
     extra.status || "Ativo", extra.verified ?? true, extra.code || "123456"]
  );
  return { ...rows[0], password: PASSWORD };
}

// token de sessão direto (sem passar pelo /auth/login)
const tokenFor = (user, opts = {}) =>
  jwt.sign({ id: user.id, purpose: opts.purpose || "session" }, JWT_SECRET, { algorithm: "HS256", expiresIn: opts.expiresIn || "1h" });

function client(baseUrl) {
  return async function request(method, route, { body, token, headers, raw } = {}) {
    const res = await fetch(baseUrl + route, {
      method,
      headers: {
        ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* resposta não é JSON */ }
    return { status: res.status, body: json, headers: res.headers };
  };
}

// arquivos de mentira com os primeiros bytes certos de cada formato
const FILES = {
  png: "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64"),
  pdf: "data:application/pdf;base64," + Buffer.from("%PDF-1.4 teste").toString("base64"),
  fakePng: "data:image/png;base64," + Buffer.from("isto nao e uma imagem").toString("base64"),
  svg: "data:image/svg+xml;base64," + Buffer.from("<svg/>").toString("base64"),
};

module.exports = { pool, resetDb, startServer, createUser, tokenFor, client, FILES, PASSWORD };
