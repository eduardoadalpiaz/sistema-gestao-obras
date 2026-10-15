// Prepara um texto de fora (usuário ou API externa) para ir ao log: sem quebra de linha e com tamanho limitado.
function paraLog(texto, max = 300) {
  return String(texto).replace(/[\r\n]+/g, " ").slice(0, max);
}

module.exports = { paraLog };
