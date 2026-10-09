// Rotas de usuários: criar, editar e remover (a listagem vem pelo /data).
// Só o perfil Administrativo mexe aqui.
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { query } = require("../db");
const { insertRow, updateRow, deleteRow } = require("../repo");
const { asyncHandler } = require("../middleware/asyncHandler");
const { requireRole } = require("../middleware/auth");
const { ROLES } = require("../config");

const router = express.Router();
router.use(requireRole("Administrativo"));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ["Ativo", "Inativo"];
const bad = (res, message) => res.status(400).json({ message });

// confere nome, e-mail, telefone, perfil, status e senha (só o que veio no corpo)
function readUserFields(body) {
  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 150) return { error: "Nome inválido." };
    data.name = name;
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 150) return { error: "E-mail inválido." };
    data.email = email;
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone ?? "").trim();
    if (phone.length > 40) return { error: "Telefone inválido." };
    data.phone = phone;
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return { error: "Perfil inválido." };
    data.role = body.role;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: "Status inválido." };
    data.status = body.status;
  }
  if (body.password !== undefined && body.password !== "") {
    const password = String(body.password);
    if (password.length < 8 || password.length > 128) return { error: "A senha precisa ter de 8 a 128 caracteres." };
    data.password = password;
  }
  return { data };
}

// Cadastro: guarda só o hash da senha (bcrypt) e gera um código de 6 dígitos pro primeiro
// acesso. O código volta na resposta pro administrador repassar pra pessoa.
router.post("/", asyncHandler(async (req, res) => {
  const { data, error } = readUserFields(req.body || {});
  if (error) return bad(res, error);
  if (!data.name || !data.email || !data.role) return bad(res, "Nome, e-mail e perfil são obrigatórios.");

  const password = data.password || crypto.randomBytes(12).toString("base64url");
  const code = String(crypto.randomInt(100000, 1000000));

  const user = await insertRow("usuarios", {
    name: data.name,
    email: data.email,
    phone: data.phone ?? "",
    role: data.role,
    status: data.status ?? "Ativo",
    passwordHash: await bcrypt.hash(password, 10),
    verificationCode: code,
    verified: false,
  });
  delete user.passwordHash;
  res.json({ user, verificationCode: code });
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const { data, error } = readUserFields(req.body || {});
  if (error) return bad(res, error);

  // não deixa o administrador se trancar pra fora do sistema
  if (req.params.id === req.user.id && ((data.role && data.role !== req.user.role) || data.status === "Inativo")) {
    return bad(res, "Você não pode mudar o seu próprio perfil nem se desativar.");
  }

  const { password, ...fields } = data;
  if (password) fields.passwordHash = await bcrypt.hash(password, 10);

  const user = await updateRow("usuarios", req.params.id, fields);
  if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
  delete user.passwordHash;
  res.json({ user });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) return bad(res, "Você não pode remover a si mesmo.");
  // sempre sobra pelo menos um administrador
  const { rows } = await query(
    `SELECT (SELECT role FROM usuarios WHERE id = $1) AS role,
            (SELECT COUNT(*)::int FROM usuarios WHERE role = 'Administrativo') AS admins`,
    [req.params.id]
  );
  if (rows[0].role === "Administrativo" && rows[0].admins <= 1) {
    return bad(res, "Não é possível remover o último administrador.");
  }
  await deleteRow("usuarios", req.params.id);
  res.json({ success: true });
}));

module.exports = router;
