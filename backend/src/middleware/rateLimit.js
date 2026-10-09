// Limitadores de uso guardados em memória (somem se o servidor reiniciar).

// Limite simples: no máximo `max` requisições por janela, por chave (padrão: IP).
function rateLimit({ windowMs, max, keyFn, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, Math.min(windowMs, 60_000)).unref();

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ message: message || "Muitas requisições. Tente de novo em alguns minutos." });
    }
    next();
  };
}

// Contador de erros (senha ou código errado): depois de `max` erros, bloqueia a chave
// até a janela passar. Acerto zera o contador.
function attemptLimiter({ windowMs, max }) {
  const fails = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of fails) if (entry.reset <= now) fails.delete(key);
  }, Math.min(windowMs, 60_000)).unref();

  return {
    // devolve quantos segundos faltam pro desbloqueio (0 = liberado)
    blockedFor(key) {
      const entry = fails.get(key);
      if (!entry || entry.reset <= Date.now() || entry.count < max) return 0;
      return Math.ceil((entry.reset - Date.now()) / 1000);
    },
    fail(key) {
      const now = Date.now();
      let entry = fails.get(key);
      if (!entry || entry.reset <= now) entry = { count: 0, reset: now + windowMs };
      entry.count += 1;
      fails.set(key, entry);
    },
    clear(key) { fails.delete(key); },
  };
}

module.exports = { rateLimit, attemptLimiter };
