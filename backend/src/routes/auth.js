const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { pool } = require("../db");
const { mapRow } = require("../utils/caseConvert");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "troque-este-segredo";

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query(
    "SELECT * FROM usuarios WHERE lower(email) = lower($1)",
    [email?.trim()]
  );
  const row = rows[0];
  if (!row) return res.status(401).json({ error: "E-mail ou senha incorretos." });

  const valid = await bcrypt.compare(password ?? "", row.password_hash);
  if (!valid) return res.status(401).json({ error: "E-mail ou senha incorretos." });

  const { password_hash, ...rest } = row;
  const user = mapRow(rest);

  if (user.status === "Inativo") {
    return res.status(403).json({ error: "Usuário inativo. Contate o administrador." });
  }
  if (!user.verified) {
    return res.status(200).json({ needsVerification: true, user });
  }

  const token = signToken(user);
  res.status(200).json({ success: true, user, token });
}));

router.post("/verify", asyncHandler(async (req, res) => {
  const { userId, code } = req.body;
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE id = $1", [userId]);
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Usuário não encontrado." });
  if (row.verification_code !== code) return res.status(400).json({ error: "Código inválido." });

  const { rows: updatedRows } = await pool.query(
    "UPDATE usuarios SET verified = TRUE WHERE id = $1 RETURNING *",
    [userId]
  );
  const { password_hash, ...rest } = updatedRows[0];
  const user = mapRow(rest);
  const token = signToken(user);
  res.json({ success: true, user, token });
}));

module.exports = router;
