// Cria o primeiro administrador do sistema, com a senha escolhida na hora (nada fixo no código).
const bcrypt = require("bcryptjs");
const { query } = require("../db");

const MIN_PASSWORD = 12;

async function createInitialAdmin({ name = "Administrador", email, password }) {
  // confere e-mail e tamanho da senha
  if (!email || !password || password.length < MIN_PASSWORD) {
    throw new Error(`Informe o e-mail e uma senha com pelo menos ${MIN_PASSWORD} caracteres.`);
  }
  // só cria se o banco ainda não tem nenhum usuário
  const { rows } = await query("SELECT 1 FROM usuarios LIMIT 1");
  if (rows.length > 0) return null;

  const hash = await bcrypt.hash(password, 10);
  const created = await query(
    `INSERT INTO usuarios (name, email, password_hash, role, status, verified)
     VALUES ($1, $2, $3, 'Administrativo', 'Ativo', TRUE)
     RETURNING id, email`,
    [name, email.toLowerCase(), hash]
  );
  return created.rows[0];
}

module.exports = { createInitialAdmin };