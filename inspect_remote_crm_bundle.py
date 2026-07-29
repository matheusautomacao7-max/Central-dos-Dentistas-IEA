import hashlib
import os
from pathlib import Path

import paramiko

key = paramiko.Ed25519Key.from_private_key_file(
    str(Path(os.environ["IEA_DEPLOY_KEY_PATH"])), password=os.environ["IEA_DEPLOY_KEY_PASSWORD"]
)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("179.197.74.18", username="root", pkey=key, timeout=20)
try:
    command = """docker exec instituto-ayub sh -lc '\
      sha256sum /app/public/crm-whatsapp.html /app/public/crm-evolution-bridge.js; \
      grep -c 'data-dc-script' /app/public/crm-whatsapp.html; \
      grep -c 'class Component' /app/public/crm-whatsapp.html; \
      grep -c '__iea_delayed_bridge_loader' /app/public/crm-whatsapp.html; \
      grep -c e6ea0f92-ffb5-4a5b-9fcc-3b88337c7268 /app/public/crm-whatsapp.html; \
      grep -c 'crm-evolution-bridge.js?v=' /app/public/crm-whatsapp.html || true; \
      grep -c XMLHttpRequest /app/public/crm-evolution-bridge.js; \
      grep -c unsafe-eval /app/server.py; \
      grep -c allow_bundled_ui=relative /app/server.py'"""
    _, stdout, stderr = client.exec_command(command, timeout=30)
    print(stdout.read().decode("utf-8", errors="replace").strip())
    print(stderr.read().decode("utf-8", errors="replace").strip())
finally:
    client.close()
