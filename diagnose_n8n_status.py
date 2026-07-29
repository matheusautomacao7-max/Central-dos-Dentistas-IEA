"""Diagnóstico seguro do vínculo CRM -> n8n (não imprime tokens)."""
from pathlib import Path
import os
import paramiko


ROOT = Path(__file__).resolve().parent
KEY_PATH = Path(os.environ["IEA_DEPLOY_KEY_PATH"])
key = paramiko.Ed25519Key.from_private_key_file(str(KEY_PATH), password=os.environ["IEA_DEPLOY_KEY_PASSWORD"])
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("179.197.74.18", username="root", pkey=key, timeout=20, auth_timeout=20)

command = r'''docker exec instituto-ayub python -c "
import sqlite3, urllib.request, json
db=sqlite3.connect('/app/data/clinic.db'); db.row_factory=sqlite3.Row
row=db.execute('SELECT api_base_url, api_token, active, updated_at FROM crm_n8n_config WHERE id=1').fetchone()
print('config_row=', bool(row))
if not row:
 print('result=no persistent n8n config')
 raise SystemExit(0)
base=(row['api_base_url'] or '').rstrip('/')
token=row['api_token'] or ''
print('base=', base)
print('active=', bool(row['active']), 'token_present=', bool(token), 'updated_at=', row['updated_at'])
req=urllib.request.Request(base + '/api/v1/workflows?limit=50', headers={'Accept':'application/json','X-N8N-API-KEY':token})
try:
 with urllib.request.urlopen(req, timeout=15) as res:
  payload=json.loads(res.read().decode())
  print('n8n_http=', res.status, 'workflows=', len(payload.get('data') or []))
except Exception as exc:
 print('n8n_error=', type(exc).__name__, str(exc)[:300])
"'''

try:
    _, stdout, stderr = client.exec_command(command, timeout=40)
    output = stdout.read().decode("utf-8", errors="replace")
    error = stderr.read().decode("utf-8", errors="replace")
    print(output.strip())
    if error.strip():
        print("stderr:", error.strip())
finally:
    client.close()
