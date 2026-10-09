// Rotas de notificações: criar uma, marcar uma como lida e marcar todas como lidas.
const express = require("express");
const { query } = require("../db");
const { insertRow, updateRowNoTimestamp } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");

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
