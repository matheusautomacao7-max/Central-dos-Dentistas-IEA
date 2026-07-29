"""Small idempotent hotfix for the n8n workflow screen on the VPS."""
from pathlib import Path

path = Path("/opt/instituto-ayub/app/server.py")
source = path.read_text(encoding="utf-8")

anchor = "\n\ndef convert_crm_audio_to_ogg"
globals_block = '''\n\n# Keep the last successful n8n audit available while the user changes CRM tabs.\nN8N_OVERVIEW_CACHE_LOCK = threading.Lock()\nN8N_OVERVIEW_CACHE: dict[str, object] = {"payload": None, "updated_at": 0.0}\n'''
if "N8N_OVERVIEW_CACHE_LOCK" not in source:
    source = source.replace(anchor, globals_block + anchor, 1)

needle = '''        except (TypeError, ValueError):
            limit = 50
        try:
            # A listagem de execu'''
replacement = '''        except (TypeError, ValueError):
            limit = 50
        force_refresh = str(query.get("refresh", [""])[0]).strip().lower() in {"1", "true", "yes"}
        with N8N_OVERVIEW_CACHE_LOCK:
            cached_payload = N8N_OVERVIEW_CACHE.get("payload")
            cached_at = float(N8N_OVERVIEW_CACHE.get("updated_at") or 0)
        if not force_refresh and isinstance(cached_payload, dict) and time.monotonic() - cached_at < 120:
            response_payload = dict(cached_payload)
            response_payload["cached"] = True
            return self.send_json(response_payload)
        try:
            # A listagem de execu'''
if needle in source and "force_refresh = str(query.get" not in source:
    source = source.replace(needle, replacement, 1)

old_end = '''        self.send_json({
            "configured": True,
            "workflows": workflows,'''
new_end = '''        response_payload = {
            "configured": True,
            "workflows": workflows,'''
if old_end in source and "N8N_OVERVIEW_CACHE[\"payload\"] = response_payload" not in source:
    source = source.replace(old_end, new_end, 1)
    closing = '''            "next_executions_cursor": executions_payload.get("nextCursor"),
        })

    @staticmethod
    def classify_crm_n8n_workflow'''
    closed = '''            "next_executions_cursor": executions_payload.get("nextCursor"),
        }
        with N8N_OVERVIEW_CACHE_LOCK:
            N8N_OVERVIEW_CACHE["payload"] = response_payload
            N8N_OVERVIEW_CACHE["updated_at"] = time.monotonic()
        self.send_json(response_payload)

    @staticmethod
    def classify_crm_n8n_workflow'''
    source = source.replace(closing, closed, 1)

path.write_text(source, encoding="utf-8")
print("Correção n8n aplicada.")
