#!/usr/bin/env bash
# Baixa o backup mais novo da VM para o Mac. Uso: ./scripts/baixar-backup.sh
# Opcionais: VM_HOST, SSH_KEY, DEST (pasta no Mac) e PASTA_VM (pasta dos backups na VM).
set -euo pipefail

VM_HOST="${VM_HOST:-azureuser@sistema-gestao-obras.northcentralus.cloudapp.azure.com}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/vm-obras_key.pem}"
DEST="${DEST:-$HOME/backups-obras}"
PASTA_VM="${PASTA_VM:-sistema-gestao-obras/backups}"

umask 077
mkdir -p "$DEST"

# pergunta à VM qual é o backup mais novo
ULTIMO=$(ssh -i "$SSH_KEY" "$VM_HOST" "cd $PASTA_VM && ls -1 obras-*.sql.gz 2>/dev/null | sort | tail -n 1")
if [ -z "$ULTIMO" ]; then
  echo "ERRO: a VM não tem nenhum backup em $PASTA_VM." >&2
  exit 1
fi

scp -i "$SSH_KEY" "$VM_HOST:$PASTA_VM/$ULTIMO" "$DEST/"
echo "Backup baixado: $DEST/$ULTIMO"
