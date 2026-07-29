import os
from pathlib import Path
import paramiko

key_path = Path(os.environ["IEA_DEPLOY_KEY_PATH"])
key = paramiko.Ed25519Key.from_private_key_file(str(key_path), password=os.environ["IEA_DEPLOY_KEY_PASSWORD"])
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("179.197.74.18", username="root", pkey=key, timeout=20)
for command in [
    "sha256sum /opt/instituto-ayub/app/public/crm-whatsapp.html",
    "docker exec instituto-ayub sha256sum /app/public/crm-whatsapp.html",
    "docker inspect -f '{{.State.Status}} {{.State.Health.Status}}' instituto-ayub",
]:
    _, stdout, stderr = client.exec_command(command)
    print(command)
    print(stdout.read().decode().strip())
    print(stderr.read().decode().strip())
client.close()
