"""Static safety checks for the signed, test-only Meta webhook."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER = (ROOT / "app" / "server.py").read_text(encoding="utf-8")
BRIDGE = (ROOT / "app" / "public" / "crm-meta-test.js").read_text(encoding="utf-8")

assert 'META_TEST_MODE = os.environ.get("META_TEST_MODE") == "1"' in SERVER
assert 'META_TEST_WEBHOOK_VERIFY_TOKEN' in SERVER
assert 'META_TEST_APP_SECRET' in SERVER
assert '"/api/integrations/meta/test/webhook"' in SERVER
assert "def verify_meta_test_webhook" in SERVER
assert "def receive_meta_test_webhook" in SERVER
assert "X-Hub-Signature-256" in SERVER
assert "hmac.compare_digest" in SERVER
assert '"webhook.received"' in SERVER
assert '"Recebido somente em teste"' in SERVER
assert "INSERT INTO crm_conversations" not in SERVER[SERVER.index("def receive_meta_test_webhook"):SERVER.index("def get_crm_meta_test_status")]
assert "WEBHOOK DE TESTE" in BRIDGE
assert "data-meta-copy-webhook" in BRIDGE

print("meta-test-webhook-ok")
