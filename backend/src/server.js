// Ponto de entrada do backend: configura o Express (CORS, compressão e JSON),
// registra as rotas de cada recurso e liga o servidor.
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");

const { pool, checkConnection } = require("./db");
const { selectAll } = require("./repo");
const { asyncHandler } = require("./middleware/asyncHandler");
const { errorHandler } = require("./middleware/errorHandler");
const { authenticate } = require("./middleware/auth");
const { rateLimit } = require("./middleware/rateLimit");

const authRoutes          = require("./routes/auth");
const usersRoutes         = require("./routes/users");
const obrasRoutes         = require("./routes/obras");
const stagesRoutes        = require("./routes/stages");
const gastosRoutes        = require("./routes/gastos");
const documentosRoutes    = require("./routes/documentos");
const notificationsRoutes = require("./routes/notifications");
const auditRoutes         = require("./routes/audit");
const aiRoutes            = require("./routes/ai");

const app = express();
const PORT = process.env.PORT || 3001;

// Atrás do proxy do Railway: sem isso o IP de todo mundo apareceria igual (e os limites de uso não funcionariam).
app.set("trust proxy", 1);
app.disable("x-powered-by");

// cabeçalhos de segurança básicos em todas as respostas
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });
  next();
});

// Comprime as respostas: o /data pode ficar bem grande quando tem muita obra,
// gasto e documento.
app.use(compression());

// CORS: define quem pode chamar a API pelo navegador (endereço do front, em CORS_ORIGIN;
// pode ter mais de um, separados por vírgula).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
if (allowedOrigins.length === 0) {
  console.warn("[segurança] CORS_ORIGIN não definido: liberando qualquer origem. Defina com o endereço do front.");
}
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Corpo JSON: 100 KB na maioria das rotas. Gastos e documentos levam arquivo (base64) e têm
// um limite maior, mas só depois de conferir o login, pra ninguém mandar arquivo grande sem estar logado.
const smallJson = express.json({ limit: "100kb" });
const fileJson = express.json({ limit: "9mb" });
const FILE_ROUTES = ["/gastos", "/documentos"];
app.use((req, res, next) =>
  FILE_ROUTES.some((p) => req.path === p || req.path.startsWith(p + "/")) ? next() : smallJson(req, res, next)
);

// limite geral por IP (folgado pra uso normal, serve contra abuso)
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// O /health faz um SELECT 1 no banco pra saber se o serviço está funcionando de
// verdade, e não só se o Node está de pé. É o endereço que o Railway pode checar.
app.get("/health", async (_req, res) => {
  try {
    await checkConnection();
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[health] banco inacessível:", err.message);
    res.status(503).json({ status: "degraded", database: "unreachable" });
  }
});

// Carga inicial: devolve tudo de uma vez, do jeito que o front espera.
app.get("/data", authenticate, asyncHandler(async (req, res) => {
  // o histórico só vai pra TI e Dono (os outros perfis recebem lista vazia)
  const canSeeAudit = ["TI", "Dono"].includes(req.user.role);
  const [users, obras, stages, notifications, gastos, documentos, audit] = await Promise.all([
    selectAll("usuarios", "created_at"),
    selectAll("obras", "created_at"),
    selectAll("etapas", "obra_id"),
    selectAll("notificacoes", "created_at", false),
    selectAll("despesas_obra", "created_at", false),
    selectAll("documentos_obra", "created_at", false),
    canSeeAudit ? selectAll("historico_alteracoes", "created_at", false) : [],
  ]);

  // nunca devolver o hash da senha; o código de verificação só o administrador vê
  const isAdmin = req.user.role === "Administrativo";
  const safeUsers = users.map(({ passwordHash, verificationCode, ...u }) =>
    isAdmin ? { ...u, verificationCode } : u
  );

  res.json({ users: safeUsers, obras, stages, notifications, gastos, documentos, audit });
}));

// Cada recurso tem o seu arquivo em src/routes. Pra criar um novo, é só fazer
// o arquivo e registrar aqui.
// /auth é público (é onde se faz login) e tem limite próprio por IP; o resto exige login.
app.use("/auth", rateLimit({ windowMs: 15 * 60_000, max: 60, message: "Muitas tentativas. Tente de novo em alguns minutos." }), authRoutes);
app.use("/users", authenticate, usersRoutes);
app.use("/obras", authenticate, obrasRoutes);
app.use("/stages", authenticate, stagesRoutes);
app.use("/gastos", authenticate, fileJson, gastosRoutes);
app.use("/documentos", authenticate, fileJson, documentosRoutes);
app.use("/notifications", authenticate, notificationsRoutes);
app.use("/audit", authenticate, auditRoutes);

// IA: por usuário, no máximo 8 por minuto e 60 por dia (protege a cota do Gemini)
const aiKey = (req) => `ai:${req.user.id}`;
app.use(
  "/ai",
  authenticate,
  rateLimit({ windowMs: 60_000, max: 8, keyFn: aiKey, message: "Muitas análises seguidas. Espere um minuto." }),
  rateLimit({ windowMs: 24 * 60 * 60_000, max: 60, keyFn: aiKey, message: "Limite diário de análises atingido." }),
  aiRoutes
);

// O tratamento de erro tem que ser o último, depois de todas as rotas.
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});

// Quando o Railway reinicia (deploy novo, por exemplo), o servidor para de aceitar
// conexões, espera o que está em andamento terminar e só então fecha o banco.
// Assim nenhuma resposta fica cortada no meio.
function shutdown(signal) {
  console.log(`\n[server] Recebido ${signal}, encerrando graciosamente...`);
  server.close(async () => {
    await pool.end();
    console.log("[server] Conexões fechadas. Até logo.");
    process.exit(0);
  });
  // se travar, encerra à força depois de 10s
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Erros que escapam das rotas só vão pro log, pra o processo não cair sem deixar pista.
process.on("unhandledRejection", (reason) => {
  console.error("[server] Promise rejeitada sem tratamento:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] Exceção não capturada:", err);
});
