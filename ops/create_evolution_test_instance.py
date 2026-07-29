import base64
import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

base_url = os.environ["EVOLUTION_API_URL"].rstrip("/")
api_key = os.environ["EVOLUTION_API_KEY"]
instance = os.environ.get("EVOLUTION_TEST_INSTANCE", "Teste-CRM-IEA")


def request(path, *, method="GET", payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(f"{base_url}{path}", data=body, method=method,
                  headers={"apikey": api_key, "Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=30) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else {}
    except HTTPError as error:
        detail = error.read().decode(errors="replace")
        if error.code == 403 and "already" in detail.lower():
            return {}
        raise RuntimeError(f"Evolution respondeu {error.code}: {detail[:500]}") from error


created = request("/instance/create", method="POST", payload={
    "instanceName": instance,
    "qrcode": True,
    "integration": "WHATSAPP-BAILEYS",
})
connected = request(f"/instance/connect/{instance}")

qr = (connected.get("base64") or (connected.get("qrcode") or {}).get("base64") or
      created.get("base64") or (created.get("qrcode") or {}).get("base64"))
if not qr:
    raise RuntimeError("A Evolution não retornou o QR Code da instância de teste.")
if "," in qr:
    qr = qr.split(",", 1)[1]
Path("/tmp/evolution-test-qr.png").write_bytes(base64.b64decode(qr))
print(json.dumps({"instance": instance, "qr_created": True}, ensure_ascii=False))
