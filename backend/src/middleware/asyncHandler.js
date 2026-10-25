// Evita repetir try/catch em toda rota: se uma rota async der erro, ele vai direto
// pro tratamento de erro central.
function asyncHandler(fn) {
  // repassa qualquer erro da rota para o tratador central
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
