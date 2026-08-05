"""Static safety checks for the isolated Meta integration laboratory."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER = (ROOT / "app" / "server.py").read_text(encoding="utf-8")
SCHEMA = (ROOT / "app" / "schema.sql").read_text(encoding="utf-8")

assert "CREATE TABLE IF NOT EXISTS crm_meta_test_settings" in SCHEMA
assert "CREATE TABLE IF NOT EXISTS crm_meta_test_events" in SCHEMA
assert "test_mode INTEGER NOT NULL DEFAULT 1 CHECK (test_mode = 1)" in SCHEMA
assert "/api/crm/meta/test/status" in SERVER
assert "/api/crm/meta/test/config" in SERVER
assert "def get_crm_meta_test_status" in SERVER
assert "def save_crm_meta_test_config" in SERVER
assert '"production_writes": False' in SERVER
assert '"patient_messages": False' in SERVER
assert '"webhook_enabled": bool(META_TEST_MODE and META_TEST_WEBHOOK_VERIFY_TOKEN and META_TEST_APP_SECRET)' in SERVER
assert "can_manage_crm(self.authenticated_user)" in SERVER

print("meta-test-foundation-ok")
