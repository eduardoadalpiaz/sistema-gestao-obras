// Tratamento de erro central: qualquer erro que escapar das rotas cai aqui e a API
// sempre responde em JSON, sem travar nem derrubar o processo.
function errorHandler(err, req, res, _next) {
  // tira quebras de linha do que veio do usuário antes de gravar no log
  const semQuebra = (texto) => String(texto).replace(/[\r\n]+/g, " ");
  console.error(`[erro] ${req.method} ${semQuebra(req.originalUrl)}:`, semQuebra(err.message).slice(0, 300));

  // Corpo grande demais ou JSON quebrado: resposta clara em vez de 500.
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Arquivo muito grande para enviar." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Requisição inválida." });
  }
  if (err.status === 400) {
    return res.status(400).json({ message: err.message });
  }

  // Erro de dado do Postgres (CHECK violado, campo obrigatório faltando...) vira 400 com uma
  // mensagem curta. O detalhe (que traz o conteúdo da linha) fica só no log do servidor.
  const dataErrors = {
    "23502": [400, "Falta preencher um campo obrigatório."],
    "23503": [400, "Referência inválida: o registro relacionado não existe."],
    // registro duplicado vira 409
    "23505": [409, "Já existe um registro com esses dados."],
    "23514": [400, "Um dos campos tem um valor não permitido."],
    "22P02": [400, "Identificador ou valor em formato inválido."],
    "22001": [400, "Um dos textos é longo demais."],
    "22003": [400, "Número fora do limite permitido."],
    "22007": [400, "Data em formato inválido."],
    "22008": [400, "Data em formato inválido."],
  };
  if (dataErrors[err.code]) {
    const [status, message] = dataErrors[err.code];
    // detalhe técnico só no log, não vai para o usuário
    console.error("[erro] detalhe:", String(err.detail || "").slice(0, 200));
    return res.status(status).json({ message });
  }

  // Banco fora do ar mesmo depois das tentativas (veja db.js): responde 503 pro
  // front saber que é temporário.
  const connectionCodes = { ECONNREFUSED: true, ETIMEDOUT: true, ENOTFOUND: true };
  if (connectionCodes[err.code]) {
    // banco fora do ar: 503 (temporário)
    return res.status(503).json({ message: "Serviço temporariamente indisponível. Tente novamente em instantes." });
  }

  res.status(500).json({ message: "Erro interno do servidor." });
}

module.exports = { errorHandler };
