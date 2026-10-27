// Rotas de obras: criar, editar e remover (a listagem vem pelo /data).
const express = require("express");
const { insertRow, updateRow, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireRole } = require("../middleware/auth");
const { isStringList, isProgress } = require("../utils/validators");

// roteador deste assunto; o app.js o conecta ao caminho
const router = express.Router();
const bad = (res, message) => res.status(400).json({ message });

// confere os campos que têm regra própria: progresso (0 a 100) e lista de nomes da equipe
function checkObra(body) {
  if (body.progress !== undefined && !isProgress(body.progress)) return "Progresso deve ficar entre 0 e 100.";
  if (body.teamMembers !== undefined && !isStringList(body.teamMembers, 100, 120)) return "Lista de nomes da equipe inválida.";
  return null;
}

// criar obra: só Administrativo e Engenheiro
router.post("/", requireRole("Administrativo", "Engenheiro"), asyncHandler(async (req, res) => {
  const error = checkObra(req.body || {});
  if (error) return bad(res, error);
  // grava a obra e devolve a obra criada
  const obra = await insertRow("obras", req.body);
  res.json({ obra });
}));

// O Mestre de Obras só atualiza o progresso (é o que acontece quando ele mexe nas etapas).
router.put("/:id", requireRole("Administrativo", "Engenheiro", "Mestre de Obras"), asyncHandler(async (req, res) => {
  const body = req.body || {};
  // Mestre de Obras só pode mandar o progresso; qualquer outro campo: 403
  if (req.user.role === "Mestre de Obras" && Object.keys(body).some((k) => k !== "progress")) {
    return res.status(403).json({ message: "Você não tem permissão para essa ação." });
  }
  const error = checkObra(body);
  if (error) return bad(res, error);
  // atualiza só os campos enviados; id inexistente: 404
  const obra = await updateRow("obras", req.params.id, body);
  if (!obra) return res.status(404).json({ message: "Obra não encontrada." });
  res.json({ obra });
}));

// remover obra: só Administrativo e Engenheiro
router.delete("/:id", requireRole("Administrativo", "Engenheiro"), asyncHandler(async (req, res) => {
  // o ON DELETE CASCADE do banco já apaga etapas, gastos e documentos junto
  await deleteRow("obras", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
