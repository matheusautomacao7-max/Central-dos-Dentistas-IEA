"""Publish the n8n flow stability fix through the dedicated SSH key."""
from pathlib import Path
import os
import paramiko

ROOT = Path(__file__).resolve().parent
KEY_PATH = Path(os.environ["IEA_DEPLOY_KEY_PATH"])
PASSPHRASE = os.environ["IEA_DEPLOY_KEY_PASSWORD"]

key = paramiko.Ed25519Key.from_private_key_file(str(KEY_PATH), password=PASSPHRASE)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("179.197.74.18", username="root", pkey=key, timeout=20, auth_timeout=20)

try:
    _, stdout, stderr = client.exec_command(
        "cd /opt/instituto-ayub && stamp=$(date +%Y%m%d-%H%M%S) && "
        "mkdir -p backups/$stamp && "
        "cp app/server.py app/schema.sql app/public/crm-whatsapp.html backups/$stamp/ && "
        "cp app/public/crm-evolution-bridge.js backups/$stamp/ && "
        "test ! -f app/public/crm-resolution-flow.js || cp app/public/crm-resolution-flow.js backups/$stamp/",
        timeout=30,
    )
    backup_output = stdout.read().decode("utf-8", errors="replace")
    backup_errors = stderr.read().decode("utf-8", errors="replace")
    if stdout.channel.recv_exit_status():
        raise RuntimeError(backup_errors or backup_output or "Falha ao criar backup remoto.")
    sftp = client.open_sftp()
    try:
        sftp.put(str(ROOT / "app" / "server.py"), "/opt/instituto-ayub/app/server.py")
        sftp.put(str(ROOT / "app" / "schema.sql"), "/opt/instituto-ayub/app/schema.sql")
        sftp.put(str(ROOT / "app" / "public" / "crm-whatsapp.html"), "/opt/instituto-ayub/app/public/crm-whatsapp.html")
        sftp.put(str(ROOT / "app" / "public" / "crm-evolution-bridge.js"), "/opt/instituto-ayub/app/public/crm-evolution-bridge.js")
        sftp.put(str(ROOT / "app" / "public" / "crm-resolution-flow.js"), "/opt/instituto-ayub/app/public/crm-resolution-flow.js")
    finally:
        sftp.close()
    _, stdout, stderr = client.exec_command(
        "cd /opt/instituto-ayub && docker compose up -d --build instituto-ayub",
        timeout=180,
    )
    output = stdout.read().decode("utf-8", errors="replace")
    errors = stderr.read().decode("utf-8", errors="replace")
    status = stdout.channel.recv_exit_status()
    if status:
        raise RuntimeError(errors or output or f"Deploy terminou com código {status}")
    _, stdout, stderr = client.exec_command(
        "docker ps --filter name=instituto-ayub --format '{{.Status}}'",
        timeout=20,
    )
    status = stdout.read().decode("utf-8", errors="replace").strip()
    if not status:
        raise RuntimeError(stderr.read().decode("utf-8", errors="replace") or "Container não foi localizado.")
    print(status)
finally:
    client.close()
