// Monta a aplicação Express (CORS, compressão, JSON e rotas de cada recurso).
// Fica separada do server.js pra os testes subirem a API sem abrir a porta de verdade.
// bibliotecas externas
const express = require("express");
const cors = require("cors");
const compression = require("compression");

// partes do nosso projeto: banco, middlewares, tempo real e métricas
const { checkConnection } = require("./db");
const { selectAll } = require("./repo");
const { asyncHandler } = require("./middleware/asyncHandler");
const { errorHandler } = require("./middleware/errorHandler");
const { authenticate } = require("./middleware/auth");
const { rateLimit } = require("./middleware/rateLimit");
const { subscribe, notifyChange } = require("./realtime");
const { metricsMiddleware, metricsHandler } = require("./metrics");

// um arquivo de rotas para cada recurso
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

// Atrás do proxy (Caddy): sem isso o IP de todo mundo apareceria igual (e os limites de uso não funcionariam).
app.set("trust proxy", 1);
app.disable("x-powered-by");

// cabeçalhos de segurança básicos em todas as respostas
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    // proíbe abrir a API dentro de outro site (iframe)
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });
  next();
});

// conta e mede todas as requisições (alimenta o /metrics)
app.use(metricsMiddleware);

// Comprime as respostas: o /data pode ficar bem grande quando tem muita obra,
// gasto e documento.
// comprime tudo, menos o /events (tempo real não pode atrasar)
app.use(compression({ filter: (req, res) => (req.path === "/events" ? false : compression.filter(req, res)) }));

// CORS: define quem pode chamar a API pelo navegador (endereço do front, em CORS_ORIGIN;
// pode ter mais de um, separados por vírgula).
// tira as barras do final do endereço (sem expressão regular)
function semBarraNoFim(texto) {
  let fim = texto.length;
  while (fim > 0 && texto[fim - 1] === "/") fim--;
  return texto.slice(0, fim);
}

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => semBarraNoFim(o.trim()))
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
// 9 MB: só para rotas com arquivo em base64
const fileJson = express.json({ limit: "9mb" });
const FILE_ROUTES = ["/gastos", "/documentos"];
app.use((req, res, next) =>
  FILE_ROUTES.some((p) => req.path === p || req.path.startsWith(p + "/")) ? next() : smallJson(req, res, next)
);

// limite geral por IP (folgado pra uso normal, serve contra abuso)
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

// O /health faz um SELECT 1 no banco pra saber se o serviço está funcionando de
// verdade, e não só se o Node está de pé. É o endereço que o Docker checa (healthcheck).
app.get("/health", async (_req, res) => {
  try {
    // pergunta ao banco se ele responde
    await checkConnection();
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[health] banco inacessível:", err.message);
    res.status(503).json({ status: "degraded", database: "unreachable" });
  }
});

// Métricas no formato do Prometheus (no servidor só a rede interna enxerga: o Caddy bloqueia /api/metrics)
app.get("/metrics", asyncHandler(metricsHandler));

// Carga inicial: devolve tudo de uma vez, do jeito que o front espera.
app.get("/data", authenticate, asyncHandler(async (req, res) => {
  // o histórico só vai pra TI e Dono (os outros perfis recebem lista vazia)
  const canSeeAudit = ["TI", "Dono"].includes(req.user.role);
  // busca as 7 tabelas ao mesmo tempo
  const [users, obras, stages, notifications, gastos, documentos, audit] = await Promise.all([
    selectAll("usuarios", "created_at"),
    selectAll("obras", "created_at"),
    selectAll("etapas", "obra_id"),
    selectAll("notificacoes", "created_at", false),
    selectAll("despesas_obra", "created_at", false),
    selectAll("documentos_obra", "created_at", false),
    // histórico só para TI e Dono; os outros recebem lista vazia
    canSeeAudit ? selectAll("historico_alteracoes", "created_at", false) : [],
  ]);

  // nunca devolver o hash da senha; o código de verificação só o administrador vê
  const isAdmin = req.user.role === "Administrativo";
  // nunca devolve o hash; o código de verificação só vai para o Administrativo
  const safeUsers = users.map(({ passwordHash, verificationCode, ...u }) =>
    isAdmin ? { ...u, verificationCode } : u
  );

  res.json({ users: safeUsers, obras, stages, notifications, gastos, documentos, audit });
}));

// Tempo real: conexão aberta que recebe um aviso quando algo muda.
app.get("/events", authenticate, subscribe);

// Depois de qualquer alteração que deu certo, avisa todas as telas abertas.
app.use(["/users", "/obras", "/stages", "/gastos", "/documentos", "/notifications"], (req, res, next) => {
  if (req.method !== "GET" && req.method !== "OPTIONS") {
    // resposta sem erro: avisa todas as telas abertas
    res.on("finish", () => { if (res.statusCode < 400) notifyChange(); });
  }
  next();
});

// Cada recurso tem o seu arquivo em src/routes. Pra criar um novo, é só fazer
// o arquivo e registrar aqui.
// /auth é público (é onde se faz login) e tem limite próprio por IP; o resto exige login.
app.use("/auth", rateLimit({ windowMs: 15 * 60_000, max: 60, message: "Muitas tentativas. Tente de novo em alguns minutos." }), authRoutes);
app.use("/users", authenticate, usersRoutes);
// /obras exige login antes de chegar nas rotas
app.use("/obras", authenticate, obrasRoutes);
app.use("/stages", authenticate, stagesRoutes);
// primeiro confere o login, depois lê o corpo grande
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

module.exports = app;
module.exports.semBarraNoFim = semBarraNoFim;
