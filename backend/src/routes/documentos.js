// Rotas dos documentos da obra: criar, editar e remover.
// Todo mundo menos o Visualizador pode anexar documentos.
const express = require("express");
const { insertRow, updateRowNoTimestamp, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireRole } = require("../middleware/auth");
const { checkFileField, cleanFileName } = require("../utils/validators");

const router = express.Router();
router.use(requireRole("Administrativo", "Engenheiro", "Mestre de Obras", "TI", "Dono"));

// arquivo só em formato permitido; quem enviou vem do login
function readDocument(body, userId) {
  const fileError = checkFileField(body.file, "Arquivo");
  if (fileError) return { error: fileError };
  const { uploadedBy, ...rest } = body;
  const data = { ...rest };
  if (body.fileName !== undefined) data.fileName = cleanFileName(body.fileName);
  if (userId) data.uploadedBy = userId;
  return { data };
}

router.post("/", asyncHandler(async (req, res) => {
  const { data, error } = readDocument(req.body || {}, req.user.id);
  if (error) return res.status(400).json({ message: error });
  const documento = await insertRow("documentos_obra", data);
  res.json({ documento });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { data, error } = readDocument(req.body || {}, null);
  if (error) return res.status(400).json({ message: error });
  const documento = await updateRowNoTimestamp("documentos_obra", req.params.id, data);
  if (!documento) return res.status(404).json({ message: "Documento não encontrado." });
  res.json({ documento });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteRow("documentos_obra", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
