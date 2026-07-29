from pathlib import Path
import json

source = Path("app/public/crm-whatsapp.html").read_text(encoding="utf-8")
marker = '<script type="__bundler/template">'
start = source.index(marker) + len(marker)
end = source.index('</script>\n  <script src="/crm-evolution-bridge.js', start)
bundle = source[start:end]
print("bundle_chars", len(bundle))
template = json.loads(bundle)
print("template_chars", len(template))
print("inline_bridge_markers", template.count("(() => {"))
print("script_closings", template.count("</script>"))
