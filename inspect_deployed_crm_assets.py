"""Read-only confirmation of the assets served inside the CRM container."""
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
    command = "docker exec instituto-ayub sh -lc \"grep -o 'crm-evolution-bridge.js?v=[^\\\" ]*' /app/public/crm-whatsapp.html | tail -1; grep -o 'crm-resolution-flow.js?v=[^\\\" ]*' /app/public/crm-whatsapp.html | tail -1; test -f /app/public/crm-resolution-flow.js && echo RESOLUTION_ASSET_OK; grep -q 'window.IEA_CRM_RESOLUTION.open()' /app/public/crm-whatsapp.html && echo DIRECT_MODAL_OK; grep -q 'window.IEA_CRM_RESOLUTION' /app/public/crm-resolution-flow.js && echo BRIDGE_OK; grep -n 'Uma única consulta ao overview' /app/public/crm-evolution-bridge.js | head -1; python -m py_compile /app/server.py && python -c \\\"import sqlite3; d=sqlite3.connect('/app/data/clinic.db'); print('RESOLUTION_TABLE_OK',bool(d.execute('select name from sqlite_master where type=\\\\'table\\\\' and name=\\\\'crm_service_resolutions\\\\'').fetchone()))\\\" && echo SERVER_OK\""
    _, stdout, stderr = client.exec_command(command, timeout=30)
    print(stdout.read().decode('utf-8', errors='replace').strip())
    error = stderr.read().decode('utf-8', errors='replace').strip()
    if error:
        print('stderr:', error)
finally:
    client.close()
