from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "app" / "public" / "crm-whatsapp.html").read_text(encoding="utf-8")
match = re.search(r'<script type="__bundler/template">\s*("[\s\S]*?")\s*</script>', html)
assert match, "template embarcado não encontrado"
template = json.loads(match.group(1))

# Lista pesada/métricas são adaptativas; mensagens continuam próximas do
# tempo real. A aba oculta não deve manter trabalho de rede/DOM em background.
assert "CRM_ADAPTIVE_REFRESH_V1" in template
assert "setInterval(this._refreshCrm,10000)" in template
assert "if(document.hidden||this._crmRefreshActive)return" in template
assert "if(document.hidden||this._messagePollActive)return" in template
assert "&compact=workspace" in template
assert "view=operational&compact=pipeline" in template
assert "requestToken!==this._conversationRequestToken" in template
assert "signature===this._pipelineSignature" in template
assert "CRM_MESSAGE_SELECTION_GUARD_V1" in template
assert "if(this.state.activeConvId!==id)this.setState({activeConvId:id})" not in template

# Bridges devem nascer depois do unpack; o abortador global antigo causava
# starvation entre Inbox, Funil e etiquetas de campanha.
assert "iea:crm-unpacked" in html and "iea:crm-ready" in html
assert "crm-state-stability-bridge.js" not in html
assert "media_refresh=" not in (ROOT / "app" / "public" / "crm-media-bridge.js").read_text(encoding="utf-8")
assert "location.reload()" not in (ROOT / "app" / "public" / "crm-operations-bridge.js").read_text(encoding="utf-8")

evolution = (ROOT / "app" / "public" / "crm-evolution-bridge.js").read_text(encoding="utf-8")
assert "compact=campaign" in evolution
assert "!conversationOriginLoadedAt || now - conversationOriginLoadedAt > 60000" in evolution
assert "conversationOriginRequest" in evolution

accessibility = (ROOT / "app" / "public" / "crm-accessibility-bridge.js").read_text(encoding="utf-8")
observer = accessibility.split("new MutationObserver(scheduleEnhance).observe", 1)[1]
assert "attributes: true" not in observer

print("crm-runtime-fluency-ok")
