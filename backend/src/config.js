// Configurações de segurança compartilhadas pelas rotas.
const crypto = require("crypto");

// O segredo do token vem do JWT_SECRET. Se não existir (ou for um valor de exemplo),
// gera um aleatório na hora de subir o servidor: funciona, mas os logins caem a cada reinício.
let secret = process.env.JWT_SECRET;
if (!secret || secret.length < 24 || /^troque/i.test(secret)) {
  secret = crypto.randomBytes(48).toString("hex");
  console.warn("[segurança] JWT_SECRET ausente ou fraco: usando um segredo temporário. Defina JWT_SECRET no .env do servidor.");
}

module.exports = {
  JWT_SECRET: secret,
  SESSION_TTL: "8h",
  VERIFY_TTL: "15m",
  ROLES: ["Administrativo", "Engenheiro", "Mestre de Obras", "Visualizador", "TI", "Dono"],
};
