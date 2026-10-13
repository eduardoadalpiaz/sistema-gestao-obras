// Funções genéricas de banco (listar, inserir, atualizar e apagar) usadas por todas as rotas.
// Elas convertem camelCase <-> snake_case, então as rotas não precisam escrever SQL.
const { query } = require("./db");
const { toSnake, mapRow, mapRows } = require("./utils/caseConvert");

// Colunas que podem ser gravadas em cada tabela. O que não estiver aqui é descartado
// antes de montar o SQL (id e datas ficam de fora porque o banco que preenche).
const COLUMNS = {
  usuarios: ["name", "email", "password_hash", "phone", "role", "status", "verified", "verification_code"],
  obras: ["name", "client", "cep", "street", "street_number", "neighborhood", "city", "state", "responsible_id", "status", "progress",
    "start_date", "end_date", "area", "floors", "units", "team_size", "team_members", "estimated_cost",
    "client_budget", "tipo", "complexidade"],
  etapas: ["obra_id", "name", "responsible_id", "planned_start", "planned_end", "actual_end", "progress", "status", "notes"],
  despesas_obra: ["obra_id", "etapa_id", "description", "category", "value", "date", "fornecedor", "notes",
    "receipt", "receipt_name", "created_by"],
  documentos_obra: ["obra_id", "title", "type", "status", "issue_date", "expiry_date", "notes", "file", "file_name", "uploaded_by"],
  notificacoes: ["type", "message", "obra_id", "read"],
  historico_alteracoes: ["user_id", "user_name", "action", "module", "target_name", "field", "old_value", "new_value"],
};

// Mantém só as colunas permitidas da tabela. Nome de coluna nunca vem direto do usuário pro SQL.
function pickColumns(table, data) {
  const allowed = COLUMNS[table];
  if (!allowed) throw new Error(`Tabela não permitida: ${table}`);
  const out = {};
  for (const key of Object.keys(data)) {
    if (allowed.includes(key)) out[key] = data[key];
  }
  return out;
}

// SELECT * com ORDER BY. A paginação é opcional: sem limit/offset devolve tudo
// (como o front espera); com eles dá pra buscar por páginas quando tiver muitos registros.
async function selectAll(table, orderBy = "created_at", ascending = true, { limit, offset } = {}) {
  if (!COLUMNS[table]) throw new Error(`Tabela não permitida: ${table}`);
  const dir = ascending ? "ASC" : "DESC";
  let sql = `SELECT * FROM ${table} ORDER BY ${orderBy} ${dir}`;
  const params = [];
  if (limit != null) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    if (offset != null) {
      params.push(offset);
      sql += ` OFFSET $${params.length}`;
    }
  }
  const { rows } = await query(sql, params);
  return mapRows(rows);
}

async function countAll(table) {
  if (!COLUMNS[table]) throw new Error(`Tabela não permitida: ${table}`);
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM ${table}`);
  return rows[0].total;
}

// INSERT: recebe o body em camelCase e devolve a linha inserida (também em camelCase)
async function insertRow(table, body) {
  const data = pickColumns(table, toSnake(body));
  const keys = Object.keys(data);
  if (keys.length === 0) throw Object.assign(new Error("Nenhum campo válido para gravar."), { status: 400 });
  const values = Object.values(data);
  const columns = keys.join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await query(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return mapRow(rows[0]);
}

// UPDATE parcial por id: recebe só os campos que mudaram e devolve a linha atualizada
async function updateRow(table, id, body) {
  const data = pickColumns(table, toSnake(body));
  const keys = Object.keys(data);
  if (keys.length === 0) {
    const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return mapRow(rows[0]);
  }
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = Object.values(data);
  const { rows } = await query(
    `UPDATE ${table} SET ${setClause}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
    [...values, id]
  );
  return mapRow(rows[0]);
}

// Igual ao updateRow, mas para tabelas sem a coluna updated_at
async function updateRowNoTimestamp(table, id, body) {
  const data = pickColumns(table, toSnake(body));
  const keys = Object.keys(data);
  if (keys.length === 0) {
    const { rows } = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return mapRow(rows[0]);
  }
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = Object.values(data);
  const { rows } = await query(
    `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
    [...values, id]
  );
  return mapRow(rows[0]);
}

// apaga a linha pelo id
async function deleteRow(table, id) {
  await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

module.exports = { selectAll, countAll, insertRow, updateRow, updateRowNoTimestamp, deleteRow };
