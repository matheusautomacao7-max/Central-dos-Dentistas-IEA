"""Static checks for the isolated Meta laboratory user interface."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BRIDGE = (ROOT / "app" / "public" / "crm-meta-test.js").read_text(encoding="utf-8")
LOADER = (ROOT / "app" / "public" / "crm-whatsapp.html").read_text(encoding="utf-8")

assert "/api/crm/meta/test/status" in BRIDGE
assert "/api/crm/meta/test/config" in BRIDGE
assert "Tokens não são salvos nesta tela" in BRIDGE
assert "crm-meta-test.js" in LOADER
assert "production" not in BRIDGE.lower()

print("meta-test-ui-ok")
