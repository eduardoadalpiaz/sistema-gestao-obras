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

// roteador deste assunto; o app.js o conecta ao caminho
const router = express.Router();

// 8 senhas erradas por IP+e-mail e 5 códigos errados por usuário bloqueiam por 15 minutos
const loginAttempts = attemptLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
const codeAttempts = attemptLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

// hash de mentira: quando o e-mail não existe, a conferência gasta o mesmo tempo
const DUMMY_HASH = bcrypt.hashSync("senha-de-mentira", 10);

// token de sessão (8h) e token curto só pra tela de verificação da conta (15 min)
// o token guarda só o id e o tipo; o perfil fica no banco
const signSession = (userId) =>
  // token assinado com o id, vale 8 h
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
  // limpa o e-mail e confere se vieram e-mail e senha
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Informe e-mail e senha." });

  // limite de tentativas por IP e e-mail
  const key = `${req.ip}|${email}`;
  const wait = loginAttempts.blockedFor(key);
  if (wait) return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${minutes(wait)} min.` });

  // 1) acha o usuário pelo e-mail
  const { rows } = await query("SELECT * FROM usuarios WHERE lower(email) = $1", [email]);
  const row = rows[0];

  // 2) compara a senha com o hash (hash falso se o e-mail não existe)
  // a mensagem é a mesma pra e-mail e senha errados, pra não revelar quais e-mails existem
  const valid = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !valid) {
    loginAttempts.fail(key);
    // mesma mensagem para e-mail inexistente e senha errada
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }
  loginAttempts.clear(key);

  // 3) inativo: 403, só depois de conferir a senha
  if (row.status === "Inativo") {
    return res.status(403).json({ error: "Usuário inativo. Contate o administrador." });
  }
  // 4) primeiro acesso: pede o código de verificação
  if (!row.verified) {
    return res.json({ needsVerification: true, user: publicUser(row), verifyToken: signVerify(row.id) });
  }
  // tudo certo: devolve o token de 8 horas
  res.json({ success: true, user: publicUser(row), token: signSession(row.id) });
}));

// Primeiro acesso: a pessoa digita o código de 6 dígitos que o administrador recebeu ao
// cadastrá-la. Só funciona com o token que o login entregou (senha já conferida).
router.post("/verify", asyncHandler(async (req, res) => {
  // recebe o token do login e o código digitado
  const { verifyToken, code } = req.body || {};

  // só aceita HS256; token vencido ou falso: 401
  let payload;
  try {
    payload = jwt.verify(String(verifyToken || ""), JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "Verificação expirada. Faça login de novo." });
  }
  // o token de sessão não vale aqui, só o de verificação
  if (payload.purpose !== "verify") return res.status(401).json({ error: "Verificação inválida." });

  // 5 códigos errados bloqueiam por 15 minutos
  const wait = codeAttempts.blockedFor(payload.id);
  if (wait) return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${minutes(wait)} min.` });

  // usuário não existe: 401; inativo: 403
  const { rows } = await query("SELECT * FROM usuarios WHERE id = $1", [payload.id]);
  const row = rows[0];
  if (!row) return res.status(401).json({ error: "Verificação inválida." });
  if (row.status === "Inativo") return res.status(403).json({ error: "Usuário inativo. Contate o administrador." });

  // comparação em tempo constante
  const sent = Buffer.from(String(code ?? "").trim());
  const real = Buffer.from(String(row.verification_code ?? ""));
  const ok = real.length > 0 && sent.length === real.length && crypto.timingSafeEqual(sent, real);
  // código errado: conta a falha e responde 400
  if (!ok) {
    codeAttempts.fail(row.id);
    return res.status(400).json({ error: "Código inválido." });
  }
  // acertou: zera o contador
  codeAttempts.clear(row.id);

  // marca como verificado e já devolve o token de sessão
  const { rows: updated } = await query(
    "UPDATE usuarios SET verified = TRUE, updated_at = now() WHERE id = $1 RETURNING *",
    [row.id]
  );
  res.json({ success: true, user: publicUser(updated[0]), token: signSession(row.id) });
}));

module.exports = router;
