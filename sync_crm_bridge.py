"""Prepare a safe, delayed loader for the CRM Evolution/n8n bridge.

The CRM UI is a self-replacing offline bundle.  Loading the bridge before the
bundle finishes swaps the document can leave the application with only the
sidebar.  This helper preserves the original CRM bundle untouched and starts
the bridge only after the final interface is mounted.
"""
import json
import re
from pathlib import Path


HTML = Path("app/public/crm-whatsapp.html")
MANIFEST_OPEN = '<script type="__bundler/manifest">'
TEMPLATE_OPEN = '<script type="__bundler/template">'
LOADER_START = "<!-- __iea_delayed_bridge_loader -->"
LOADER_END = "<!-- /__iea_delayed_bridge_loader -->"


def script_bounds(source: str, opening: str) -> tuple[int, int]:
    start = source.find(opening)
    if start < 0:
        raise SystemExit(f"Bloco {opening!r} nao localizado.")
    start += len(opening)
    end = source.find("</script>", start)
    if end < 0:
        raise SystemExit(f"Fim do bloco {opening!r} nao localizado.")
    return start, end


raw = HTML.read_text(encoding="utf-8")

# Validate the application bundle before changing the outer shell.  The
# business UI and its Component logic must remain intact.
manifest_start, manifest_end = script_bounds(raw, MANIFEST_OPEN)
json.loads(raw[manifest_start:manifest_end])
template_start, template_end = script_bounds(raw, TEMPLATE_OPEN)
template = json.loads(raw[template_start:template_end])
if "data-dc-script" not in template or "class Component" not in template:
    raise SystemExit("Bundle principal do CRM esta incompleto; a ponte nao sera instalada.")

# Remove previous bridge script tags and a prior delayed loader.  A single
# bridge must be appended after the final CRM document has been mounted.
raw = re.sub(
    r"\s*<script\s+src=\"/crm-evolution-bridge\.js(?:\?[^\"]*)?\"></script>\s*",
    "\n",
    raw,
    flags=re.IGNORECASE,
)
raw = re.sub(
    re.escape(LOADER_START) + r".*?" + re.escape(LOADER_END),
    "",
    raw,
    flags=re.DOTALL,
)

loader = f'''\n{LOADER_START}
<script>
(function () {{
  var attempts = 0;
  function attachBridge() {{
    if (window.__ieaCrmEvolutionBridgeInstalled) return;
    // O CRM pode abrir diretamente em Inbox, Integrações, Campanhas ou outra
    // aba. A versão anterior aguardava apenas o título de Campanhas; quando
    // a pessoa iniciava em outra tela, o bridge nunca era carregado.
    var knownTitles = [
      'Conversas', 'Fila de atendimento', 'Funil', 'Visão do gestor',
      'Contatos', 'Campanhas &', 'Integrações & Canais', 'Configurações'
    ];
    var appReady = Array.from(document.querySelectorAll('h1')).some(function (item) {{
      var title = (item.textContent || '').trim();
      return knownTitles.some(function (known) {{ return title.indexOf(known) === 0; }});
    }});
    if (!appReady) {{
      if (++attempts < 1200) window.setTimeout(attachBridge, 50);
      return;
    }}
    var bridge = document.createElement('script');
    bridge.src = '/crm-evolution-bridge.js?v=20260728-bridge-any-screen';
    bridge.async = false;
    bridge.onerror = function () {{ console.warn('CRM bridge nao carregou'); }};
    document.head.appendChild(bridge);
  }}
  window.setTimeout(attachBridge, 0);
}})();
</script>
{LOADER_END}\n'''

outer_body = raw.rfind("</body>")
if outer_body < 0:
    raise SystemExit("Fechamento do documento CRM nao localizado.")
raw = raw[:outer_body] + loader + raw[outer_body:]
HTML.write_text(raw, encoding="utf-8")
print("Bridge preparado para carregar apos a interface principal do CRM.")
