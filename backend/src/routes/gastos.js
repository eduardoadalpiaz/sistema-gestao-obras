// Rotas dos gastos (despesas) da obra: criar, editar e remover.
// Todo mundo menos o Visualizador pode lançar gastos.
const express = require("express");
const { insertRow, updateRowNoTimestamp, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireRole } = require("../middleware/auth");
const { checkFileField, cleanFileName } = require("../utils/validators");

const router = express.Router();
router.use(requireRole("Administrativo", "Engenheiro", "Mestre de Obras", "TI", "Dono"));

// valor numérico e comprovante só em formato permitido; quem lançou vem do login
function readExpense(body, userId) {
  const value = Number(body.value);
  if (body.value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1e12)) {
    return { error: "Valor inválido." };
  }
  const fileError = checkFileField(body.receipt, "Comprovante");
  if (fileError) return { error: fileError };
  const { createdBy, ...rest } = body;
  const data = { ...rest };
  if (body.receiptName !== undefined) data.receiptName = cleanFileName(body.receiptName);
  if (userId) data.createdBy = userId;
  return { data };
}

router.post("/", asyncHandler(async (req, res) => {
  const { data, error } = readExpense(req.body || {}, req.user.id);
  if (error) return res.status(400).json({ message: error });
  const gasto = await insertRow("despesas_obra", data);
  res.json({ gasto });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { data, error } = readExpense(req.body || {}, null);
  if (error) return res.status(400).json({ message: error });
  const gasto = await updateRowNoTimestamp("despesas_obra", req.params.id, data);
  if (!gasto) return res.status(404).json({ message: "Gasto não encontrado." });
  res.json({ gasto });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteRow("despesas_obra", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
