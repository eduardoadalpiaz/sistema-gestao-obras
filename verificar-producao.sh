#!/usr/bin/env bash
# Confere a segurança do sistema já publicado (site e API no mesmo servidor, atrás do Caddy).
# Uso: ./verificar-producao.sh https://seu-dominio https://seu-dominio/api
# Precisa só do curl (já vem no Mac). Não altera nada: só faz consultas.

FRONT="${1:-}"; API="${2:-}"
if [ -z "$FRONT" ] || [ -z "$API" ]; then
  echo "Uso: $0 <endereço do front> <endereço do backend>"
  echo "Ex.: $0 https://meu-dominio.com https://meu-dominio.com/api"
  exit 2
fi
FRONT="${FRONT%/}"; API="${API%/}"
ok=0; warn=0; bad=0
pass()  { echo "  [OK]       $1"; ok=$((ok+1)); }
alert() { echo "  [ATENÇÃO]  $1"; warn=$((warn+1)); }
fail()  { echo "  [FALHA]    $1"; bad=$((bad+1)); }
code()  { curl -s -o /dev/null -w "%{http_code}" --max-time 25 "$@"; }
header_of() { curl -s -D - -o /dev/null --max-time 25 "${@:2}" | tr -d '\r' | grep -i "^$1:" | head -1 | sed -E "s/^[^:]*:[[:space:]]*//"; }

echo "Verificando: front = $FRONT | backend = $API"

echo; echo "1) Backend no ar"
h=$(curl -s --max-time 25 "$API/health")
if echo "$h" | grep -q '"database":"connected"'; then pass "/health responde e o banco está conectado"
else fail "/health não respondeu como esperado: $h"; fi

echo; echo "2) Rotas protegidas exigem login (sem token tem que dar 401)"
check401() { # método rota
  c=$(code -X "$1" "$API$2" -H "Content-Type: application/json" -d '{}')
  if [ "$c" = "401" ]; then pass "$1 $2 sem login -> 401"
  else fail "$1 $2 sem login -> $c (deveria ser 401: qualquer pessoa consegue usar esta rota)"; fi
}
check401 GET /data; check401 GET /audit; check401 POST /obras; check401 POST /users
check401 POST /gastos; check401 POST /documentos; check401 POST /ai/analyze-obra

echo; echo "3) CORS (quem pode chamar o backend pelo navegador)"
o=$(header_of access-control-allow-origin "$API/health" -H "Origin: $FRONT")
if [ "$o" = "$FRONT" ]; then pass "o front publicado tem permissão"
elif [ "$o" = "*" ]; then alert "CORS liberado para qualquer site: defina CORS_ORIGIN=$FRONT no .env do servidor"
else alert "o front publicado não recebeu permissão de CORS (recebeu: '${o:-nada}'): confira CORS_ORIGIN no .env do servidor"; fi
e=$(header_of access-control-allow-origin "$API/health" -H "Origin: https://site-malicioso.example")
# o navegador só libera se o valor devolvido for igual ao site que pediu (ou "*")
if [ "$e" = "*" ] || [ "$e" = "https://site-malicioso.example" ]; then alert "um site estranho recebeu permissão de CORS ('$e')"
else pass "um site qualquer NÃO tem permissão"; fi

echo; echo "4) Cabeçalhos de segurança"
[ -z "$(header_of x-powered-by "$API/health")" ] && pass "backend não anuncia a tecnologia (x-powered-by)" || alert "backend anuncia x-powered-by"
[ -n "$(header_of x-content-type-options "$API/health")" ] && pass "backend envia x-content-type-options" || alert "backend sem x-content-type-options"
[ -n "$(header_of x-content-type-options "$FRONT/")" ] && pass "front envia x-content-type-options" || alert "front sem x-content-type-options (Caddyfile aplicado?)"
[ -n "$(header_of x-frame-options "$FRONT/")" ] && pass "front envia x-frame-options (não pode ser embutido em outro site)" || alert "front sem x-frame-options (Caddyfile aplicado?)"

echo; echo "5) Senha padrão"
c=$(code -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@obras.com","password":"admin123"}')
case "$c" in
  200) fail "o login admin@obras.com / admin123 AINDA FUNCIONA: troque a senha na tela Usuários";;
  401) pass "a senha padrão do admin não funciona mais";;
  429) alert "login bloqueado por excesso de tentativas: rode de novo daqui a 15 minutos";;
  *)   alert "resposta inesperada no login: $c";;
esac

echo; echo "6) Nada secreto no código do front publicado"
html=$(curl -s --max-time 25 "$FRONT/")
scripts=$(echo "$html" | grep -oE 'src="[^"]*\.js"' | sed -E 's/^src="//; s/"$//')
if [ -z "$scripts" ]; then alert "não encontrei os arquivos JS do front em $FRONT/"; fi
bundle=""
for s in $scripts; do
  case "$s" in http*) u="$s";; /*) u="$FRONT$s";; *) u="$FRONT/$s";; esac
  bundle="$bundle$(curl -s --max-time 40 "$u")"
done
scan() { # descrição, regex
  if echo "$bundle" | grep -Eq "$2"; then fail "o código do front contém $1"; else pass "o código do front não contém $1"; fi
}
scan "chave do Google/Gemini (AIza...)" 'AIza[0-9A-Za-z_-]{20,}'
scan "endereço de banco de dados" 'postgres(ql)?://'
scan "endereço da API do Gemini (a IA só deve ser chamada pelo backend)" 'generativelanguage'
scan "nomes de variáveis secretas" 'GEMINI_API_KEY|JWT_SECRET|DATABASE_URL'
scan "hash de senha" '\$2[aby]\$[0-9]{2}\$'
scan "chave no formato sk-..." 'sk-[A-Za-z0-9]{20,}'
if echo "$bundle" | grep -q "localhost:3001"; then
  alert "o front publicado aponta pro backend LOCAL (localhost:3001): defina VITE_API_BASE no build do front e publique de novo"
else
  pass "o front não aponta para o backend local (usa o endereço /api do próprio servidor)"
fi
if echo "$bundle" | grep -q "sourceMappingURL"; then alert "o front publica mapas de código (.map), que mostram o código-fonte original"; else pass "o front não publica mapas de código-fonte"; fi

echo; echo "Resumo: $ok ok, $warn atenção, $bad falha(s)"
[ "$bad" -gt 0 ] && exit 1
exit 0
