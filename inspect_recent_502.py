"""Read-only inspection of recent CRM container errors."""
from pathlib import Path
import os
import paramiko


def main():
    key_path = Path(os.environ["IEA_DEPLOY_KEY_PATH"])
    key = paramiko.Ed25519Key.from_private_key_file(
        str(key_path), password=os.environ["IEA_DEPLOY_KEY_PASSWORD"]
    )
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("179.197.74.18", username="root", pkey=key, timeout=20)
    try:
        command = (
            "docker logs --tail 1000 instituto-ayub 2>&1 "
            "| grep -E ' 502 |Traceback|ERROR|Exception|n8n|campaigns' "
            "| tail -120"
        )
        _, stdout, stderr = client.exec_command(command, timeout=30)
        output = stdout.read().decode("utf-8", errors="replace")
        error = stderr.read().decode("utf-8", errors="replace")
        print(output or error or "Nenhuma linha relevante encontrada.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
