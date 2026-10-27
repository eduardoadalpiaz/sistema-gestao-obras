#!/usr/bin/env bash
# Backup do banco: exporta com pg_dump, comprime e mantém só os mais novos.
# Uso (na VM, em qualquer pasta): ./scripts/backup-banco.sh
# Opcionais: BACKUP_DIR (pasta, padrão "backups") e KEEP (quantos guardar, padrão 14).
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-backups}"
# quantos backups guardar (padrão 14)
KEEP="${KEEP:-14}"

umask 077                                   # só o dono lê os arquivos
mkdir -p "$BACKUP_DIR"
ARQUIVO="$BACKUP_DIR/obras-$(date +%Y%m%d-%H%M%S).sql.gz"
PARCIAL="$ARQUIVO.parcial"
trap 'rm -f "$PARCIAL"' EXIT                # nunca deixa arquivo pela metade

# usuário e banco vêm das variáveis do próprio container (nenhuma senha aqui)
if ! docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' | gzip > "$PARCIAL"; then
  echo "ERRO: o pg_dump falhou; nenhum backup foi gravado." >&2
  exit 1
fi

# dump sem conteúdo não vale como backup
if [ "$(gunzip -c "$PARCIAL" | wc -c)" -eq 0 ]; then
  echo "ERRO: o dump veio vazio; nenhum backup foi gravado." >&2
  exit 1
fi

# só no fim o arquivo ganha o nome final
mv "$PARCIAL" "$ARQUIVO"
echo "Backup gravado: $ARQUIVO"

# apaga os mais antigos, só depois de o novo estar salvo
ls -1 "$BACKUP_DIR"/obras-*.sql.gz | sort -r | tail -n +"$((KEEP + 1))" | while read -r antigo; do
  rm -f "$antigo"
done
