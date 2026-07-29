#!/usr/bin/env bash
set -euo pipefail

DATA_DIR=/opt/instituto-ayub/data
BACKUP_DIR=/opt/instituto-ayub/backups
STAMP=$(date -u +%Y%m%d-%H%M%S)
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-instituto-ayub-postgres}"
POSTGRES_USER="${POSTGRES_USER:-instituto_ayub}"
POSTGRES_DB="${POSTGRES_DB:-instituto_ayub}"

install -d -m 700 "$BACKUP_DIR"

if docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
    # Produção atual roda em PostgreSQL (ver compose.yaml). O backup real dos
    # dados de pacientes é este dump, não o clinic.db local (que só existe em
    # instalações que ainda usam SQLite e, se ausente, geraria um arquivo
    # vazio silenciosamente).
    TARGET="$BACKUP_DIR/clinic-$STAMP.pgdump"
    docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$TARGET"
    chmod 600 "$TARGET"
    docker run --rm -i postgres:16-alpine pg_restore --list < "$TARGET" >/dev/null
elif [ -f "$DATA_DIR/clinic.db" ]; then
    TARGET="$BACKUP_DIR/clinic-$STAMP.db"
    python3 - "$DATA_DIR/clinic.db" "$TARGET" <<'PY'
import sqlite3, sys
source, target = sys.argv[1:]
with sqlite3.connect(source) as origin, sqlite3.connect(target) as destination:
    origin.backup(destination)
with sqlite3.connect(target) as check:
    result = check.execute('PRAGMA integrity_check').fetchone()[0]
    if result.lower() != 'ok':
        raise SystemExit(result)
PY
    chmod 600 "$TARGET"
else
    echo "ERRO: nem o container $POSTGRES_CONTAINER nem $DATA_DIR/clinic.db foram encontrados — nada para fazer backup." >&2
    exit 1
fi

# SEC-013: cifrar o backup em repouso com age, se uma chave pública estiver
# configurada (AGE_PUBLIC_KEY, ex.: em /etc/instituto-ayub/backup.env). Sem a
# chave, mantém o comportamento anterior (arquivo em claro, permissão 600) e
# avisa no log em vez de falhar o cron silenciosamente.
if [ -n "${AGE_PUBLIC_KEY:-}" ] && command -v age >/dev/null 2>&1; then
    age -r "$AGE_PUBLIC_KEY" -o "$TARGET.age" "$TARGET"
    chmod 600 "$TARGET.age"
    if command -v shred >/dev/null 2>&1; then
        shred -u "$TARGET"
    else
        rm -f "$TARGET"
    fi
    TARGET="$TARGET.age"
else
    echo "AVISO: AGE_PUBLIC_KEY não configurada ou 'age' não instalado — backup gravado em texto claro ($TARGET). Configure AGE_PUBLIC_KEY para cifrar em repouso (SEC-013)." >&2
fi

# SEC-013: réplica externa (recomendado). Requer configurar previamente um
# remote do rclone com as credenciais do seu armazenamento de objeto (S3,
# Backblaze, etc.) — não incluído aqui por depender de segredos próprios do
# usuário. Exemplo, uma vez configurado /etc/rclone-readonly.conf:
#   rclone copy "$TARGET" remote:instituto-ayub-backups/ --config /etc/rclone-readonly.conf
if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
    rclone copy "$TARGET" "$RCLONE_REMOTE" ${RCLONE_CONFIG:+--config "$RCLONE_CONFIG"}
fi

find "$BACKUP_DIR" -type f \( -name 'clinic-*.db' -o -name 'clinic-*.db.age' -o -name 'clinic-*.pgdump' -o -name 'clinic-*.pgdump.age' \) -mtime +30 -delete
echo "Backup validado: $TARGET"
