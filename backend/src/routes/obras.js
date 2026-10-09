// Rotas de obras: criar, editar e remover (a listagem vem pelo /data).
const express = require("express");
const { insertRow, updateRow, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireRole } = require("../middleware/auth");
const { isStringList, isProgress } = require("../utils/validators");

const router = express.Router();
const bad = (res, message) => res.status(400).json({ message });

// confere os campos que têm regra própria (progresso e nomes da equipe)
function checkObra(body) {
  if (body.progress !== undefined && !isProgress(body.progress)) return "Progresso deve ficar entre 0 e 100.";
  if (body.teamMembers !== undefined && !isStringList(body.teamMembers, 100, 120)) return "Lista de nomes da equipe inválida.";
  return null;
}

router.post("/", requireRole("Administrativo", "Engenheiro"), asyncHandler(async (req, res) => {
  const error = checkObra(req.body || {});
  if (error) return bad(res, error);
  const obra = await insertRow("obras", req.body);
  res.json({ obra });
}));

// O Mestre de Obras só atualiza o progresso (é o que acontece quando ele mexe nas etapas).
router.put("/:id", requireRole("Administrativo", "Engenheiro", "Mestre de Obras"), asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (req.user.role === "Mestre de Obras" && Object.keys(body).some((k) => k !== "progress")) {
    return res.status(403).json({ message: "Você não tem permissão para essa ação." });
  }
  const error = checkObra(body);
  if (error) return bad(res, error);
  const obra = await updateRow("obras", req.params.id, body);
  if (!obra) return res.status(404).json({ message: "Obra não encontrada." });
  res.json({ obra });
}));

router.delete("/:id", requireRole("Administrativo", "Engenheiro"), asyncHandler(async (req, res) => {
  // o ON DELETE CASCADE do banco já apaga etapas, gastos e documentos junto
  await deleteRow("obras", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
