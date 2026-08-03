(() => {
  const state = { items: [], selectedId: null, funnelLoaded: false };
  const byId = (id) => document.getElementById(id);
  const list = byId("conversations");
  const messages = byId("messages");
  const status = byId("list-status");
  const search = byId("search");
  const identity = byId("identity");
  const inboxScreen = byId("inbox-screen");
  const funnelScreen = byId("funnel-screen");
  const funnelColumns = byId("funnel-columns");
  const funnelStatus = byId("funnel-status");

  const escape = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const displayName = (item) => item.name || item.phone || "Contato sem identificação";
  const date = (value) => value ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";

  function stageLabel(stage, status) {
    const value = String(stage || status || "").trim().toLowerCase();
    if (value.includes("resolv")) return "Resolvidos";
    if (value.includes("atend") || value.includes("andamento")) return "Em atendimento";
    if (value.includes("aguard") || value.includes("fila")) return "Aguardando";
    return "Novos";
  }

  function renderFunnel(items) {
    const stages = ["Novos", "Aguardando", "Em atendimento", "Resolvidos"];
    const groups = Object.fromEntries(stages.map((stage) => [stage, []]));
    items.forEach((item) => groups[stageLabel(item.pipeline_stage, item.status)].push(item));
    funnelColumns.innerHTML = stages.map((stage) => {
      const cards = groups[stage];
      return `<section class="funnel-column"><h3>${stage}<span class="funnel-count">${cards.length}</span></h3><div class="funnel-cards">${cards.length ? cards.map((item) => `<article class="funnel-card"><strong>${escape(displayName(item))}</strong><span>${escape(item.channel_name || "Canal não identificado")}</span><span>${escape(item.assigned_to || "Sem atendente")}</span></article>`).join("") : '<p class="funnel-empty">Nenhum atendimento nesta etapa.</p>'}</div></section>`;
    }).join("");
  }

  async function loadFunnel() {
    funnelStatus.textContent = "Carregando atendimentos…";
    funnelColumns.innerHTML = "";
    try {
      const response = await fetch("/api/crm/conversations?view=operational");
      if (!response.ok) throw new Error("Não foi possível carregar o Funil.");
      const payload = await response.json();
      let items = Array.isArray(payload.items) ? payload.items : [];
      let fallback = false;
      if (!items.length) {
        const activeResponse = await fetch("/api/crm/conversations?view=active");
        if (activeResponse.ok) {
          const activePayload = await activeResponse.json();
          items = Array.isArray(activePayload.items) ? activePayload.items : [];
          fallback = true;
        }
      }
      const visibleItems = items.slice(0, 200);
      renderFunnel(visibleItems);
      funnelStatus.textContent = fallback
        ? `${visibleItems.length} conversa${visibleItems.length === 1 ? "" : "s"} aberta${visibleItems.length === 1 ? "" : "s"} exibida${visibleItems.length === 1 ? "" : "s"} para este perfil.`
        : `${visibleItems.length} atendimento${visibleItems.length === 1 ? "" : "s"} carregado${visibleItems.length === 1 ? "" : "s"} sem alterações.`;
      state.funnelLoaded = true;
    } catch (error) {
      funnelStatus.textContent = error.message || "Não foi possível carregar o Funil.";
      funnelStatus.classList.add("error");
    }
  }

  function showScreen(screen) {
    const isInbox = screen === "inbox";
    inboxScreen.hidden = !isInbox;
    funnelScreen.hidden = isInbox;
    document.querySelectorAll(".module-tab").forEach((tab) => tab.setAttribute("aria-current", tab.dataset.screen === screen ? "page" : "false"));
    if (!isInbox && !state.funnelLoaded) loadFunnel();
  }

  function renderList() {
    const term = search.value.trim().toLowerCase();
    const visible = state.items.filter((item) => [item.name, item.phone, item.channel_name, item.snippet].some((value) => String(value || "").toLowerCase().includes(term)));
    status.textContent = `${visible.length} conversa${visible.length === 1 ? "" : "s"} disponível${visible.length === 1 ? "" : "is"}`;
    list.innerHTML = visible.length ? visible.map((item) => `<button class="conversation" type="button" data-id="${escape(item.id)}" aria-current="${item.id === state.selectedId}"><span class="conversation-top"><strong>${escape(displayName(item))}</strong><time>${escape(date(item.updated_at || item.last_message_at))}</time></span><small>${escape(item.channel_name || "Canal não identificado")}</small><span class="snippet">${escape(item.snippet || "Sem mensagem")}</span></button>`).join("") : '<div class="empty-state"><strong>Nenhuma conversa encontrada.</strong><span>Ajuste a busca para consultar outra conversa.</span></div>';
  }

  async function selectConversation(id) {
    const item = state.items.find((conversation) => String(conversation.id) === String(id));
    if (!item) return;
    state.selectedId = item.id;
    renderList();
    byId("thread-title").textContent = displayName(item);
    byId("thread-subtitle").textContent = `${item.phone || "Sem telefone"} · ${item.channel_name || "Canal não identificado"}`;
    messages.innerHTML = '<div class="empty-state"><strong>Carregando mensagens…</strong></div>';
    try {
      const response = await fetch(`/api/crm/conversations/${encodeURIComponent(item.id)}/messages?read_only=1`);
      if (!response.ok) throw new Error("Não foi possível carregar as mensagens.");
      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      messages.innerHTML = items.length ? items.map((message) => {
        const outgoing = ["out", "outbound", "sent"].includes(String(message.direction || "").toLowerCase());
        const body = message.body || (message.media_url ? "Mídia anexada (prévia de leitura)" : "Mensagem sem conteúdo textual");
        return `<article class="message ${outgoing ? "outbound" : "inbound"}"><div class="message-meta"><span>${outgoing ? "Enviada" : "Recebida"}</span><time>${escape(date(message.message_at || message.created_at))}</time></div><p class="message-body ${message.media_url ? "message-media" : ""}">${escape(body)}</p></article>`;
      }).join("") : '<div class="empty-state"><strong>Sem mensagens para exibir.</strong><span>Este histórico foi carregado sem alterações no atendimento.</span></div>';
      messages.scrollTop = messages.scrollHeight;
    } catch (error) {
      messages.innerHTML = `<div class="empty-state error"><strong>Não foi possível abrir esta conversa.</strong><span>${escape(error.message)}</span></div>`;
    }
  }

  async function load() {
    try {
      const authResponse = await fetch("/api/auth/status");
      const auth = await authResponse.json();
      if (!auth.authenticated) { location.assign("/login"); return; }
      identity.textContent = `${auth.user?.name || "Colaborador"} · CRM separado da Central`;
      const response = await fetch("/api/crm/conversations?view=workspace");
      if (!response.ok) throw new Error("Não foi possível carregar o Inbox.");
      const payload = await response.json();
      state.items = Array.isArray(payload.items) ? payload.items : [];
      renderList();
    } catch (error) {
      status.textContent = error.message || "Não foi possível carregar as conversas.";
      status.classList.add("error");
    }
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (button) selectConversation(button.dataset.id);
  });
  document.querySelector(".module-nav").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-screen]");
    if (tab) showScreen(tab.dataset.screen);
  });
  search.addEventListener("input", renderList);
  load();
})();
