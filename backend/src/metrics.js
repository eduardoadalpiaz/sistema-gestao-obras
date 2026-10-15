// Métricas para o Prometheus: conta as requisições e mede o tempo de resposta de cada rota.
const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register }); // CPU, memória e outras métricas do processo

const requests = new client.Counter({
  name: "http_requests_total",
  help: "Total de requisições HTTP",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const duration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Tempo de resposta das requisições HTTP, em segundos",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Mede cada requisição quando a resposta termina.
function metricsMiddleware(req, res, next) {
  const stop = duration.startTimer();
  res.on("finish", () => {
    // troca os ids por :id (senão cada obra viraria uma série nova) e agrupa as rotas inexistentes
    const route = req.route ? req.originalUrl.split("?")[0].replace(UUID, ":id") : "desconhecida";
    const labels = { method: req.method, route, status: String(res.statusCode) };
    requests.inc(labels);
    stop(labels);
  });
  next();
}

// Responde o /metrics no formato que o Prometheus lê.
async function metricsHandler(_req, res) {
  res.set("Content-Type", register.contentType);
  res.send(await register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler };
