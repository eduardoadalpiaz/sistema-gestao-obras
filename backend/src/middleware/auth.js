// Login obrigatório: confere o token (JWT) e busca o usuário no banco a cada requisição,
// assim mudança de perfil ou usuário desativado vale na hora, sem esperar o token vencer.
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { JWT_SECRET } = require("../config");

async function authenticate(req, res, next) {
  try {
    const match = (req.headers.authorization || "").match(/^Bearer (.+)$/i);
    if (!match) return res.status(401).json({ message: "Faça login para continuar." });

    let payload;
    try {
      payload = jwt.verify(match[1], JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ message: "Sessão expirada. Entre novamente." });
    }
    // token de verificação de conta não vale como sessão
    if (payload.purpose !== "session") {
      return res.status(401).json({ message: "Sessão inválida. Entre novamente." });
    }

    const { rows } = await query(
      "SELECT id, name, email, role, status, verified FROM usuarios WHERE id = $1",
      [payload.id]
    );
    const user = rows[0];
    if (!user || user.status === "Inativo" || !user.verified) {
      return res.status(401).json({ message: "Sessão inválida. Entre novamente." });
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Barra quem não tem um dos perfis informados (usar depois do authenticate).
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "Você não tem permissão para essa ação." });

module.exports = { authenticate, requireRole };
