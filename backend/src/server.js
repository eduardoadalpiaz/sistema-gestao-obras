require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");

const { pool, checkConnection } = require("./db");
const { selectAll } = require("./repo");
const { asyncHandler } = require("./middleware/asyncHandler");
const { errorHandler } = require("./middleware/errorHandler");

const authRoutes          = require("./routes/auth");
const usersRoutes         = require("./routes/users");
const obrasRoutes         = require("./routes/obras");
const stagesRoutes        = require("./routes/stages");
const gastosRoutes        = require("./routes/gastos");
const documentosRoutes    = require("./routes/documentos");
const notificationsRoutes = require("./routes/notifications");
const auditRoutes         = require("./routes/audit");

const app = express();
const PORT = process.env.PORT || 3001;

// Desempenho: comprime as respostas JSON (o /data pode ficar grande com
// muitas obras/despesas/documentos — gzip reduz bastante o tráfego).
app.use(compression());
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Disponibilidade ──────────────────────────────────────────────────────
// /health testa o banco de verdade (SELECT 1), não só "o processo Node
// está de pé". Isso é o que ferramentas de monitoramento/orquestração
// (Railway, uptime checks) devem chamar para saber se o serviço está
// realmente saudável, e não apenas respondendo HTTP.
app.get("/health", async (_req, res) => {
  try {
    await checkConnection();
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "degraded", database: "unreachable", error: err.message });
  }
});

// Carregamento inicial (todos os dados) — mantém exatamente o mesmo
// contrato que o front-end já espera.
app.get("/data", asyncHandler(async (_req, res) => {
  const [users, obras, stages, notifications, gastos, documentos, audit] = await Promise.all([
    selectAll("usuarios", "created_at"),
    selectAll("obras", "created_at"),
    selectAll("etapas", "obra_id"),
    selectAll("notificacoes", "created_at", false),
    selectAll("despesas_obra", "created_at", false),
    selectAll("documentos_obra", "created_at", false),
    selectAll("historico_alteracoes", "created_at", false),
  ]);

  // password_hash nunca deve sair da API
  const safeUsers = users.map(({ passwordHash, ...u }) => u);

  res.json({ users: safeUsers, obras, stages, notifications, gastos, documentos, audit });
}));

// ── Extensibilidade ──────────────────────────────────────────────────────
// Cada recurso tem seu próprio módulo de rotas (src/routes/*.js) — para
// adicionar um novo recurso ao sistema, basta criar um novo arquivo de
// rota e montá-lo aqui, sem tocar no resto da API.
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/obras", obrasRoutes);
app.use("/stages", stagesRoutes);
app.use("/gastos", gastosRoutes);
app.use("/documentos", documentosRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/audit", auditRoutes);

// ── Robustez ──────────────────────────────────────────────────────────────
// Middleware de erro central — precisa vir por último, depois de todas as
// rotas. Qualquer erro não tratado cai aqui em vez de derrubar a API.
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});

// ── Robustez / Disponibilidade ───────────────────────────────────────────
// Desligamento gracioso: ao receber um sinal de término (ex: redeploy no
// Railway, "docker stop"), para de aceitar novas conexões, espera as
// requisições em andamento terminarem, e só então fecha o pool do banco.
// Isso evita cortar respostas pela metade durante um deploy.
function shutdown(signal) {
  console.log(`\n[server] Recebido ${signal}, encerrando graciosamente...`);
  server.close(async () => {
    await pool.end();
    console.log("[server] Conexões fechadas. Até logo.");
    process.exit(0);
  });
  // Se algo travar, força o encerramento depois de 10s em vez de ficar pendurado.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Última rede de segurança: erros verdadeiramente inesperados (fora de
// rotas Express) são logados em vez de o processo morrer silenciosamente
// sem explicação nos logs.
process.on("unhandledRejection", (reason) => {
  console.error("[server] Promise rejeitada sem tratamento:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] Exceção não capturada:", err);
});
