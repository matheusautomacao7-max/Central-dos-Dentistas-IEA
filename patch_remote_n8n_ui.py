import json
import re
from pathlib import Path

html_path = Path('/opt/instituto-ayub/app/public/crm-whatsapp.html')
raw = html_path.read_text(encoding='utf-8')
match = re.search(r'(<script type="__bundler/template">)(.*?)(</script>)', raw, re.S)
if not match:
    raise SystemExit('Template não encontrado')
template = json.loads(match.group(2))
anchor = '''    return data;
  }

  function setStatus'''
helper = '''    return data;
  }

  async function n8nApi(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {headers: {"Content-Type": "application/json"}, ...options, signal: controller.signal});
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
      if (!response.ok || data.error) throw new Error(data.error || `Não foi possível consultar o n8n (${response.status}).`);
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("O n8n demorou mais de 12 segundos para responder. Tente atualizar novamente.");
      throw error;
    } finally { clearTimeout(timer); }
  }

  function setStatus'''
if 'async function n8nApi(' not in template:
    if anchor not in template:
        raise SystemExit('Âncora da API não encontrada')
    template = template.replace(anchor, helper, 1)
template = template.replace('const config = await api("/api/crm/n8n/config");', 'const config = await n8nApi("/api/crm/n8n/config");')
template = template.replace('const data = await api("/api/crm/n8n/overview?limit=50");', 'const data = await n8nApi("/api/crm/n8n/overview?limit=50");')
html_path.write_text(raw[:match.start(2)] + json.dumps(template, ensure_ascii=False) + raw[match.end(2):], encoding='utf-8')
print('Interface n8n atualizada.')
