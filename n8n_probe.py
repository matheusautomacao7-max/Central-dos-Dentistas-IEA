import sys

sys.path.insert(0, "/app")
import server

handler_class = next(
    value for value in vars(server).values()
    if isinstance(value, type) and hasattr(value, "crm_n8n_request")
)
handler = object.__new__(handler_class)
config = handler.crm_n8n_config()
print("configured=", bool(config))
print("base_url=", (config or {}).get("api_base_url"))
print("active=", bool((config or {}).get("active")))
payload = handler.crm_n8n_request("/api/v1/workflows?limit=50", timeout=8)
print("workflows=", len(payload.get("data") or []))
