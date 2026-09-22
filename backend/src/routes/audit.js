const express = require("express");
const { selectAll, countAll, insertRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

// Escalabilidade: aceita ?page=1&pageSize=50 opcionais. Sem parâmetros,
// mantém o comportamento de sempre (devolve tudo) — não quebra nada que já
// usa este endpoint.
router.get("/", asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query;
  if (!page) {
    const audit = await selectAll("historico_alteracoes", "created_at", false);
    return res.json({ audit });
  }
  const limit = Math.min(Number(pageSize) || 50, 200);
  const offset = (Math.max(Number(page), 1) - 1) * limit;
  const [audit, total] = await Promise.all([
    selectAll("historico_alteracoes", "created_at", false, { limit, offset }),
    countAll("historico_alteracoes"),
  ]);
  res.json({ audit, page: Number(page), pageSize: limit, total });
}));

router.post("/", asyncHandler(async (req, res) => {
  const entry = await insertRow("historico_alteracoes", req.body);
  res.json({ entry });
}));

module.exports = router;
