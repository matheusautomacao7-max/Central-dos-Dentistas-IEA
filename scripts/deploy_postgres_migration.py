"""Safely stage, validate and cut production from SQLite to PostgreSQL."""
from __future__ import annotations

import json
import os
import secrets
import shlex
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
KEY_PATH = Path(os.environ["IEA_DEPLOY_KEY_PATH"])
PASSPHRASE = os.environ["IEA_DEPLOY_KEY_PASSWORD"]
HOST = "179.197.74.18"
REMOTE = "/opt/instituto-ayub"
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(errors="replace")


def run(client, command: str, timeout=300, check=True, quiet=False):
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    output = stdout.read().decode("utf-8", errors="replace")
    error = stderr.read().decode("utf-8", errors="replace")
    status = stdout.channel.recv_exit_status()
    if not quiet:
        print(output, end="")
    if error and not quiet:
        print(error, end="")
    if check and status:
        raise RuntimeError(f"Comando remoto falhou ({status}): {command}\n{error or output}")
    return status, output, error


def upload(client):
    files = {
        ROOT / "app" / "server.py": f"{REMOTE}/app/server.py",
        ROOT / "app" / "schema.sql": f"{REMOTE}/app/schema.sql",
        ROOT / "app" / "db_backend.py": f"{REMOTE}/app/db_backend.py",
        ROOT / "app" / "postgres_compat.sql": f"{REMOTE}/app/postgres_compat.sql",
        ROOT / "app" / "migrate_sqlite_to_postgres.py": f"{REMOTE}/app/migrate_sqlite_to_postgres.py",
        ROOT / "requirements.txt": f"{REMOTE}/requirements.txt",
        ROOT / "compose.yaml": f"{REMOTE}/compose.postgres.yaml",
    }
    with client.open_sftp() as sftp:
        for local, remote in files.items():
            print(f"Enviando {local.name}...")
            sftp.put(str(local), remote)


def main():
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = f"{REMOTE}/backups/postgres-migration-{stamp}"
    report = f"{REMOTE}/migration-reports/sqlite-to-postgres-{stamp}.json"

    key = paramiko.Ed25519Key.from_private_key_file(str(KEY_PATH), password=PASSPHRASE)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", pkey=key, timeout=20, auth_timeout=20)
    try:
        _, existing_env, _ = run(
            client,
            f"grep '^POSTGRES_PASSWORD=' {REMOTE}/.env 2>/dev/null || true",
            check=False,
            quiet=True,
        )
        password = (
            existing_env.strip().split("=", 1)[1]
            if existing_env.strip().startswith("POSTGRES_PASSWORD=")
            else secrets.token_urlsafe(36)
        )
        database_url = f"postgresql://instituto_ayub:{password}@postgres:5432/instituto_ayub"
        print("1/8 Backup consistente do SQLite e dos arquivos atuais")
        run(
            client,
            f"mkdir -p {shlex.quote(backup)} {REMOTE}/migration-reports && "
            f"cp {REMOTE}/compose.yaml {shlex.quote(backup)}/compose.yaml && "
            f"cp {REMOTE}/requirements.txt {shlex.quote(backup)}/requirements.txt && "
            f"cp {REMOTE}/app/server.py {REMOTE}/app/schema.sql {shlex.quote(backup)}/ && "
            f"docker exec instituto-ayub python -c \"import sqlite3; "
            f"s=sqlite3.connect('/app/data/clinic.db'); d=sqlite3.connect('/app/data/clinic.snapshot.db'); "
            f"s.backup(d); d.close(); s.close()\" && "
            f"docker cp instituto-ayub:/app/data/clinic.snapshot.db {shlex.quote(backup)}/clinic.preflight.db && "
            f"docker exec instituto-ayub rm -f /app/data/clinic.snapshot.db && "
            f"chmod 600 {shlex.quote(backup)}/clinic.preflight.db",
        )

        print("2/8 Envio dos componentes PostgreSQL")
        upload(client)
        run(
            client,
            f"cd {REMOTE} && "
            f"(grep -v '^POSTGRES_PASSWORD=' .env 2>/dev/null || true) > .env.pg && "
            f"printf '%s\\n' 'POSTGRES_PASSWORD={password}' >> .env.pg && "
            f"mv .env.pg .env && chmod 600 .env",
        )

        print("3/8 Inicialização isolada do PostgreSQL")
        run(client, f"cd {REMOTE} && docker compose -f compose.postgres.yaml up -d postgres", timeout=300)
        run(
            client,
            "for i in $(seq 1 40); do docker exec instituto-ayub-postgres "
            "pg_isready -U instituto_ayub -d instituto_ayub >/dev/null && exit 0; sleep 2; done; exit 1",
            timeout=100,
        )

        print("4/8 Build da aplicação candidata")
        run(client, f"cd {REMOTE} && docker build -t instituto-ayub-postgres-candidate .", timeout=600)

        def migrate(sqlite_path: str):
            run(
                client,
                "docker run --rm --network instituto-ayub_default "
                f"-v {shlex.quote(sqlite_path)}:/migration/source.db:ro "
                f"-v {REMOTE}/migration-reports:/reports "
                "instituto-ayub-postgres-candidate "
                "python /app/migrate_sqlite_to_postgres.py "
                "--sqlite /migration/source.db "
                f"--database-url {shlex.quote(database_url)} "
                f"--report /reports/{Path(report).name} --replace-target",
                timeout=900,
            )

        print("5/8 Migração de ensaio e validação de todas as tabelas")
        migrate(f"{backup}/clinic.preflight.db")
        status, output, _ = run(client, f"cat {shlex.quote(report)}", timeout=60)
        parsed = json.loads(output)
        if not parsed.get("valid"):
            raise RuntimeError("Relatório de migração reprovado.")

        print("6/8 Smoke test do backend PostgreSQL")
        run(client, "docker rm -f instituto-ayub-pg-smoke >/dev/null 2>&1 || true", check=False)
        run(
            client,
            "docker run -d --name instituto-ayub-pg-smoke --network instituto-ayub_default "
            "-p 127.0.0.1:8001:8000 "
            f"-e DATABASE_URL={shlex.quote(database_url)} "
            "-e HOST=0.0.0.0 -e PORT=8000 "
            "instituto-ayub-postgres-candidate",
        )
        run(
            client,
            "for i in $(seq 1 45); do curl -fsS http://127.0.0.1:8001/login >/dev/null && exit 0; "
            "docker inspect -f '{{.State.Status}}' instituto-ayub-pg-smoke | grep -q running || exit 1; "
            "sleep 2; done; docker logs instituto-ayub-pg-smoke; exit 1",
            timeout=120,
        )
        run(client, "docker rm -f instituto-ayub-pg-smoke")

        print("7/8 Janela de corte: congelando SQLite e repetindo cópia final")
        run(client, "docker stop instituto-ayub", timeout=90)
        frozen = f"{backup}/clinic.final.db"
        run(client, f"cp {REMOTE}/data/clinic.db {shlex.quote(frozen)} && chmod 600 {shlex.quote(frozen)}")
        migrate(frozen)

        print("8/8 Ativação exclusiva do PostgreSQL")
        run(
            client,
            f"cd {REMOTE} && cp compose.postgres.yaml compose.yaml && "
            "docker rm instituto-ayub >/dev/null 2>&1 || true; "
            f"cd {REMOTE} && docker compose up -d --build",
            timeout=600,
        )
        run(
            client,
            "for i in $(seq 1 60); do curl -fsS http://127.0.0.1:8000/login >/dev/null && exit 0; "
            "sleep 2; done; docker compose -f /opt/instituto-ayub/compose.yaml logs --tail=150 instituto-ayub; exit 1",
            timeout=150,
        )
        run(
            client,
            f"mv {REMOTE}/data/clinic.db {shlex.quote(backup)}/clinic.sqlite.retired && "
            f"chmod 600 {shlex.quote(backup)}/clinic.sqlite.retired && "
            "docker exec instituto-ayub python -c \"from db_backend import using_postgres; "
            "assert using_postgres(); from server import connect; "
            "d=connect(); print('POSTGRES_PATIENTS',d.execute('SELECT COUNT(*) FROM patients').fetchone()[0]); "
            "print('POSTGRES_MESSAGES',d.execute('SELECT COUNT(*) FROM crm_messages').fetchone()[0]); d.close()\"",
            timeout=90,
        )
        print(f"MIGRAÇÃO 100% CONCLUÍDA. Relatório: {report}. Backup congelado: {backup}")
    except Exception:
        print("FALHA: preservando o SQLite e os backups; o corte só ocorre após validação.")
        raise
    finally:
        client.close()


if __name__ == "__main__":
    main()
