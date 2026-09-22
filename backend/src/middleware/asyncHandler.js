// Envolve uma rota async para que qualquer erro (inclusive rejeições de
// Promise) caia automaticamente no middleware de erro central, em vez de
// exigir um try/catch repetido em cada uma das ~20 rotas da API.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
