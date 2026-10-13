// Tempo real: mantém conexões abertas (SSE) e avisa todo mundo quando algum dado muda.
// O aviso não leva dados; cada tela busca o /data de novo, já com a verificação de login.
const clients = new Map(); // conexão -> id do usuário
const MAX_CLIENTS = 300;
const MAX_PER_USER = 5;

// abre a conexão de um usuário já autenticado
function subscribe(req, res) {
  let sameUser = 0;
  for (const id of clients.values()) if (id === req.user.id) sameUser += 1;
  if (clients.size >= MAX_CLIENTS || sameUser >= MAX_PER_USER) {
    return res.status(429).json({ message: "Conexões demais abertas." });
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 5000\n\n: conectado\n\n");
  clients.set(res, req.user.id);
  req.on("close", () => clients.delete(res));
}

function send(text) {
  for (const res of clients.keys()) {
    try { res.write(text); } catch { clients.delete(res); }
  }
}

// várias mudanças seguidas viram um aviso só (espera 300 ms)
let timer = null;
function notifyChange() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    send("event: changed\ndata: {}\n\n");
  }, 300);
}

// sinal de vida a cada 25 s, pro proxy não fechar a conexão parada
setInterval(() => send(": ping\n\n"), 25_000).unref();

// usado no encerramento do servidor
function closeAll() {
  for (const res of clients.keys()) res.end();
  clients.clear();
}

module.exports = { subscribe, notifyChange, closeAll };
