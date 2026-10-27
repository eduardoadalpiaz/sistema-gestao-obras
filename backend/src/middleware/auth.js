// Login obrigatório: confere o token (JWT) e busca o usuário no banco a cada requisição,
// assim mudança de perfil ou usuário desativado vale na hora, sem esperar o token vencer.
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { JWT_SECRET } = require("../config");

async function authenticate(req, res, next) {
  try {
    // pega o token do cabeçalho Authorization
    const match = (req.headers.authorization || "").match(/^Bearer (.+)$/i);
    if (!match) return res.status(401).json({ message: "Faça login para continuar." });

    // confere a assinatura e a validade do token
    let payload;
    try {
      // confere assinatura e validade do token (só HS256)
      payload = jwt.verify(match[1], JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ message: "Sessão expirada. Entre novamente." });
    }
    // token de verificação de conta não vale como sessão
    if (payload.purpose !== "session") {
      return res.status(401).json({ message: "Sessão inválida. Entre novamente." });
    }

    // busca o usuário no banco a cada requisição; o perfil vem do banco, não do token
    const { rows } = await query(
      // busca o usuário no banco a cada pedido
      "SELECT id, name, email, role, status, verified FROM usuarios WHERE id = $1",
      [payload.id]
    );
    const user = rows[0];
    // apagado, inativo ou não verificado: 401
    if (!user || user.status === "Inativo" || !user.verified) {
      return res.status(401).json({ message: "Sessão inválida. Entre novamente." });
    }
    // guarda quem é o usuário para as próximas etapas
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Barra quem não tem um dos perfis informados (usar depois do authenticate).
const requireRole = (...roles) => (req, res, next) =>
  // perfil na lista segue; senão responde 403
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "Você não tem permissão para essa ação." });

module.exports = { authenticate, requireRole };
