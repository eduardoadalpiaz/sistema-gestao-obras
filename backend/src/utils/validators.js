// Validações de entrada compartilhadas pelas rotas.

// Só aceita imagem (png, jpeg, webp, gif) ou PDF em base64, e confere se o conteúdo
// bate com o tipo declarado (os primeiros bytes de cada formato). Bloqueia SVG e HTML.
const DATA_URL = /^data:(image\/png|image\/jpeg|image\/webp|image\/gif|application\/pdf);base64,([A-Za-z0-9+/]*={0,2})$/;
const MAGIC = {
  "image/png":  (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  "image/jpeg": (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/gif":  (b) => b.subarray(0, 4).toString("latin1") === "GIF8",
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  // um PDF de verdade começa com %PDF
  "application/pdf": (b) => b.subarray(0, 4).toString("latin1") === "%PDF",
};
// limite de 6 MB por arquivo
const MAX_FILE_BYTES = 6 * 1024 * 1024;

// devolve a mensagem de erro, ou null se estiver tudo certo (vazio também é válido)
function checkFileField(value, label) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return `${label} inválido.`;
  const m = DATA_URL.exec(value);
  if (!m) return `${label}: formato não permitido (use JPG, PNG, WEBP, GIF ou PDF).`;
  if (m[2].length * 0.75 > MAX_FILE_BYTES) return `${label} muito grande (máximo 6 MB).`;
  const head = Buffer.from(m[2].slice(0, 64), "base64");
  // os primeiros bytes têm de bater com o tipo declarado
  if (!MAGIC[m[1]](head)) return `${label}: o conteúdo não bate com o tipo do arquivo.`;
  return null;
}

// nome de arquivo sem barras e com tamanho limitado
function cleanFileName(name) {
  if (name === undefined || name === null) return name;
  // troca barras por _ e corta em 200 caracteres
  return String(name).replace(/[\\/\0]/g, "_").slice(0, 200);
}

function isStringList(value, maxItems, maxLen) {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every((v) => typeof v === "string" && v.length <= maxLen);
}

function isProgress(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

module.exports = { checkFileField, cleanFileName, isStringList, isProgress };
