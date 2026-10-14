// Ponto de entrada do backend: carrega o .env, liga o servidor e cuida do encerramento.
require("dotenv").config();
const app = require("./app");
const { pool } = require("./db");
const { closeAll } = require("./realtime");

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});

// Quando o servidor reinicia (deploy novo, por exemplo), o servidor para de aceitar
// conexões, espera o que está em andamento terminar e só então fecha o banco.
// Assim nenhuma resposta fica cortada no meio.
function shutdown(signal) {
  console.log(`\n[server] Recebido ${signal}, encerrando graciosamente...`);
  closeAll();
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
