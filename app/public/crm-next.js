(() => {
  const state = { items: [], selectedId: null };
  const byId = (id) => document.getElementById(id);
  const list = byId("conversations");
  const messages = byId("messages");
  const status = byId("list-status");
  const search = byId("search");
  const identity = byId("identity");

  const escape = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const displayName = (item) => item.name || item.phone || "Contato sem identificação";
  const date = (value) => value ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";

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
  search.addEventListener("input", renderList);
  load();
})();
