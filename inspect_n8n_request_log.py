"""Read-only log inspection for the n8n overview API."""
from pathlib import Path
import os
import paramiko

key = paramiko.Ed25519Key.from_private_key_file(
    str(Path(os.environ["IEA_DEPLOY_KEY_PATH"])), password=os.environ["IEA_DEPLOY_KEY_PASSWORD"]
)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("179.197.74.18", username="root", pkey=key, timeout=20, auth_timeout=20)
try:
    command = "docker logs --tail 350 instituto-ayub 2>&1 | grep -E 'n8n/overview|n8n/config|GET /api/crm/campaigns|Traceback|ERROR' | tail -80"
    _, stdout, stderr = client.exec_command(command, timeout=30)
    print(stdout.read().decode("utf-8", errors="replace").strip())
    error = stderr.read().decode("utf-8", errors="replace").strip()
    if error:
        print("stderr:", error)
finally:
    client.close()
