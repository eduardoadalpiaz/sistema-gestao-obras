// Cria o primeiro administrador: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/criar-admin.js
require("dotenv").config();
const { createInitialAdmin } = require("../src/utils/adminInicial");
const { pool } = require("../src/db");

(async () => {
  try {
    const admin = await createInitialAdmin({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    console.log(admin ? `Administrador criado: ${admin.email}` : "Já existem usuários, nada foi criado.");
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await pool.end(); // fecha a conexão com o banco
  }
})();
