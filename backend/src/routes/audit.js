// Histórico de alterações: quem fez o quê, em qual módulo e, nas edições, o valor antigo e o novo.
const express = require("express");
const { selectAll, countAll, insertRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireRole } = require("../middleware/auth");

// roteador deste assunto; o app.js o conecta ao caminho
const router = express.Router();

// Aceita ?page=1&pageSize=50 (opcional). Sem os parâmetros devolve tudo, como
// sempre foi. Só TI e Dono consultam o histórico.
router.get("/", requireRole("TI", "Dono"), asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  if (!page) {
    const audit = await selectAll("historico_alteracoes", "created_at", false);
    return res.json({ audit });
  }
  // página de 1 a 200 itens (padrão 50)
  const limit = Math.min(Math.max(Number.parseInt(pageSize, 10) || 50, 1), 200);
  const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
  const offset = (pageNumber - 1) * limit;
  const [audit, total] = await Promise.all([
    selectAll("historico_alteracoes", "created_at", false, { limit, offset }),
    countAll("historico_alteracoes"),
  ]);
  res.json({ audit, page: pageNumber, pageSize: limit, total });
}));

// Qualquer usuário logado registra ações, mas quem fez vem sempre do login (não do corpo).
router.post("/", asyncHandler(async (req, res) => {
  const entry = await insertRow("historico_alteracoes", {
    ...req.body,
    // autor sempre do login, ignora o que a tela mandar
    userId: req.user.id,
    userName: req.user.name,
  });
  res.json({ entry });
}));

module.exports = router;
