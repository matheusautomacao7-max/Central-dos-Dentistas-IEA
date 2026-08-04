from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / "app" / "public" / "crm-accessibility-bridge.js").read_text(encoding="utf-8")
html = (ROOT / "app" / "public" / "crm-whatsapp.html").read_text(encoding="utf-8")

assert "prefers-reduced-motion: reduce" in source
assert ":focus-visible" in source
assert 'setAttribute("role", "dialog")' in source
assert 'setAttribute("aria-modal", "true")' in source
assert 'event.key === "Escape"' in source
assert 'event.key !== "Tab"' in source
assert "restoreFocus" in source
assert "crm-accessibility-bridge.js?v=20260804-a11y-relevant-dom-v1" in html

print("crm-accessibility-tests-ok")
