(() => {
  const state = {
    items: [],
    selectedId: null,
    selected: null,
    user: null,
    funnelLoaded: false,
    busy: false,
    messagesAfterId: 0,
    pollTimer: null,
    refreshMessages: null,
  };
  const POLL_INTERVAL_MS = 2500;
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
  const ownerBadge = byId("owner-badge");
  const claimButton = byId("claim-button");
  const composer = byId("composer");
  const composerStatus = byId("composer-status");
  const messageInput = byId("message-input");
  const sendButton = byId("send-button");
  const attachmentButton = byId("attachment-button");
  const attachmentInput = byId("attachment-input");
  const recordButton = byId("record-button");
  let recorder = null;
  let recordingStream = null;
  let recordingChunks = [];

  const escape = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const displayName = (item) => item.name || item.phone || "Contato sem identificação";
  const date = (value) => value ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    let payload = {};
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) throw new Error(payload.error || `Falha no atendimento (${response.status}).`);
    return payload;
  }

  function setBusy(busy, label = "") {
    state.busy = busy;
    sendButton.disabled = busy;
    attachmentButton.disabled = busy;
    recordButton.disabled = busy;
    claimButton.disabled = busy;
    composerStatus.hidden = !label;
    composerStatus.textContent = label;
  }

  function updateAccess() {
    const item = state.selected;
    if (!item || !state.user) {
      ownerBadge.textContent = "Nenhum atendimento selecionado";
      claimButton.hidden = true;
      composer.hidden = true;
      return;
    }
    const internal = Number(item.is_internal) === 1;
    const mine = Number(item.assigned_user_id) === Number(state.user.id);
    const unassigned = !item.assigned_user_id;
    ownerBadge.textContent = internal ? "Contato interno da equipe" : mine ? `Atendimento com ${state.user.name}` : item.assigned_to ? `Em atendimento por ${item.assigned_to}` : "Aguardando atendimento";
    claimButton.hidden = internal || !unassigned || item.status === "Resolvida";
    composer.hidden = !(internal || mine);
    if (!composer.hidden) messageInput.focus();
  }

  function mediaMarkup(message) {
    if (!message.media_url) return "";
    const url = escape(message.media_url);
    const type = String(message.message_type || "").toLowerCase();
    if (type === "audio") return `<audio controls preload="metadata" src="${url}"></audio>`;
    if (type === "image" || type === "sticker") return `<img class="media-preview" loading="lazy" src="${url}" alt="Imagem da conversa">`;
    if (type === "video") return `<video controls preload="metadata" src="${url}"></video>`;
    return `<a class="media-link" href="${url}" target="_blank" rel="noopener">Abrir arquivo</a>`;
  }

  function messageRow(message) {
    const outgoing = ["out", "outbound", "sent"].includes(String(message.direction || "").toLowerCase());
    const body = message.body || (message.media_url ? "Mídia anexada" : "Mensagem sem conteúdo textual");
    return `<article class="message ${outgoing ? "outbound" : "inbound"}" data-message-id="${escape(message.id)}"><div class="message-meta"><span>${escape(message.author_label || (outgoing ? "Enviada" : "Recebida"))}</span><time>${escape(date(message.message_at || message.created_at))}</time></div>${mediaMarkup(message)}<p class="message-body">${escape(body)}</p></article>`;
  }

  function renderMessages(items, append = false) {
    if (!items.length) {
      if (!append) {
        messages.innerHTML = '<div class="empty-state"><strong>Sem mensagens para exibir.</strong><span>Este histórico foi carregado sem alterações no atendimento.</span></div>';
      }
      return;
    }
    const html = items.map((item) => messageRow(item)).join("");
    if (!append) {
      messages.innerHTML = html;
      return;
    }
    const seen = new Set(Array.from(messages.querySelectorAll("[data-message-id]")).map((node) => node.getAttribute("data-message-id")));
    const toAppend = items.filter((item) => !seen.has(String(item.id)));
    if (toAppend.length) {
      messages.insertAdjacentHTML("beforeend", toAppend.map((item) => messageRow(item)).join(""));
    }
  }

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
    if (!isInbox && state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
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
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.selectedId = item.id;
    state.selected = item;
    state.messagesAfterId = 0;
    renderList();
    updateAccess();
    byId("thread-title").textContent = displayName(item);
    byId("thread-subtitle").textContent = `${item.phone || "Sem telefone"} · ${item.channel_name || "Canal não identificado"}`;
    messages.innerHTML = '<div class="empty-state"><strong>Carregando mensagens…</strong></div>';
    const loadMessages = async () => {
      try {
        const query = state.messagesAfterId > 0 ? `?after_id=${encodeURIComponent(String(state.messagesAfterId))}&read_only=1` : "?read_only=1";
        const response = await fetch(`/api/crm/conversations/${encodeURIComponent(item.id)}/messages${query}`);
        if (!response.ok) throw new Error("Não foi possível carregar as mensagens.");
        const payload = await response.json();
        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        const shouldAppend = state.messagesAfterId > 0;
        renderMessages(nextItems, shouldAppend);
        if (nextItems.length) {
          const ids = nextItems.map((message) => Number(message.id) || 0).filter(Boolean);
          const lastId = ids.length ? Math.max(...ids) : state.messagesAfterId;
          if (lastId > state.messagesAfterId) state.messagesAfterId = lastId;
        }
        const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120;
        if (nearBottom) messages.scrollTop = messages.scrollHeight;
      } catch (error) {
        messages.innerHTML = `<div class="empty-state error"><strong>Não foi possível abrir esta conversa.</strong><span>${escape(error.message)}</span></div>`;
      }
    };
    state.refreshMessages = loadMessages;
    try {
      await loadMessages();
      state.pollTimer = setInterval(loadMessages, POLL_INTERVAL_MS);
    } catch (error) {
      messages.innerHTML = `<div class="empty-state error"><strong>Não foi possível abrir esta conversa.</strong><span>${escape(error.message)}</span></div>`;
    }
  }

  async function load() {
    try {
      const authResponse = await fetch("/api/auth/status");
      const auth = await authResponse.json();
      if (!auth.authenticated) { location.assign("/login"); return; }
      state.user = auth.user;
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

  async function claimSelected() {
    if (!state.selected || state.busy) return;
    setBusy(true, "Iniciando atendimento…");
    try {
      await api(`/api/crm/conversations/${state.selected.id}/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      state.selected.assigned_user_id = state.user.id;
      state.selected.assigned_to = state.user.name;
      state.selected.pipeline_stage = "Em atendimento";
      updateAccess();
      setBusy(false, "Atendimento iniciado e atribuído a você.");
    } catch (error) { setBusy(false, error.message); }
  }

  async function sendPayload(payload, progress) {
    if (!state.selected || state.busy) return;
    setBusy(true, progress);
    try {
      await api(`/api/crm/conversations/${state.selected.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      messageInput.value = "";
      if (state.refreshMessages) {
        await state.refreshMessages();
      } else {
        await selectConversation(state.selected.id);
      }
      setBusy(false, "Mensagem enviada.");
    } catch (error) { setBusy(false, error.message); }
  }

  function fileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    });
  }

  async function sendAttachment(file) {
    if (!file) return;
    const filename = String(file.name || "").toLowerCase();
    const extension = filename.includes(".") ? filename.split(".").pop() : "";
    const extensionMime = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      mp4: "video/mp4",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      zip: "application/zip",
    }[extension];
    const mimeType = file.type || extensionMime || "application/octet-stream";
    const type = mimeType.startsWith("image/") ? "image" : mimeType === "video/mp4" ? "video" : "document";
    try {
      const media = await fileAsBase64(file);
      await sendPayload({
        message_type: type,
        media_base64: media,
        mime_type: mimeType,
        file_name: file.name,
        text: file.name,
      }, "Enviando arquivo…");
    } catch (error) { setBusy(false, error.message); }
    attachmentInput.value = "";
  }

  async function toggleRecording() {
    if (recorder?.state === "recording") {
      recorder.stop();
      recordButton.textContent = "Gravar áudio";
      return;
    }
    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => window.MediaRecorder?.isTypeSupported(type));
      recorder = new MediaRecorder(recordingStream, preferred ? { mimeType: preferred } : undefined);
      recordingChunks = [];
      recorder.addEventListener("dataavailable", (event) => { if (event.data.size) recordingChunks.push(event.data); });
      recorder.addEventListener("stop", async () => {
        const mimeType = String(recorder.mimeType || "audio/webm").split(";", 1)[0];
        const blob = new Blob(recordingChunks, { type: mimeType });
        recordingStream?.getTracks().forEach((track) => track.stop());
        recordingStream = null;
        try {
          const audio = await fileAsBase64(blob);
          await sendPayload({ message_type: "audio", audio_base64: audio, mime_type: mimeType }, "Enviando áudio…");
        } catch (error) { setBusy(false, error.message); }
      });
      recorder.start();
      recordButton.textContent = "Enviar áudio";
      composerStatus.hidden = false;
      composerStatus.textContent = "Gravando áudio… clique novamente para enviar.";
    } catch {
      setBusy(false, "Não foi possível acessar o microfone. Verifique a permissão do navegador.");
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
  claimButton.addEventListener("click", claimSelected);
  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (text) sendPayload({ message_type: "text", text }, "Enviando mensagem…");
  });
  attachmentButton.addEventListener("click", () => attachmentInput.click());
  attachmentInput.addEventListener("change", () => sendAttachment(attachmentInput.files?.[0]));
  recordButton.addEventListener("click", toggleRecording);
  load();
})();
