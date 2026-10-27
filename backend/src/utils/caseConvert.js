// Converte as chaves entre snake_case (banco) e camelCase (API e front).

function toCamel(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    // troca _x por X: start_date vira startDate
    out[k.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = v;
  }
  return out;
}

function toSnake(obj) {
  if (!obj) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)] = v;
  }
  return out;
}

const mapRows = (rows) => (rows ?? []).map(toCamel);
const mapRow = (row) => (row ? toCamel(row) : null);

module.exports = { toCamel, toSnake, mapRows, mapRow };
