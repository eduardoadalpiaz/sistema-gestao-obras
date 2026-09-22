// ── Robustez ─────────────────────────────────────────────────────────────
// Middleware de erro central: qualquer exceção não tratada nas rotas cai
// aqui, garantindo que a API SEMPRE responda algo estruturado ao cliente
// (nunca trava a conexão nem derruba o processo por um erro de uma rota).
function errorHandler(err, req, res, _next) {
  console.error(`[erro] ${req.method} ${req.originalUrl}:`, err.message);

  // Erros de validação de dados do PostgreSQL (ex: violação de CHECK,
  // campo obrigatório faltando) viram 400 com mensagem legível, em vez de
  // vazar um "500 Internal Server Error" genérico.
  const validationCodes = { "23502": true, "23503": true, "23505": true, "22P02": true, "23514": true };
  if (validationCodes[err.code]) {
    return res.status(400).json({ message: `Dado inválido: ${err.detail || err.message}` });
  }

  // Banco indisponível mesmo após as tentativas automáticas de retry
  // (ver db.js) → 503, para o cliente saber que é um problema temporário,
  // não um bug — e pode tentar de novo em instantes.
  const connectionCodes = { ECONNREFUSED: true, ETIMEDOUT: true, ENOTFOUND: true };
  if (connectionCodes[err.code]) {
    return res.status(503).json({ message: "Serviço temporariamente indisponível. Tente novamente em instantes." });
  }

  res.status(500).json({ message: "Erro interno do servidor." });
}

module.exports = { errorHandler };
