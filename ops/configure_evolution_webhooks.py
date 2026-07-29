import json
import os
import sqlite3
from urllib.request import Request, urlopen

base_url = os.environ["EVOLUTION_API_URL"].rstrip("/")
api_key = os.environ["EVOLUTION_API_KEY"]
webhook_token = os.environ["INTEGRATION_TOKEN"]
public_url = os.environ.get("PUBLIC_APP_URL", "https://dentistas.automacaocentraliea.me").rstrip("/")
webhook_url = f"{public_url}/api/integrations/evolution/webhook?token={webhook_token}"


def request(path, *, method="GET", payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(f"{base_url}{path}", data=body, method=method,
                  headers={"apikey": api_key, "Content-Type": "application/json"})
    with urlopen(req, timeout=30) as response:
        raw = response.read().decode()
        return json.loads(raw) if raw else {}


instances = request("/instance/fetchInstances")
response_shape = {"type": type(instances).__name__, "keys": list(instances.keys()) if isinstance(instances, dict) else [], "length": len(instances) if hasattr(instances, "__len__") else None}
if isinstance(instances, dict):
    nested = instances.get("instances") or instances.get("data") or instances.get("response") or []
    if isinstance(nested, dict):
        nested = nested.get("instances") or nested.get("records") or list(nested.values())
    instances = nested

configured = []
for item in instances:
    if not isinstance(item, dict):
        continue
    instance = item.get("name") or item.get("instance", {}).get("instanceName") or item.get("instanceName")
    if not instance:
        continue
    payload = {"webhook": {"enabled": True, "url": webhook_url, "webhookByEvents": False,
                            "webhookBase64": False,
                            "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]}}
    request(f"/webhook/set/{instance}", method="POST", payload=payload)
    configured.append(instance)

print(json.dumps({"configured": configured, "count": len(configured), "response_shape": response_shape}, ensure_ascii=False))
