(() => {
  if (window.__ieaCrmMetaTestBridgeInstalled) return;
  window.__ieaCrmMetaTestBridgeInstalled = true;

  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha ao consultar Meta (${response.status}).`);
    return payload;
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const label = element => (element?.textContent || "").trim().toLowerCase();
  let refreshPromise = null;
  let loadedPanel = null;

  function integrationHeader() {
    return [...document.querySelectorAll("h1")].find(item => label(item).includes("integra"));
  }

  function panelMarkup(status) {
    const settings = status.settings || {};
    const enabled = Number(settings.enabled) === 1;
    const badge = enabled
      ? '<span style="background:#dcfce7;color:#15803d;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800">Laboratório ativo</span>'
      : '<span style="background:#eff6ff;color:#2563eb;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800">Preparação</span>';
    return `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap">
      <div style="max-width:670px"><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><span style="color:#0866ff;font-size:12px;font-weight:900;letter-spacing:.08em">META · AMBIENTE DE TESTE</span>${badge}</div><strong style="display:block;margin-top:6px;font-size:19px;color:var(--text)">WhatsApp Cloud API e Instagram</strong><p style="margin:6px 0 0;color:var(--text2);font-size:13px;line-height:1.5">Esta configuração é exclusiva da homologação. Nenhuma conversa, canal ou token da operação oficial é usado aqui.</p></div>
      <button type="button" data-meta-refresh style="border:1px solid #bcd1ff;background:#f8fbff;color:#175cd3;border-radius:9px;padding:9px 13px;font:800 13px inherit;cursor:pointer">Atualizar status</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:17px 0">
      ${[["WhatsApp de teste",settings.whatsapp_test_phone_number_id ? "ID salvo" : "Aguardando ID"],["Instagram de teste",settings.instagram_test_account_id ? "ID salvo" : "Aguardando ID"],["Eventos recebidos",String(status.event_count || 0)]].map(([title,value]) => `<div style="border:1px solid var(--line);background:var(--panel2);border-radius:11px;padding:12px"><small style="display:block;color:var(--text3);font-weight:700">${title}</small><strong style="display:block;margin-top:5px;font-size:14px">${escapeHtml(value)}</strong></div>`).join("")}
    </div>
    <form data-meta-config style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;border-top:1px solid var(--line);padding-top:16px">
      <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:var(--text2)">ID do App Meta<input name="app_id" value="${escapeHtml(settings.app_id)}" placeholder="Ex.: 123456789" style="padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit"></label>
      <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:var(--text2)">ID do número WhatsApp de teste<input name="whatsapp_test_phone_number_id" value="${escapeHtml(settings.whatsapp_test_phone_number_id)}" placeholder="Somente ambiente de teste" style="padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit"></label>
      <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:var(--text2)">ID da conta Instagram de teste<input name="instagram_test_account_id" value="${escapeHtml(settings.instagram_test_account_id)}" placeholder="Opcional nesta etapa" style="padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit"></label>
      <label style="display:flex;align-items:center;gap:9px;padding-top:22px;font-size:13px;font-weight:800;color:var(--text)"><input name="enabled" type="checkbox" ${enabled ? "checked" : ""}> Ativar apenas o laboratório de testes</label>
      <div style="grid-column:1 / -1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><small style="color:var(--text3);line-height:1.45">Tokens não são salvos nesta tela. A etapa seguinte adicionará o cofre de credenciais e o webhook de teste.</small><button type="submit" style="border:0;border-radius:9px;background:#0866ff;color:#fff;padding:10px 15px;font:800 13px inherit;cursor:pointer">Salvar laboratório</button></div>
    </form>`;
  }

  function forbiddenMarkup(error) {
    return `<div><span style="color:#0866ff;font-size:12px;font-weight:900;letter-spacing:.08em">META · AMBIENTE DE TESTE</span><strong style="display:block;margin-top:7px;font-size:17px">Integração pronta para configuração</strong><p style="margin:6px 0 0;color:var(--text2);font-size:13px;line-height:1.5">Somente administradores do CRM podem abrir e configurar o laboratório Meta. ${escapeHtml(error.message)}</p></div>`;
  }

  function getPanel() {
    const title = integrationHeader();
    const header = title?.parentElement?.parentElement;
    if (!header) return null;
    let panel = document.querySelector("#metaTestLaboratoryPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "metaTestLaboratoryPanel";
      panel.style.cssText = "background:linear-gradient(135deg,rgba(8,102,255,.10),rgba(168,85,247,.08));border:1px solid rgba(8,102,255,.22);border-radius:14px;padding:18px 20px;margin:18px 0;color:var(--text)";
      header.insertAdjacentElement("afterend", panel);
    }
    return panel;
  }

  async function refresh() {
    const panel = getPanel();
    if (!panel || refreshPromise) return refreshPromise;
    panel.innerHTML = '<div style="color:var(--text2);font-size:13px;font-weight:700">Carregando laboratório Meta…</div>';
    refreshPromise = api("/api/crm/meta/test/status").then(status => {
      panel.innerHTML = panelMarkup(status);
      return status;
    }).catch(error => {
      panel.innerHTML = forbiddenMarkup(error);
    }).finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-meta-refresh]")) return;
    event.preventDefault();
    refresh();
  }, true);

  document.addEventListener("submit", async event => {
    const form = event.target.closest("[data-meta-config]");
    if (!form) return;
    event.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    const initial = submit.textContent;
    submit.textContent = "Salvando…";
    try {
      const formData = new FormData(form);
      await api("/api/crm/meta/test/config", {method: "POST", body: JSON.stringify({
        app_id: formData.get("app_id"),
        whatsapp_test_phone_number_id: formData.get("whatsapp_test_phone_number_id"),
        instagram_test_account_id: formData.get("instagram_test_account_id"),
        enabled: formData.get("enabled") === "on",
      })});
      await refresh();
    } catch (error) {
      submit.disabled = false;
      submit.textContent = initial;
      alert(error.message);
    }
  }, true);

  let queued = false;
  const schedule = () => {
    if (queued || document.hidden) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const panel = getPanel();
      if (!panel || panel === loadedPanel) return;
      loadedPanel = panel;
      refresh();
    });
  };
  new MutationObserver(schedule).observe(document.documentElement, {childList:true,subtree:true});
  schedule();
})();
