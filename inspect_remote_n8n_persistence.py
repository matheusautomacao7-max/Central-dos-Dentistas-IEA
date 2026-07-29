import os
from pathlib import Path
import paramiko

key = paramiko.Ed25519Key.from_private_key_file(
    str(Path(os.environ["IEA_DEPLOY_KEY_PATH"])), password=os.environ["IEA_DEPLOY_KEY_PASSWORD"]
)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("179.197.74.18", username="root", pkey=key, timeout=20)
commands = [
    "docker inspect instituto-ayub --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'",
    "docker exec instituto-ayub python -c \"import sqlite3; db=sqlite3.connect('/app/data/clinic.db'); print(db.execute(\\\"select api_base_url, active, updated_at, length(api_token) from crm_n8n_config where id=1\\\").fetchall())\"",
    "docker exec instituto-ayub sh -lc 'test -f /app/data/n8n-crm-config.json && echo N8N_FILE_PRESENT || echo N8N_FILE_MISSING'",
]
for command in commands:
    _, stdout, stderr = client.exec_command(command)
    print("--", command)
    print(stdout.read().decode().strip())
    print(stderr.read().decode().strip())
client.close()
