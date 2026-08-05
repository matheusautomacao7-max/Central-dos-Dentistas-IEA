"""Static guardrails for the read-only Meta laboratory inbox."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER = (ROOT / "app" / "server.py").read_text(encoding="utf-8")
SCHEMA = (ROOT / "app" / "schema.sql").read_text(encoding="utf-8")
BRIDGE = (ROOT / "app" / "public" / "crm-meta-test.js").read_text(encoding="utf-8")

assert "CREATE TABLE IF NOT EXISTS crm_meta_test_messages" in SCHEMA
assert "authorized_test_phone" in SCHEMA
assert '"/api/crm/meta/test/inbox"' in SERVER
assert "def get_crm_meta_test_inbox" in SERVER
assert "def record_meta_test_messages" in SERVER
assert "Persist only inbound messages from the administrator-approved test number" in SERVER
assert "INSERT INTO crm_conversations" not in SERVER[SERVER.index("def record_meta_test_messages"):SERVER.index("def verify_meta_test_webhook")]
assert "Caixa de entrada do laboratório" in BRIDGE
assert "data-meta-inbox-refresh" in BRIDGE
assert "Somente leitura" in BRIDGE

print("meta-test-inbox-ok")
