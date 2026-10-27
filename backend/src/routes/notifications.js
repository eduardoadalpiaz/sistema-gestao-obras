// Rotas de notificações: criar uma, marcar uma como lida e marcar todas como lidas.
const express = require("express");
const { query } = require("../db");
const { insertRow, updateRowNoTimestamp } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

// roteador deste assunto; o app.js o conecta ao caminho
const router = express.Router();
const TYPES = ["success", "warning", "error", "info"];

router.post("/", asyncHandler(async (req, res) => {
  const { type, message, obraId } = req.body || {};
  if (!TYPES.includes(type) || typeof message !== "string" || !message.trim() || message.length > 500) {
    return res.status(400).json({ message: "Notificação inválida." });
  }
  const notification = await insertRow("notificacoes", { type, message, obraId });
  res.json({ notification });
}));

// verifica os documentos que vencem em até 30 dias (ou já vencidos) e cria um aviso para cada um, sem repetir
router.post("/vencimentos", asyncHandler(async (_req, res) => {
  // uma consulta só: monta o aviso de cada documento e grava os que ainda não existem
  const { rowCount } = await query(
    `WITH vencendo AS (
       -- documentos que vencem em até 30 dias (ou já vencidos), com o texto do aviso
       SELECT DISTINCT obra_id,
              'Documento "' || title || '" vence em ' || to_char(expiry_date, 'DD/MM/YYYY') AS message
         FROM documentos_obra
        WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + 30
     )
     INSERT INTO notificacoes (type, message, obra_id)
     SELECT 'warning', v.message, v.obra_id
       FROM vencendo v
      -- se esse aviso já existe para a obra, não cria de novo
      WHERE NOT EXISTS (
        SELECT 1 FROM notificacoes n WHERE n.obra_id = v.obra_id AND n.message = v.message
      )`
  );
  // diz quantos avisos novos criou
  res.json({ criadas: rowCount });
}));

// essa rota precisa vir antes da /:id, senão o Express entenderia "mark-all-read" como um id
router.put("/mark-all-read", asyncHandler(async (_req, res) => {
  await query("UPDATE notificacoes SET read = TRUE WHERE read = FALSE");
  res.json({ success: true });
}));

// aqui só dá pra marcar como lida
router.put("/:id", asyncHandler(async (req, res) => {
  const notification = await updateRowNoTimestamp("notificacoes", req.params.id, { read: Boolean(req.body?.read) });
  if (!notification) return res.status(404).json({ message: "Notificação não encontrada." });
  res.json({ notification });
}));

module.exports = router;