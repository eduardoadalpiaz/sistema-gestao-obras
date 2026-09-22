const { query } = require("./db");
const { toSnake, mapRow, mapRows } = require("./utils/caseConvert");

// SELECT * FROM table ORDER BY orderBy, com paginação OPCIONAL (Escalabilidade):
// sem `limit`, o comportamento é idêntico ao de sempre (retorna tudo) — o
// front-end atual não muda nada. Passando limit/offset, dá pra buscar em
// páginas, o que evita carregar o histórico inteiro de uma vez quando o
// volume de obras/despesas/etc. crescer muito.
async function selectAll(table, orderBy = "created_at", ascending = true, { limit, offset } = {}) {
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
  const { rows } = await query(`SELECT COUNT(*)::int AS total FROM ${table}`);
  return rows[0].total;
}

// INSERT (camelCase body) -> returns inserted row (camelCase)
async function insertRow(table, body) {
  const data = toSnake(body);
  const keys = Object.keys(data);
  const values = Object.values(data);
  const columns = keys.join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await query(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return mapRow(rows[0]);
}

// UPDATE (partial camelCase body) by id -> returns updated row (camelCase)
async function updateRow(table, id, body) {
  const data = toSnake(body);
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

// Same as updateRow but for tables without an updated_at column
async function updateRowNoTimestamp(table, id, body) {
  const data = toSnake(body);
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

async function deleteRow(table, id) {
  await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

module.exports = { selectAll, countAll, insertRow, updateRow, updateRowNoTimestamp, deleteRow };
