// Rotas de login: POST /auth/login e POST /auth/verify.
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const { query } = require("../db");
const { mapRow } = require("../utils/caseConvert");
const { asyncHandler } = require("../middleware/asyncHandler");
const { attemptLimiter } = require("../middleware/rateLimit");
const { JWT_SECRET, SESSION_TTL, VERIFY_TTL } = require("../config");

const router = express.Router();

// 8 senhas erradas por IP+e-mail e 5 códigos errados por usuário bloqueiam por 15 minutos
const loginAttempts = attemptLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const codeAttempts = attemptLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

// hash de mentira: quando o e-mail não existe, a conferência gasta o mesmo tempo
const DUMMY_HASH = bcrypt.hashSync("senha-de-mentira", 10);

// token de sessão (8h) e token curto só pra tela de verificação da conta (15 min)
const signSession = (userId) =>
  jwt.sign({ id: userId, purpose: "session" }, JWT_SECRET, { algorithm: "HS256", expiresIn: SESSION_TTL });
const signVerify = (userId) =>
  jwt.sign({ id: userId, purpose: "verify" }, JWT_SECRET, { algorithm: "HS256", expiresIn: VERIFY_TTL });

// usuário pronto pra ir pro front: sem hash da senha e sem código de verificação
function publicUser(row) {
  const { password_hash, verification_code, ...rest } = row;
  return mapRow(rest);
}

const minutes = (seconds) => Math.max(1, Math.ceil(seconds / 60));

// Login em 4 passos: acha o usuário pelo e-mail, compara a senha com o hash (bcrypt),
// barra usuário inativo e, se a conta ainda não foi verificada, devolve needsVerification
// com um token curto pra tela do código.
router.post("/login", asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Informe e-mail e senha." });

  const key = `${req.ip}|${email}`;
  const wait = loginAttempts.blockedFor(key);
  if (wait) return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${minutes(wait)} min.` });

  const { rows } = await query("SELECT * FROM usuarios WHERE lower(email) = $1", [email]);
  const row = rows[0];

  // a mensagem é a mesma pra e-mail e senha errados, pra não revelar quais e-mails existem
  const valid = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !valid) {
    loginAttempts.fail(key);
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }
  loginAttempts.clear(key);

  if (row.status === "Inativo") {
    return res.status(403).json({ error: "Usuário inativo. Contate o administrador." });
  }
  if (!row.verified) {
    return res.json({ needsVerification: true, user: publicUser(row), verifyToken: signVerify(row.id) });
  }
  res.json({ success: true, user: publicUser(row), token: signSession(row.id) });
}));

// Primeiro acesso: a pessoa digita o código de 6 dígitos que o administrador recebeu ao
// cadastrá-la. Só funciona com o token que o login entregou (senha já conferida).
router.post("/verify", asyncHandler(async (req, res) => {
  const { verifyToken, code } = req.body || {};

  let payload;
  try {
    payload = jwt.verify(String(verifyToken || ""), JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "Verificação expirada. Faça login de novo." });
  }
  if (payload.purpose !== "verify") return res.status(401).json({ error: "Verificação inválida." });

  const wait = codeAttempts.blockedFor(payload.id);
  if (wait) return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${minutes(wait)} min.` });

  const { rows } = await query("SELECT * FROM usuarios WHERE id = $1", [payload.id]);
  const row = rows[0];
  if (!row) return res.status(401).json({ error: "Verificação inválida." });
  if (row.status === "Inativo") return res.status(403).json({ error: "Usuário inativo. Contate o administrador." });

  // comparação em tempo constante
  const sent = Buffer.from(String(code ?? "").trim());
  const real = Buffer.from(String(row.verification_code ?? ""));
  const ok = real.length > 0 && sent.length === real.length && crypto.timingSafeEqual(sent, real);
  if (!ok) {
    codeAttempts.fail(row.id);
    return res.status(400).json({ error: "Código inválido." });
  }
  codeAttempts.clear(row.id);

  const { rows: updated } = await query(
    "UPDATE usuarios SET verified = TRUE, updated_at = now() WHERE id = $1 RETURNING *",
    [row.id]
  );
  res.json({ success: true, user: publicUser(updated[0]), token: signSession(row.id) });
}));

module.exports = router;
