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
    const webhook = status.webhook || {};
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
    <div style="margin:-7px 0 17px;padding:9px 11px;border-radius:9px;background:rgba(37,99,235,.07);color:var(--text2);font-size:12px"><strong style="color:#175cd3">Último webhook:</strong> ${escapeHtml(status.last_event_status || "Nenhum evento recebido")}</div>
    <div style="border:1px solid #bcd1ff;background:rgba(255,255,255,.58);border-radius:11px;padding:13px 14px;margin:0 0 17px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><small style="display:block;color:#175cd3;font-weight:900;letter-spacing:.04em">WEBHOOK DE TESTE</small><strong style="display:block;margin-top:4px;color:var(--text);font-size:14px">${webhook.ready ? "Pronto para validar na Meta" : "Aguardando configuração segura no servidor"}</strong><code style="display:block;margin-top:6px;word-break:break-all;color:var(--text2);font:12px ui-monospace,monospace">${escapeHtml(webhook.url || "")}</code><small style="display:block;margin-top:7px;color:var(--text3);line-height:1.45">Aceita somente eventos assinados do número autorizado. Mensagens válidas são espelhadas apenas no Inbox deste CRM de teste.</small></div>
      <button type="button" data-meta-copy-webhook style="border:1px solid #bcd1ff;background:#fff;color:#175cd3;border-radius:8px;padding:8px 11px;font:800 12px inherit;cursor:pointer">Copiar URL</button>
    </div>
    <form data-meta-config style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;border-top:1px solid var(--line);padding-top:16px">
      <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:var(--text2)">ID do App Meta<input name="app_id" value="${escapeHtml(settings.app_id)}" placeholder="Ex.: 123456789" style="padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit"></label>
      <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:var(--text2)">ID do número WhatsApp de teste<input name="whatsapp_test_phone_number_id" value="${escapeHtml(settings.whatsapp_test_phone_number_id)}" placeholder="Somente ambiente de teste" style="padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit"></label>
      <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:var(--text2)">ID da conta Instagram de teste<input name="instagram_test_account_id" value="${escapeHtml(settings.instagram_test_account_id)}" placeholder="Opcional nesta etapa" style="padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit"></label>
      <label style="display:grid;gap:6px;font-size:12px;font-weight:800;color:var(--text2)">Número autorizado no laboratório<input name="authorized_test_phone" value="${escapeHtml(settings.authorized_test_phone)}" placeholder="Seu celular de teste, com DDD" inputmode="tel" style="padding:10px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);font:inherit"></label>
      <label style="display:flex;align-items:center;gap:9px;padding-top:22px;font-size:13px;font-weight:800;color:var(--text)"><input name="enabled" type="checkbox" ${enabled ? "checked" : ""}> Ativar apenas o laboratório de testes</label>
      <div style="grid-column:1 / -1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><small style="color:var(--text3);line-height:1.45">Tokens não são salvos nesta tela. A etapa seguinte adicionará o cofre de credenciais e o webhook de teste.</small><button type="submit" style="border:0;border-radius:9px;background:#0866ff;color:#fff;padding:10px 15px;font:800 13px inherit;cursor:pointer">Salvar laboratório</button></div>
    </form>
    <section data-meta-inbox style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px"><div style="color:var(--text3);font-size:13px">Carregando caixa de laboratório…</div></section>`;
  }

  function inboxMarkup(inbox) {
    if (!inbox.authorized) return `<strong style="display:block;font-size:15px">Caixa de entrada do laboratório</strong><small style="display:block;margin-top:4px;color:var(--text3)">Informe e salve o seu número de teste autorizado acima para liberar a visualização.</small>`;
    const items = inbox.items || [];
    const body = items.length ? `<div style="display:grid;gap:8px;margin-top:12px">${items.map(item => `<article style="border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:11px 12px"><small style="display:block;color:#175cd3;font-weight:800">Mensagem de teste · ${escapeHtml(item.message_type)}</small><div style="margin-top:5px;color:var(--text);white-space:pre-wrap;word-break:break-word">${escapeHtml(item.body_preview || "[Sem prévia]")}</div><small style="display:block;margin-top:7px;color:var(--text3)">${escapeHtml(item.occurred_at || item.received_at || "")}</small></article>`).join("")}</div>` : `<div style="margin-top:12px;padding:16px;border:1px dashed #bcd1ff;border-radius:10px;text-align:center;color:var(--text2);font-size:13px">Nenhuma mensagem autorizada recebida ainda.</div>`;
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><strong style="display:block;font-size:15px">Caixa de entrada do laboratório</strong><small style="display:block;margin-top:4px;color:var(--text3)">Somente leitura · número autorizado · também espelhado no Inbox do CRM de teste</small></div><button type="button" data-meta-inbox-refresh style="border:1px solid #bcd1ff;background:#fff;color:#175cd3;border-radius:8px;padding:8px 11px;font:800 12px inherit;cursor:pointer">Atualizar</button></div>${body}`;
  }

  async function loadInbox(panel) {
    const inbox = await api("/api/crm/meta/test/inbox");
    const target = panel?.querySelector("[data-meta-inbox]");
    if (target) target.innerHTML = inboxMarkup(inbox);
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
      return loadInbox(panel).catch(error => {
        const target = panel.querySelector("[data-meta-inbox]");
        if (target) target.textContent = error.message;
      }).then(() => status);
    }).catch(error => {
      panel.innerHTML = forbiddenMarkup(error);
    }).finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  document.addEventListener("click", event => {
    const inboxRefresh = event.target.closest("[data-meta-inbox-refresh]");
    if (inboxRefresh) {
      event.preventDefault();
      loadInbox(inboxRefresh.closest("#metaTestLaboratoryPanel")).catch(error => alert(error.message));
      return;
    }
    const copy = event.target.closest("[data-meta-copy-webhook]");
    if (copy) {
      event.preventDefault();
      const url = copy.closest("section")?.querySelector("code")?.textContent || "";
      if (!url) return;
      navigator.clipboard?.writeText(url).then(() => {
        const original = copy.textContent;
        copy.textContent = "URL copiada";
        setTimeout(() => { copy.textContent = original; }, 1400);
      }).catch(() => window.prompt("Copie a URL do webhook:", url));
      return;
    }
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
        authorized_test_phone: formData.get("authorized_test_phone"),
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
