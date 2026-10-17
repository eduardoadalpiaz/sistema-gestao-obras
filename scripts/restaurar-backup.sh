#!/usr/bin/env bash
# Restaura um backup (.sql.gz). Por padrão só TESTA, num banco separado (obras_restore_test).
# Uso: ./scripts/restaurar-backup.sh arquivo.sql.gz
#      ./scripts/restaurar-backup.sh --producao arquivo.sql.gz   (substitui o banco de verdade)
set -euo pipefail
cd "$(dirname "$0")/.."

PRODUCAO=0
if [ "${1:-}" = "--producao" ]; then PRODUCAO=1; shift; fi
ARQUIVO="${1:-}"

if [ -z "$ARQUIVO" ]; then
  echo "Uso: $0 [--producao] arquivo.sql.gz" >&2
  exit 2
fi
if [ ! -f "$ARQUIVO" ]; then
  echo "ERRO: arquivo não encontrado: $ARQUIVO" >&2
  exit 1
fi

# restaura dentro de uma transação única: se algo falhar, nada fica pela metade
if [ "$PRODUCAO" -eq 1 ]; then
  echo "ATENÇÃO: isto SUBSTITUI os dados do banco de verdade pelos do backup."
  printf 'Digite RESTAURAR para continuar: '
  RESPOSTA=""
  read -r RESPOSTA || true
  if [ "$RESPOSTA" != "RESTAURAR" ]; then
    echo "ERRO: cancelado, nada foi alterado." >&2
    exit 1
  fi
  gunzip -c "$ARQUIVO" | docker compose exec -T db sh -c 'PGOPTIONS="-c client_min_messages=warning" psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction' > /dev/null
  echo "Banco de verdade restaurado a partir de $ARQUIVO"
  exit 0
fi

# modo teste: recria um banco descartável e restaura nele
docker compose exec -T db sh -c 'PGOPTIONS="-c client_min_messages=warning" psql -q -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS obras_restore_test" -c "CREATE DATABASE obras_restore_test"'
gunzip -c "$ARQUIVO" | docker compose exec -T db sh -c 'PGOPTIONS="-c client_min_messages=warning" psql -q -U "$POSTGRES_USER" -d obras_restore_test -v ON_ERROR_STOP=1 --single-transaction' > /dev/null

TABELAS=$(docker compose exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d obras_restore_test -t -A -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\"" | tr -d ' \r\n')
echo "tabelas restauradas: $TABELAS"

docker compose exec -T db sh -c 'PGOPTIONS="-c client_min_messages=warning" psql -q -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS obras_restore_test"'
echo "Teste concluído (banco de teste removido). O banco de verdade não foi tocado."
