import os
import base64
from pathlib import Path
import paramiko

key = paramiko.Ed25519Key.from_private_key_file(
    str(Path(os.environ["IEA_DEPLOY_KEY_PATH"])), password=os.environ["IEA_DEPLOY_KEY_PASSWORD"]
)
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("179.197.74.18", username="root", pkey=key, timeout=20)
code = """import sqlite3,json,time,urllib.request
db=sqlite3.connect('/app/data/clinic.db')
u,k=db.execute('select api_base_url,api_token from crm_n8n_config where id=1').fetchone()
t=time.monotonic()
r=urllib.request.urlopen(urllib.request.Request(u+'/api/v1/workflows?limit=50',headers={'X-N8N-API-KEY':k,'Accept':'application/json'}),timeout=20)
body=r.read()
d=json.loads(body)
print('status',r.status,'seconds',round(time.monotonic()-t,3),'workflows',len(d.get('data',[])))
"""
encoded = base64.b64encode(code.encode("utf-8")).decode("ascii")
command = "docker exec instituto-ayub python -c \"import base64;exec(base64.b64decode('" + encoded + "'))\""
_, stdout, stderr = client.exec_command(command, timeout=40)
print(stdout.read().decode().strip())
print(stderr.read().decode().strip())
client.close()
