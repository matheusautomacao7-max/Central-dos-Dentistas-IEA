from pathlib import Path
import os
import paramiko
import secrets
import sys
import base64

key = paramiko.Ed25519Key.from_private_key_file(
    str(Path(os.environ["IEA_DEPLOY_KEY_PATH"])), password=os.environ["IEA_DEPLOY_KEY_PASSWORD"]
)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("179.197.74.18", username="root", pkey=key, timeout=20, auth_timeout=20)
try:
    if len(sys.argv) > 1 and sys.argv[1] == "upload-compose":
        sftp = client.open_sftp()
        try:
            sftp.put("compose.yaml", "/opt/instituto-ayub/compose.yaml.next")
        finally:
            sftp.close()
        command = (
            "cd /opt/instituto-ayub && "
            "docker compose -f compose.yaml.next config >/dev/null && "
            "mv compose.yaml.next compose.yaml && "
            "docker compose up -d --force-recreate instituto-ayub && "
            "for i in $(seq 1 45); do "
            "curl -fsS http://127.0.0.1:8000/login >/dev/null && "
            "echo APP_RECOVERED=yes && exit 0; "
            "sleep 2; done; "
            "docker compose logs --tail=100 instituto-ayub; exit 1"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "apply-postgres-compat":
        sftp = client.open_sftp()
        try:
            sftp.put(
                "app/postgres_compat.sql",
                "/opt/instituto-ayub/postgres_compat.sql.next",
            )
        finally:
            sftp.close()
        command = (
            "cd /opt/instituto-ayub && "
            "docker exec -i instituto-ayub-postgres "
            "psql -v ON_ERROR_STOP=1 -U instituto_ayub -d instituto_ayub "
            "< postgres_compat.sql.next >/dev/null && "
            "mv postgres_compat.sql.next app/postgres_compat.sql && "
            "echo POSTGRES_COMPAT_APPLIED=yes"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "deploy-db-backend":
        sftp = client.open_sftp()
        try:
            sftp.put(
                "app/db_backend.py",
                "/opt/instituto-ayub/app/db_backend.py.next",
            )
        finally:
            sftp.close()
        command = (
            "cd /opt/instituto-ayub && "
            "python3 -m py_compile app/db_backend.py.next && "
            "mv app/db_backend.py.next app/db_backend.py && "
            "docker compose build instituto-ayub >/dev/null && "
            "docker compose up -d --no-deps --force-recreate instituto-ayub >/dev/null && "
            "for i in $(seq 1 45); do "
            "curl -fsS http://127.0.0.1:8000/login >/dev/null && "
            "echo APP_RECOVERED=yes && exit 0; "
            "sleep 2; done; "
            "docker compose logs --tail=100 instituto-ayub; exit 1"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "deploy-server":
        sftp = client.open_sftp()
        try:
            sftp.put(
                "app/server.py",
                "/opt/instituto-ayub/app/server.py.next",
            )
        finally:
            sftp.close()
        command = (
            "cd /opt/instituto-ayub && "
            "python3 -m py_compile app/server.py.next && "
            "mv app/server.py.next app/server.py && "
            "docker compose build instituto-ayub >/dev/null && "
            "docker compose up -d --no-deps --force-recreate instituto-ayub >/dev/null && "
            "for i in $(seq 1 45); do "
            "curl -fsS http://127.0.0.1:8000/login >/dev/null && "
            "echo APP_RECOVERED=yes && exit 0; "
            "sleep 2; done; "
            "docker compose logs --tail=100 instituto-ayub; exit 1"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "deploy-crm-team-channels":
        sftp = client.open_sftp()
        try:
            sftp.put("app/server.py", "/opt/instituto-ayub/app/server.py.next")
            sftp.put(
                "app/public/crm-whatsapp.html",
                "/opt/instituto-ayub/app/public/crm-whatsapp.html.next",
            )
            sftp.put(
                "app/public/crm-profile-photo-bridge.js",
                "/opt/instituto-ayub/app/public/crm-profile-photo-bridge.js.next",
            )
            sftp.put(
                "app/public/crm-team-channel-bridge.js",
                "/opt/instituto-ayub/app/public/crm-team-channel-bridge.js.next",
            )
            sftp.put(
                "app/public/crm-media-bridge.js",
                "/opt/instituto-ayub/app/public/crm-media-bridge.js.next",
            )
        finally:
            sftp.close()
        command = (
            "cd /opt/instituto-ayub && "
            "python3 -m py_compile app/server.py.next && "
            "mv app/server.py.next app/server.py && "
            "mv app/public/crm-whatsapp.html.next app/public/crm-whatsapp.html && "
            "mv app/public/crm-profile-photo-bridge.js.next app/public/crm-profile-photo-bridge.js && "
            "mv app/public/crm-team-channel-bridge.js.next app/public/crm-team-channel-bridge.js && "
            "mv app/public/crm-media-bridge.js.next app/public/crm-media-bridge.js && "
            "docker compose build instituto-ayub >/dev/null && "
            "docker compose up -d --no-deps --force-recreate instituto-ayub >/dev/null && "
            "for i in $(seq 1 45); do "
            "curl -fsS http://127.0.0.1:8000/login >/dev/null && "
            "echo APP_RECOVERED=yes && exit 0; "
            "sleep 2; done; "
            "docker compose logs --tail=100 instituto-ayub; exit 1"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "deploy-resolution-flow":
        sftp = client.open_sftp()
        try:
            sftp.put("app/server.py", "/opt/instituto-ayub/app/server.py.next")
            sftp.put(
                "app/public/crm-resolution-flow.js",
                "/opt/instituto-ayub/app/public/crm-resolution-flow.js.next",
            )
            sftp.put(
                "app/public/crm-whatsapp.html",
                "/opt/instituto-ayub/app/public/crm-whatsapp.html.next",
            )
            sftp.put(
                "app/public/crm-patient-control.html",
                "/opt/instituto-ayub/app/public/crm-patient-control.html.next",
            )
            sftp.put(
                "app/public/crm-patient-control.js",
                "/opt/instituto-ayub/app/public/crm-patient-control.js.next",
            )
            sftp.put(
                "app/public/crm-profile-photo-bridge.js",
                "/opt/instituto-ayub/app/public/crm-profile-photo-bridge.js.next",
            )
            sftp.put(
                "app/public/crm-media-bridge.js",
                "/opt/instituto-ayub/app/public/crm-media-bridge.js.next",
            )
        finally:
            sftp.close()
        command = (
            "cd /opt/instituto-ayub && "
            "python3 -m py_compile app/server.py.next && "
            "mv app/server.py.next app/server.py && "
            "mv app/public/crm-resolution-flow.js.next app/public/crm-resolution-flow.js && "
            "mv app/public/crm-whatsapp.html.next app/public/crm-whatsapp.html && "
            "mv app/public/crm-patient-control.html.next app/public/crm-patient-control.html && "
            "mv app/public/crm-patient-control.js.next app/public/crm-patient-control.js && "
            "mv app/public/crm-profile-photo-bridge.js.next app/public/crm-profile-photo-bridge.js && "
            "mv app/public/crm-media-bridge.js.next app/public/crm-media-bridge.js && "
            "docker compose build instituto-ayub >/dev/null && "
            "docker compose up -d --no-deps --force-recreate instituto-ayub >/dev/null && "
            "for i in $(seq 1 45); do "
            "curl -fsS http://127.0.0.1:8000/login >/dev/null && "
            "echo APP_RECOVERED=yes && exit 0; "
            "sleep 2; done; "
            "docker compose logs --tail=100 instituto-ayub; exit 1"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "crm-endpoint-smoke":
        sftp = client.open_sftp()
        try:
            sftp.put(
                "scripts/crm_endpoint_smoke.py",
                "/opt/instituto-ayub/crm_endpoint_smoke.py",
            )
        finally:
            sftp.close()
        command = (
            "docker cp /opt/instituto-ayub/crm_endpoint_smoke.py "
            "instituto-ayub:/tmp/crm_endpoint_smoke.py && "
            "docker exec -w /app instituto-ayub "
            "python /tmp/crm_endpoint_smoke.py"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "diagnose-crm-bridges":
        # Diagnóstico somente-leitura: confirma se os bridges chegaram à VPS
        # e se há mensagens de áudio registradas no banco.
        command = (
            "cd /opt/instituto-ayub && "
            "echo ---STATIC--- && "
            "curl -sS -D - -o /dev/null http://127.0.0.1:8000/crm-media-bridge.js | head -8 && "
            "curl -sS -D - -o /dev/null http://127.0.0.1:8000/crm-team-channel-bridge.js | head -8 && "
            "echo ---FILES--- && "
            "wc -c app/public/crm-media-bridge.js app/public/crm-team-channel-bridge.js && "
            "docker exec instituto-ayub sh -lc 'ls -l /app/public/crm-media-bridge.js /app/public/crm-team-channel-bridge.js' && "
            "echo ---CRM-MEDIA--- && "
            "docker exec instituto-ayub python -c \"from server import connect; c=connect(); "
            "print([dict(r) for r in c.execute('select message_type,count(*) as total from crm_messages group by message_type order by message_type').fetchall()]); "
            "print([dict(r) for r in c.execute(\\\"select id,conversation_id,message_type,media_url,duration_seconds,external_message_id from crm_messages where message_type='audio' order by id desc limit 8\\\").fetchall()]); c.close()\""
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "migration-report":
        command = "ls -1t /opt/instituto-ayub/migration-reports/*.json | head -1 | xargs cat"
    elif len(sys.argv) > 1 and sys.argv[1] == "postgres-status":
        command = (
            "cd /opt/instituto-ayub && "
            "docker compose ps && "
            "echo ---FILES--- && "
            "find data backup migration-reports -maxdepth 2 -type f "
            "-printf '%TY-%Tm-%Td %TH:%TM:%TS %s %p\\n' 2>/dev/null | sort | tail -30 && "
            "echo ---APPENV--- && "
            "docker exec instituto-ayub sh -lc "
            "'test -n \"$DATABASE_URL\" && echo DATABASE_URL_CONFIGURED=yes || echo DATABASE_URL_CONFIGURED=no' && "
            "echo ---APPDB--- && "
            "docker exec instituto-ayub python -c "
            "\"from db_backend import using_postgres; "
            "from server import connect; "
            "c=connect(); "
            "print('POSTGRES',using_postgres()); "
            "print('PATIENTS',c.execute('select count(*) from patients').fetchone()[0]); "
            "print('MESSAGES',c.execute('select count(*) from crm_messages').fetchone()[0]); "
            "print('TABLES',c.execute(\\\"select count(*) from information_schema.tables "
            "where table_schema='public'\\\").fetchone()[0]); "
            "c.close()\" && "
            "echo ---HTTP--- && "
            "curl -ksS -o /dev/null -w '%{http_code} %{time_total}\\n' "
            "https://dentistas.automacaocentraliea.me/"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "postgres-smoke":
        command = (
            "cd /opt/instituto-ayub && "
            "docker rm -f instituto-ayub-pg-debug >/dev/null 2>&1 || true; "
            "PW=$(sed -n 's/^POSTGRES_PASSWORD=//p' .env); "
            "docker run -d --name instituto-ayub-pg-debug "
            "--network instituto-ayub_default -p 127.0.0.1:8001:8000 "
            "-e DATABASE_URL=\"postgresql://instituto_ayub:${PW}@postgres:5432/instituto_ayub\" "
            "-e HOST=0.0.0.0 -e PORT=8000 instituto-ayub-postgres-candidate >/dev/null && "
            "sleep 5; "
            "echo ---STATE---; docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' instituto-ayub-pg-debug; "
            "echo ---HTTP---; curl -sS -o /dev/null -w '%{http_code} %{time_total}\\n' "
            "http://127.0.0.1:8001/login || true; "
            "echo ---LOGS---; docker logs --tail=200 instituto-ayub-pg-debug 2>&1; "
            "docker rm -f instituto-ayub-pg-debug >/dev/null 2>&1 || true"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "fix-postgres-auth":
        new_password = secrets.token_hex(32)
        command = (
            "cd /opt/instituto-ayub && "
            "docker exec instituto-ayub-postgres "
            "psql -U instituto_ayub -d instituto_ayub "
            f"-c \"ALTER ROLE instituto_ayub WITH PASSWORD '{new_password}';\" >/dev/null && "
            "(grep -v '^POSTGRES_PASSWORD=' .env 2>/dev/null || true) > .env.next && "
            f"printf '%s\\n' 'POSTGRES_PASSWORD={new_password}' >> .env.next && "
            "mv .env.next .env && chmod 600 .env && "
            "docker compose up -d --force-recreate instituto-ayub && "
            "for i in $(seq 1 60); do "
            "curl -fsS http://127.0.0.1:8000/login >/dev/null && "
            "echo APP_RECOVERED=yes && exit 0; "
            "sleep 2; done; "
            "docker compose logs --tail=120 instituto-ayub; exit 1"
        )
    elif len(sys.argv) > 1 and sys.argv[1] == "diagnose-postgres-auth":
        audit_script = r"""
set -eu
cd /opt/instituto-ayub
python3 - <<'PY'
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.parse import urlparse

env_password = ""
for line in Path(".env").read_text().splitlines():
    if line.startswith("POSTGRES_PASSWORD="):
        env_password = line.split("=", 1)[1]

details = json.loads(subprocess.check_output(
    ["docker", "inspect", "instituto-ayub"], text=True
))[0]
database_url = next(
    item.split("=", 1)[1]
    for item in details["Config"]["Env"]
    if item.startswith("DATABASE_URL=")
)
runtime_password = urlparse(database_url).password or ""
digest = lambda value: hashlib.sha256(value.encode()).hexdigest()[:16]
print("ENV_LENGTH", len(env_password))
print("RUNTIME_LENGTH", len(runtime_password))
print("PASSWORDS_MATCH", env_password == runtime_password)
print("ENV_DIGEST", digest(env_password))
print("RUNTIME_DIGEST", digest(runtime_password))
print("DATABASE_HOST", urlparse(database_url).hostname)
test = subprocess.run(
    [
        "docker", "exec", "-e", f"PGPASSWORD={env_password}",
        "instituto-ayub-postgres", "psql", "-h", "127.0.0.1",
        "-U", "instituto_ayub", "-d", "instituto_ayub",
        "-Atc", "select 1",
    ],
    text=True,
    capture_output=True,
)
print("TCP_PASSWORD_ACCEPTED", test.returncode == 0)
if test.returncode:
    print("TCP_ERROR", test.stderr.strip().splitlines()[-1])
PY
"""
        encoded = base64.b64encode(audit_script.encode()).decode()
        command = f"echo {encoded} | base64 -d | bash"
    elif len(sys.argv) > 1 and sys.argv[1] == "finalize-postgres":
        finalize_script = r"""
set -eu
cd /opt/instituto-ayub
stamp=$(date +%Y%m%d-%H%M%S)
final_dir="/opt/instituto-ayub/backups/postgres-final-$stamp"
mkdir -p "$final_dir"
chmod 700 "$final_dir"

docker exec instituto-ayub-postgres \
  pg_dump -U instituto_ayub -d instituto_ayub -Fc > "$final_dir/instituto-ayub.pgdump"
chmod 600 "$final_dir/instituto-ayub.pgdump"
docker run --rm -i postgres:16-alpine \
  pg_restore --list < "$final_dir/instituto-ayub.pgdump" >/dev/null

docker exec instituto-ayub-postgres \
  psql -v ON_ERROR_STOP=1 -U instituto_ayub -d instituto_ayub \
  -c 'BEGIN; CREATE TEMP TABLE migration_write_probe(id integer); INSERT INTO migration_write_probe VALUES (1); ROLLBACK;' \
  >/dev/null
docker exec instituto-ayub-postgres \
  psql -v ON_ERROR_STOP=1 -U instituto_ayub -d instituto_ayub -c 'ANALYZE;' >/dev/null

if [ -f data/clinic.db ]; then
  python3 - <<'PY'
import sqlite3
connection = sqlite3.connect("/opt/instituto-ayub/data/clinic.db")
result = connection.execute("PRAGMA integrity_check").fetchone()[0]
connection.close()
if result != "ok":
    raise SystemExit("SQLite integrity check failed before retirement")
print("SQLITE_INTEGRITY=ok")
PY
  mv data/clinic.db "$final_dir/clinic.sqlite.retired"
  chmod 600 "$final_dir/clinic.sqlite.retired"
fi

test ! -e data/clinic.db
docker compose ps
curl -fsS http://127.0.0.1:8000/login >/dev/null
echo "POSTGRES_DUMP_VALID=yes"
echo "POSTGRES_WRITE_PROBE=yes"
echo "SQLITE_ACTIVE=no"
echo "FINAL_BACKUP=$final_dir"
"""
        encoded = base64.b64encode(finalize_script.encode()).decode()
        command = f"echo {encoded} | base64 -d | bash"
    elif len(sys.argv) > 1 and sys.argv[1] == "cleanup-crm-contacts":
        cleanup_script = r"""
set -eu
cd /opt/instituto-ayub
stamp=$(date +%Y%m%d-%H%M%S)
backup_dir="/opt/instituto-ayub/backups/crm-contact-cleanup-$stamp"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

# Preserve a restorable snapshot of every CRM record that can be affected
# before removing passive address-book entries.
docker exec instituto-ayub-postgres \
  pg_dump -U instituto_ayub -d instituto_ayub -Fc \
  -t crm_contacts -t crm_conversations -t crm_messages \
  -t crm_service_resolutions -t crm_conversation_events \
  -t crm_n8n_patient_events > "$backup_dir/crm-history-before-cleanup.pgdump"
chmod 600 "$backup_dir/crm-history-before-cleanup.pgdump"
docker run --rm -i postgres:16-alpine \
  pg_restore --list < "$backup_dir/crm-history-before-cleanup.pgdump" >/dev/null

before=$(docker exec instituto-ayub-postgres \
  psql -U instituto_ayub -d instituto_ayub -Atc \
  "SELECT COUNT(*) FROM crm_contacts;")

removed=$(docker exec instituto-ayub-postgres \
  psql -v ON_ERROR_STOP=1 -U instituto_ayub -d instituto_ayub -Atc \
  "WITH removed AS (
     DELETE FROM crm_contacts ct
      WHERE COALESCE(ct.is_internal, 0) = 0
        AND NOT EXISTS (
          SELECT 1 FROM crm_conversations cv WHERE cv.contact_id = ct.id
        )
      RETURNING ct.id
   )
   SELECT COUNT(*) FROM removed;")

after=$(docker exec instituto-ayub-postgres \
  psql -U instituto_ayub -d instituto_ayub -Atc \
  "SELECT COUNT(*) FROM crm_contacts;")
history=$(docker exec instituto-ayub-postgres \
  psql -U instituto_ayub -d instituto_ayub -Atc \
  "SELECT COUNT(*) FROM crm_messages;")

echo "CRM_CONTACTS_BEFORE=$before"
echo "CRM_CONTACTS_REMOVED=$removed"
echo "CRM_CONTACTS_AFTER=$after"
echo "CRM_MESSAGES_PRESERVED=$history"
echo "BACKUP_VALID=yes"
echo "BACKUP_PATH=$backup_dir/crm-history-before-cleanup.pgdump"
"""
        encoded = base64.b64encode(cleanup_script.encode()).decode()
        command = f"echo {encoded} | base64 -d | bash"
    elif len(sys.argv) > 1 and sys.argv[1] == "remove-test-resolution-mateus-defendi":
        def _sql_escape(value: str) -> str:
            return value.replace("'", "''")

        target_phone = _sql_escape(os.environ["CLEANUP_TARGET_PHONE"])
        target_name = _sql_escape(os.environ["CLEANUP_TARGET_NAME"])
        target_resolver = _sql_escape(os.environ["CLEANUP_TARGET_RESOLVER"])
        cleanup_script = f"""
set -eu
cd /opt/instituto-ayub
stamp=$(date +%Y%m%d-%H%M%S)
backup_dir="/opt/instituto-ayub/backups/crm-test-resolution-$stamp"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

# Snapshot only the test resolution before its removal. Conversation messages remain intact.
docker exec instituto-ayub-postgres \\
  pg_dump -U instituto_ayub -d instituto_ayub -Fc \\
  -t crm_service_resolutions > "$backup_dir/crm-service-resolutions-before-delete.pgdump"
chmod 600 "$backup_dir/crm-service-resolutions-before-delete.pgdump"
docker run --rm -i postgres:16-alpine \\
  pg_restore --list < "$backup_dir/crm-service-resolutions-before-delete.pgdump" >/dev/null

matches=$(docker exec instituto-ayub-postgres \\
  psql -v ON_ERROR_STOP=1 -U instituto_ayub -d instituto_ayub -Atc \\
  "SELECT COUNT(*) FROM crm_service_resolutions r JOIN crm_contacts c ON c.id=r.contact_id WHERE c.phone='{target_phone}' AND c.name='{target_name}' AND r.resolved_by_name='{target_resolver}' AND r.outcome='Agendou';")

if [ "$matches" != "1" ]; then
  echo "TEST_RESOLUTION_MATCHES=$matches"
  echo "Refusing to delete: expected exactly one matching test record." >&2
  exit 1
fi

removed=$(docker exec instituto-ayub-postgres \\
  psql -v ON_ERROR_STOP=1 -U instituto_ayub -d instituto_ayub -Atc \\
  "WITH removed AS (DELETE FROM crm_service_resolutions r USING crm_contacts c WHERE r.contact_id=c.id AND c.phone='{target_phone}' AND c.name='{target_name}' AND r.resolved_by_name='{target_resolver}' AND r.outcome='Agendou' RETURNING r.id) SELECT COUNT(*) FROM removed;")

echo "TEST_RESOLUTION_MATCHES=$matches"
echo "TEST_RESOLUTION_REMOVED=$removed"
echo "MESSAGES_PRESERVED=$(docker exec instituto-ayub-postgres psql -U instituto_ayub -d instituto_ayub -Atc 'SELECT COUNT(*) FROM crm_messages;')"
echo "BACKUP_PATH=$backup_dir/crm-service-resolutions-before-delete.pgdump"
"""
        encoded = base64.b64encode(cleanup_script.encode()).decode()
        command = f"echo {encoded} | base64 -d | bash"
    else:
        command = sys.argv[1] if len(sys.argv) > 1 else (
        "cd /opt/instituto-ayub && "
        "echo WORKDIR=$(pwd) && docker compose ps && "
        "ls -lh data/clinic.db && "
        "docker exec instituto-ayub python -c \"import sqlite3; "
        "c=sqlite3.connect('/app/data/clinic.db'); "
        "tables=c.execute(\\\"select name from sqlite_master where type='table' and name not like 'sqlite_%'\\\").fetchall(); "
        "print('TABLES',len(tables)); "
        "print('PATIENTS',c.execute('select count(*) from patients').fetchone()[0]); "
        "print('MESSAGES',c.execute('select count(*) from crm_messages').fetchone()[0])\""
        )
    _, stdout, stderr = client.exec_command(command, timeout=60)
    output = stdout.read().decode("utf-8", errors="replace")
    errors = stderr.read().decode("utf-8", errors="replace")
    status = stdout.channel.recv_exit_status()
    print(output)
    if status:
        raise RuntimeError(errors or f"remote status {status}")
finally:
    client.close()
