// Rotas das etapas do cronograma: criar, editar e remover.
const express = require("express");
const { insertRow, updateRow, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireRole } = require("../middleware/auth");
const { isProgress } = require("../utils/validators");

// roteador deste assunto; o app.js o conecta ao caminho
const router = express.Router();
// todas as rotas deste arquivo: Administrativo, Engenheiro e Mestre de Obras
router.use(requireRole("Administrativo", "Engenheiro", "Mestre de Obras"));

// progresso, se vier, tem que ficar entre 0 e 100
const progressError = (body) =>
  body.progress !== undefined && !isProgress(body.progress) ? "Progresso deve ficar entre 0 e 100." : null;

// criar etapa
router.post("/", asyncHandler(async (req, res) => {
  const error = progressError(req.body || {});
  if (error) return res.status(400).json({ message: error });
  const stage = await insertRow("etapas", req.body);
  res.json({ stage });
}));

// editar etapa; id inexistente: 404
router.put("/:id", asyncHandler(async (req, res) => {
  const error = progressError(req.body || {});
  if (error) return res.status(400).json({ message: error });
  // atualiza a etapa pelo id
  const stage = await updateRow("etapas", req.params.id, req.body);
  if (!stage) return res.status(404).json({ message: "Etapa não encontrada." });
  res.json({ stage });
}));

// remover etapa
router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteRow("etapas", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
