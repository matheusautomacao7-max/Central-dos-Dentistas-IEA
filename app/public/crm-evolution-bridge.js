(() => {
  // O aplicativo-base reconstrói partes da tela ao trocar de aba. Sem esta
  // trava, o mesmo bridge era executado novamente e sobrescrevia o resultado
  // já recebido do n8n pelo estado inicial de carregamento.
  if (window.__ieaCrmEvolutionBridgeInstalled) return;
  window.__ieaCrmEvolutionBridgeInstalled = true;
  let loading = false;
  let statusTimer = null;
  let channelsRequest = null;
  let syncTimer = null;
  let lastSyncStatus = null;
  let n8nOperationsMarkup = window.__ieaN8nOperationsMarkup || "";
  let n8nOperationsRequest = null;
  let n8nOperationsState = "idle";
  let conversationOriginTimer = null;
  let conversationOriginItems = [];
  let conversationOriginLoadedAt = 0;
  let canManageAutomation = null;

  const text = element => (element?.textContent || "").trim();
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
  const findButton = label => [...document.querySelectorAll("button")].find(button => text(button) === label);
  const findModal = () => {
    const title = [...document.querySelectorAll("h2")].find(element => text(element) === "Conectar número WhatsApp");
    return title?.parentElement || null;
  };

  function setN8nOperationsMarkup(markup) {
    n8nOperationsMarkup = markup;
    window.__ieaN8nOperationsMarkup = markup;
    const currentPanel = document.querySelector("#n8nOperationsPanel");
    if (currentPanel) currentPanel.innerHTML = markup;
  }

  function n8nOperationsLoadingMarkup() {
    return `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:17px">
        <div><small style="display:block;color:#ea4b71;font-weight:900;letter-spacing:.1em;margin-bottom:5px">CENTRAL DE AUTOMAÇÕES</small><strong style="font-size:19px">n8n · Fluxos e execuções</strong><p style="margin:5px 0 0;color:var(--text2);font-size:12px">Atualizando os dados oficiais da instância conectada…</p></div>
        <button type="button" data-n8n-configure style="padding:9px 13px;border:1px solid #ea4b71;border-radius:9px;background:rgba(234,75,113,.09);color:#c3355a;font-weight:800;cursor:pointer">Configurar</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-bottom:18px">
        <button type="button" data-n8n-patient-tracking style="padding:15px;border:1px solid #b7d7c4;border-radius:12px;background:#f1fbf5;color:#164f31;text-align:left;cursor:pointer"><strong style="display:block;font-size:14px">Rastreamento de pacientes</strong><small style="display:block;margin-top:5px;line-height:1.45">Envios, respostas, IA, agendamentos, transferências e falhas.</small></button>
        <button type="button" data-n8n-conversation-integration style="padding:15px;border:1px solid #c8d7e7;border-radius:12px;background:#f3f7fb;color:#193b5a;text-align:left;cursor:pointer"><strong style="display:block;font-size:14px">Integração com conversas</strong><small style="display:block;margin-top:5px;line-height:1.45">Configuração do vínculo entre workflow, paciente, Evolution e conversa.</small></button>
        <button type="button" data-n8n-security-center style="padding:15px;border:1px solid #ead19f;border-radius:12px;background:#fffaf0;color:#6d4e16;text-align:left;cursor:pointer"><strong style="display:block;font-size:14px">Segurança e reversão</strong><small style="display:block;margin-top:5px;line-height:1.45">Backups, versões anteriores e restauração protegida.</small></button>
      </div>
      <div style="padding:14px 16px;border:1px solid var(--line);border-radius:11px;color:var(--text2);font-size:13px">Consultando workflows e execuções do n8n…</div>`;
  }

  async function enhanceConversationOrigin() {
    if (!location.pathname.includes("whatsapp")) return;
    const now = Date.now();
    const sharedItems = window.__ieaCrmConversationItems || [];
    const sharedAt = Number(window.__ieaCrmConversationItemsAt || 0);
    if (sharedItems.length && now - sharedAt < 90000) {
      conversationOriginItems = sharedItems.filter(item => item.campaign_name || item.automation_flow || /(^|\|\|)Campanha:/i.test(String(item.tag_names || "")));
      conversationOriginLoadedAt = sharedAt;
    } else if (!conversationOriginItems.length || now - conversationOriginLoadedAt > 60000) {
      try {
        const payload = await api("/api/crm/conversations?view=active");
        conversationOriginItems = (payload.items || []).filter(item =>
          (item.campaign_name || item.automation_flow || /(^|\|\|)Campanha:/i.test(String(item.tag_names || ""))) && item.phone
        );
        conversationOriginLoadedAt = now;
      } catch (_) {
        return;
      }
    }
    const normalized = value => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
    const compactPhone = value => String(value || "").replace(/\D/g, "");
    const findItem = value => {
      const content = normalized(value);
      const contentDigits = compactPhone(value);
      return conversationOriginItems.find(entry => {
        const phone = compactPhone(entry.phone);
        const suffix = phone.slice(-8);
        return (entry.name && content.includes(normalized(entry.name))) ||
          (phone && (contentDigits.includes(phone) || (suffix.length === 8 && contentDigits.includes(suffix))));
      });
    };
    const campaignLabel = item => {
      const tags = String(item.tag_names || "").split("||").map(value => value.trim()).filter(Boolean);
      return tags.find(value => normalized(value).startsWith("campanha:")) ||
        `Campanha: ${item.campaign_name || item.automation_flow}`;
    };
    const makeBadge = (item, placement = "after") => {
      const badge = document.createElement("span");
      badge.dataset.crmOriginBadge = String(item.id || item.conversation_id || "1");
      badge.dataset.crmOriginPlacement = placement;
      badge.title = "Campanha que originou esta conversa";
      badge.textContent = campaignLabel(item);
      badge.style.cssText = `display:inline-flex;align-items:center;${placement === "before" ? "margin-right:6px" : "margin-left:6px"};font-size:10px;font-weight:850;padding:3px 7px;border-radius:20px;line-height:1.2;white-space:nowrap;background:#efe4ff;color:#6d36a6;border:1px solid #dfcff3`;
      return badge;
    };

    // Etiqueta em cada cartão da lista. Procuramos o menor contêiner que
    // contém nome + status, evitando depender das classes minificadas.
    conversationOriginItems.forEach(item => {
      const labels = [...document.querySelectorAll("span,strong,p,div")].filter(element =>
        !element.children.length && normalized(element.textContent) === normalized(item.name)
      );
      labels.forEach(label => {
        let card = label.parentElement;
        for (let level = 0; card && level < 5; level += 1, card = card.parentElement) {
          const box = card.getBoundingClientRect();
          const cardText = normalized(card.textContent);
          if (box.width > 140 && box.width < 520 && box.height > 45 && box.height < 190 &&
              /(média|alta|baixa|aguardando atendimento|humano assumiu)/.test(cardText)) break;
        }
        if (!card || card.querySelector("[data-crm-origin-badge]")) return;
        const anchors = [...card.querySelectorAll("span")];
        const anchor = anchors.find(element => /^(média|alta|baixa|aguardando atendimento)$/i.test(text(element)));
        if (anchor) anchor.insertAdjacentElement("afterend", makeBadge(item));
        else label.insertAdjacentElement("afterend", makeBadge(item));
      });
    });

    const header = [...document.querySelectorAll("header,main > div,section > div")].find(element => {
      const text = element.textContent || "";
      return element.querySelector("h1,h2,h3,strong") && /\d{8,15}/.test(text.replace(/\D/g, ""));
    });
    if (!header) return;
    const item = findItem(header.textContent);
    if (!item) return;
    const title = header.querySelector("h1,h2,h3,strong");
    if (!title || header.querySelector("[data-crm-origin-badge]")) return;
    const priority = [...header.querySelectorAll("span,button")].find(element =>
      /^(média|alta|baixa)$/i.test(text(element))
    );
    // No cabeçalho a origem deve ficar imediatamente antes da prioridade,
    // tornando a campanha visível sem abrir o painel lateral.
    if (priority) priority.insertAdjacentElement("beforebegin", makeBadge(item, "before"));
    else title.insertAdjacentElement("afterend", makeBadge(item));
  }

  function scheduleConversationOrigin() {
    if (conversationOriginTimer) return;
    conversationOriginTimer = setTimeout(() => {
      conversationOriginTimer = null;
      enhanceConversationOrigin();
    }, 350);
  }

  function campaignDate(value) {
    return n8nDate(value);
  }

  function campaignMetric(label, value, color = "var(--text)") {
    const displayed = typeof value === "number" ? value : (value || 0);
    return `<div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px"><small style="display:block;color:var(--text3);font-weight:800">${label}</small><strong style="display:block;color:${color};font-size:24px;margin-top:4px">${displayed}</strong></div>`;
  }

  function campaignReplyStatusStyle(status) {
    if (status === "Na fila") return "background:#e8f2ff;color:#1859a9";
    if (status === "Em atendimento") return "background:#e8f8ee;color:#08783c";
    if (status === "Resolvida") return "background:var(--chip);color:var(--text2)";
    if (status === "No Inbox") return "background:#fff4d9;color:#8a5a00";
    return "background:#feecec;color:#b4232f";
  }

  function locateCampaignPatient(overlay, patient) {
    overlay.remove();
    const inboxLabel = [...document.querySelectorAll("span")].find(element => text(element) === "Inbox");
    (inboxLabel?.parentElement || inboxLabel)?.click();
    setTimeout(() => {
      const search = [...document.querySelectorAll("input")].find(input =>
        /buscar conversa/i.test(String(input.placeholder || ""))
      );
      if (!search) return;
      const value = patient.phone || patient.name || "";
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(search, value); else search.value = value;
      search.dispatchEvent(new Event("input", {bubbles:true}));
      search.focus();
    }, 450);
  }

  async function openCampaignReplies(campaign, days) {
    const overlay = document.createElement("div");
    overlay.dataset.campaignRepliesModal = "1";
    overlay.style.cssText = "position:fixed;inset:0;z-index:10050;background:rgba(8,20,32,.58);display:flex;align-items:center;justify-content:center;padding:24px";
    overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Pacientes que responderam" style="width:min(920px,96vw);max-height:88vh;display:flex;flex-direction:column;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.35);overflow:hidden"><header style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px 22px;border-bottom:1px solid var(--line)"><div><small style="color:#7c3aed;font-weight:900;letter-spacing:.08em">RESPOSTAS DA CAMPANHA</small><h2 style="margin:5px 0 0;font-size:20px">${escapeHtml(campaign.name)}</h2><p style="margin:5px 0 0;color:var(--text2);font-size:13px">Carregando os pacientes e conferindo o vínculo com o Inbox…</p></div><button type="button" data-close style="width:38px;height:38px;border:1px solid var(--line);border-radius:10px;background:var(--panel2);color:var(--text);font-size:22px;cursor:pointer">×</button></header><div data-body style="padding:20px 22px;overflow:auto"><div style="padding:28px;text-align:center;color:var(--text2)">Carregando…</div></div></section>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-close]").onclick = () => overlay.remove();
    overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
    const body = overlay.querySelector("[data-body]");
    try {
      const data = await n8nApi(`/api/crm/campaign-responses?days=${encodeURIComponent(days)}&campaign=${encodeURIComponent(campaign.campaign_key || campaign.name)}`);
      const items = data.items || [];
      overlay.querySelector("header p").textContent = `${items.length} paciente(s) identificado(s). A situação informa onde cada conversa está agora.`;
      body.innerHTML = items.length ? `<div style="display:grid;gap:10px">${items.map((item,index) => `<article style="display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(130px,.8fr) minmax(150px,.8fr) auto;align-items:center;gap:12px;padding:13px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel2)"><div><strong style="display:block">${escapeHtml(item.name)}</strong><small style="display:block;margin-top:3px;color:var(--text2)">${escapeHtml(item.phone || "Telefone não informado")}</small><span style="display:inline-flex;margin-top:7px;padding:3px 7px;border-radius:999px;background:#f1eaff;color:#6d36a6;font-size:10px;font-weight:850">${escapeHtml(item.campaign_tag)}</span></div><small style="color:var(--text2)">${campaignDate(item.replied_at)}</small><span style="justify-self:start;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:850;${campaignReplyStatusStyle(item.inbox_status)}">${escapeHtml(item.inbox_status)}</span>${item.conversation_id ? `<button type="button" data-locate="${index}" style="border:1px solid #25d366;border-radius:9px;background:rgba(37,211,102,.1);color:#138348;font-weight:850;padding:8px 10px;cursor:pointer">Localizar no Inbox</button>` : `<small style="max-width:145px;color:#b4232f">O n8n contou a resposta, mas não encontrou a conversa.</small>`}</article>`).join("")}</div>` : `<div style="padding:38px;text-align:center;color:var(--text2)"><strong style="display:block;color:var(--text);margin-bottom:6px">Nenhum paciente encontrado</strong>Não há respostas únicas para esta campanha no período selecionado.</div>`;
      body.querySelectorAll("[data-locate]").forEach(button => {
        button.onclick = () => locateCampaignPatient(overlay, items[Number(button.dataset.locate)]);
      });
    } catch (error) {
      body.innerHTML = `<div style="padding:28px;text-align:center;color:#b4232f">${escapeHtml(error.message)}</div>`;
    }
  }

  async function enhanceCampaignScreen() {
    const title = [...document.querySelectorAll("h1")].find(element => text(element).startsWith("Campanhas &"));
    // Replace the complete legacy Campaigns screen. The old view has a header
    // followed by static zeroed KPIs, so replacing only the header duplicated
    // the dashboard and mixed real data with placeholders.
    let screen = title;
    while (screen && !/overflow-y\s*:\s*auto/i.test(String(screen.getAttribute("style") || ""))) {
      screen = screen.parentElement;
    }
    if (!screen || screen.dataset.crmCampaignsRendered === "1") return;
    screen.dataset.crmCampaignsRendered = "1";
    screen.innerHTML = `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:22px"><div><h1 style="margin:0;font-size:24px;font-weight:800;color:var(--text)">Campanhas</h1><p style="margin:6px 0 0;color:var(--text2);font-size:14px">Acompanhamento real dos disparos, respostas e transferências recebidos pelo CRM.</p></div><div style="display:flex;gap:9px"><select data-campaign-days style="padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font:inherit"><option value="1">Hoje</option><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select><button type="button" data-campaign-refresh style="padding:10px 15px;border:0;border-radius:9px;background:#25d366;color:#fff;font-weight:850;cursor:pointer">Atualizar</button></div></div><div data-campaign-content style="color:var(--text2);padding:24px;text-align:center">Carregando eventos reais das campanhas…</div>`;
    const content = screen.querySelector("[data-campaign-content]");
    const load = async () => {
      const days = screen.querySelector("[data-campaign-days]").value;
      content.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text2)">Atualizando campanhas…</div>';
      try {
        // A tela de Campanhas pode ser aberta enquanto o bundle principal ainda
        // está estabilizando a navegação. XHR evita a Promise de fetch pendente
        // observada nessa transição e sempre devolve erro acionável em 15s.
        const data = await n8nApi(`/api/crm/campaigns?days=${encodeURIComponent(days)}`);
        const items = data.items || [];
        const totals = items.reduce((sum, item) => ({patients:sum.patients+Number(item.patients||0),sent:sum.sent+Number(item.sent||0),replies:sum.replies+Number(item.replies||0),handoffs:sum.handoffs+Number(item.handoffs||0),appointments:sum.appointments+Number(item.appointments||0),appointments_ai:sum.appointments_ai+Number(item.appointments_ai||0),appointments_human:sum.appointments_human+Number(item.appointments_human||0),appointments_unclassified:sum.appointments_unclassified+Number(item.appointments_unclassified||0)}), {patients:0,sent:0,replies:0,handoffs:0,appointments:0,appointments_ai:0,appointments_human:0,appointments_unclassified:0});
        const appointmentRate = totals.patients ? ((totals.appointments / totals.patients) * 100).toFixed(1) + '%' : '0%';
        content.innerHTML = `<div style="display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:12px;margin-bottom:18px">${campaignMetric('Pacientes impactados',totals.patients)}${campaignMetric('Mensagens enviadas',totals.sent,'#159447')}${campaignMetric('Respostas',totals.replies,'#1976d2')}${campaignMetric('Agendamentos',totals.appointments,'#159447')}${campaignMetric('Agendados pela IA',totals.appointments_ai,'#7c3aed')}${campaignMetric('Agendados por humano',totals.appointments_human,'#b26a00')}</div>${totals.appointments_unclassified ? `<p style="margin:-7px 0 15px;color:var(--text3);font-size:12px">${totals.appointments_unclassified} agendamento(s) antigo(s) sem origem informada.</p>` : ''}<div style="border:1px solid var(--line);border-radius:12px;overflow:auto;background:var(--panel)"><div style="min-width:1120px;display:grid;grid-template-columns:1.35fr repeat(8,minmax(78px,.62fr)) minmax(145px,.9fr);gap:10px;padding:11px 14px;background:var(--panel2);font-size:11px;font-weight:850;color:var(--text3)"><span>CAMPANHA</span><span>ENVIOS</span><span>RESPOSTAS</span><span>PARA HUMANO</span><span>AGEND.</span><span>IA</span><span>HUMANO</span><span>CONV.</span><span>FALHAS</span><span>ÚLTIMO EVENTO</span></div>${items.map((item,index)=>`<div style="min-width:1120px;display:grid;grid-template-columns:1.35fr repeat(8,minmax(78px,.62fr)) minmax(145px,.9fr);gap:10px;align-items:center;padding:13px 14px;border-top:1px solid var(--line);font-size:13px"><strong>${escapeHtml(item.name)}</strong><span>${item.sent||0}</span>${Number(item.replies||0) ? `<button type="button" data-campaign-replies="${index}" title="Ver pacientes que responderam" style="justify-self:start;border:0;background:#e8f2ff;color:#1976d2;font-weight:900;padding:5px 9px;border-radius:999px;cursor:pointer;text-decoration:underline">${item.replies}</button>` : '<span style="color:var(--text3)">0</span>'}<span style="color:#b26a00;font-weight:800">${item.handoffs||0}</span><span style="color:#159447;font-weight:800">${item.appointments||0}</span><span style="color:#7c3aed;font-weight:800">${item.appointments_ai||0}</span><span style="color:#b26a00;font-weight:800">${item.appointments_human||0}</span><span style="color:#159447;font-weight:800">${Number(item.appointment_rate||0).toFixed(1)}%</span><span style="color:${Number(item.failures||0)?'#dc3545':'var(--text2)'}">${item.failures||0}</span><small style="color:var(--text3)">${campaignDate(item.last_event_at)}</small></div>`).join('') || '<div style="padding:32px;text-align:center;color:var(--text3)">Ainda não recebemos eventos de campanha neste período. Os números aparecerão aqui automaticamente quando um workflow enviar, receber resposta, transferir para humano ou confirmar agendamento.</div>'}</div>`;
        content.querySelectorAll("[data-campaign-replies]").forEach(button => {
          button.onclick = () => openCampaignReplies(items[Number(button.dataset.campaignReplies)], days);
        });
      } catch (error) {
        content.innerHTML = `<div style="padding:24px;text-align:center;color:#b4232f">${escapeHtml(error.message)}</div>`;
      }
    };
    screen.querySelector("[data-campaign-refresh]").onclick = load;
    screen.querySelector("[data-campaign-days]").onchange = load;
    await load();
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {headers: {"Content-Type": "application/json"}, signal: AbortSignal.timeout(45000), ...options});
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      data = {error: response.ok
        ? "O servidor retornou uma resposta inválida. Atualize a página e tente novamente."
        : `Falha de comunicação com o servidor (${response.status}).`};
    }
    if (!response.ok) throw new Error(data.error || "Não foi possível acessar a Evolution API.");
    if (data.error) throw new Error(data.error);
    return data;
  }

  // A consulta dos workflows não pode ficar presa junto com as rotinas de
  // sincronização do WhatsApp. Esta chamada tem prazo próprio e sempre deixa
  // um erro acionável na tela caso o n8n fique indisponível.
  // Usa o mesmo cliente de API do restante do CRM. Ele já está validado para
  // sessão, JSON e navegação entre abas; manter um segundo cliente aqui fazia
  // o painel ficar visualmente em "consultando" mesmo após o servidor responder.
  function n8nApi(url, options = {}) {
    // Alguns navegadores mantinham a Promise do fetch pendente depois que a
    // aplicação trocava o documento do bundle. XHR mantém a chamada no mesmo
    // contexto da página, possui timeout explícito e evita a tela eternamente
    // parada em “Consultando workflows”.
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const separator = url.includes("?") ? "&" : "?";
      const requestUrl = `${url}${separator}_crm=${Date.now()}`;
      request.open(options.method || "GET", requestUrl, true);
      request.timeout = 15000;
      request.setRequestHeader("Accept", "application/json");
      request.setRequestHeader("Content-Type", "application/json");
      let completed = false;
      const complete = () => {
        if (completed || request.readyState !== XMLHttpRequest.DONE) return;
        completed = true;
        let payload = {};
        try { payload = request.responseText ? JSON.parse(request.responseText) : {}; }
        catch (_) { return reject(new Error("O servidor retornou uma resposta inválida do n8n.")); }
        if (request.status < 200 || request.status >= 300 || payload.error) {
          return reject(new Error(payload.error || `Não foi possível consultar o n8n (${request.status}).`));
        }
        resolve(payload);
      };
      // Alguns WebViews disparam readystatechange, mas não onload, depois de
      // uma troca de aba do bundle. Mantemos os dois eventos protegidos.
      request.onreadystatechange = complete;
      request.onload = complete;
      request.onerror = () => reject(new Error("Não foi possível comunicar com o n8n pelo CRM."));
      request.ontimeout = () => reject(new Error("A consulta ao n8n demorou mais de 15 segundos. Tente atualizar novamente."));
      try {
        request.send(options.body || null);
      } catch (_) {
        reject(new Error("Não foi possível iniciar a consulta ao n8n."));
      }
    });
  }

  function setStatus(modal, message, connected = false, failed = false) {
    const status = modal?.children?.[3];
    if (!status) return;
    status.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${failed ? "#ef4444" : connected ? "#25d366" : "#f59e0b"};${connected || failed ? "" : "animation:pulse 1.5s infinite"}"></span>${message}`;
    status.style.background = failed ? "rgba(239,68,68,.14)" : connected ? "rgba(37,211,102,.14)" : "rgba(245,158,11,.14)";
    status.style.color = failed ? "#c62828" : connected ? "#168447" : "#b57e12";
  }

  function setQr(modal, source) {
    const frame = modal?.children?.[2];
    if (!frame || !source) return;
    const src = source.startsWith("data:") ? source : `data:image/png;base64,${source}`;
    frame.innerHTML = `<img src="${src}" alt="QR Code real da Evolution API" style="display:block;width:100%;height:100%;object-fit:contain">`;
  }

  function ensureChannelsGrid() {
    const heading = [...document.querySelectorAll("h2")].find(element => text(element) === "Canais WhatsApp conectados");
    if (!heading) return null;
    let grid = document.querySelector("#evolutionChannelsGrid");
    if (!grid) {
      grid = document.createElement("div");
      grid.id = "evolutionChannelsGrid";
      grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:12px 0 34px";
      heading.insertAdjacentElement("afterend", grid);
    }
    return grid;
  }

  async function renderChannels(force = false) {
    const grid = ensureChannelsGrid();
    if (!grid) return;
    if (channelsRequest && !force) return channelsRequest;
    grid.dataset.evolutionState = "loading";
    grid.innerHTML = '<p style="color:var(--text3);grid-column:1/-1">Carregando canais da Evolution...</p>';
    channelsRequest = (async () => {
      try {
        const data = await api("/api/crm/evolution/instances");
        grid.dataset.evolutionState = "loaded";
        grid.innerHTML = data.items.length ? data.items.map(item => `
          <article style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
              <div><strong style="display:block;font-size:14px">${escapeHtml(item.name)}</strong><small style="color:var(--text3)">Evolution API</small></div>
              <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:800;background:${item.connected ? "rgba(37,211,102,.14)" : "rgba(239,68,68,.14)"};color:${item.connected ? "#15a34a" : "#c62828"}">
                <i style="width:7px;height:7px;border-radius:50%;background:currentColor"></i>${item.connected ? "Conectado" : "Desconectado"}
              </span>
            </div>
          </article>`).join("") : '<p style="color:var(--text3);grid-column:1/-1">Nenhum canal encontrado nesta Evolution.</p>';
      } catch (error) {
        grid.dataset.evolutionState = "error";
        grid.innerHTML = `<p style="color:#c62828;grid-column:1/-1">${escapeHtml(error.message)}</p>`;
      } finally {
        channelsRequest = null;
      }
    })();
    return channelsRequest;
  }

  function updateAutomationControls() {
    document.querySelectorAll('[data-evolution-sync="1"], [data-evolution-configure="1"]').forEach(button => {
      const allowed = canManageAutomation === true;
      button.disabled = !allowed;
      button.style.opacity = allowed ? "1" : ".55";
      button.style.cursor = allowed ? "pointer" : "not-allowed";
      button.title = allowed
        ? ""
        : canManageAutomation === false
          ? "Seu acesso não possui a permissão Gerenciar automações."
          : "Verificando sua permissão...";
    });
  }

  async function loadAutomationPermission() {
    canManageAutomation = null;
    updateAutomationControls();
    try {
      const data = await api("/api/crm/channels");
      canManageAutomation = (data.items || []).some(item => Number(item.can_manage_automation) === 1);
    } catch (_) {
      canManageAutomation = false;
    }
    updateAutomationControls();
  }

  function renderSyncStatus(status) {
    lastSyncStatus = status;
    const box = document.querySelector("#evolutionSyncStatus");
    if (!box) return;
    const errors = Array.isArray(status.errors) ? status.errors : [];
    const progress = status.instances_total ? Math.round((status.instances_done / status.instances_total) * 100) : 0;
    const waitingForTotal = status.running && !status.instances_total;
    const phaseLabel = status.phase || (waitingForTotal ? "Preparando os canais e contatos..." : "Sincronizando histórico real...");
    box.style.display = "block";
    box.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px">
      <strong>${status.running ? escapeHtml(phaseLabel) : "Última sincronização"}</strong>
      <span style="font-size:12px;color:var(--text3)">${status.instances_done || 0}/${status.instances_total || 0} canais</span>
    </div>
    <div style="height:7px;background:var(--line);border-radius:10px;overflow:hidden;position:relative"><i style="display:block;width:${waitingForTotal ? 34 : progress}%;height:100%;background:#25d366;transition:width .25s;${waitingForTotal ? "position:absolute;animation:evolutionSyncIndeterminate 1.25s ease-in-out infinite" : ""}"></i></div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:10px;font-size:12px;color:var(--text2)">
      <span>Contatos: <b>todos</b></span><span>Conversas: <b>20/07/2026 até hoje</b></span>
      <span><b>${status.contacts || 0}</b> contatos novos</span><span><b>${status.conversations || 0}</b> conversas novas</span><span><b>${status.messages || 0}</b> mensagens importadas</span>
      ${status.older_messages_removed ? `<span><b>${status.older_messages_removed}</b> mensagens anteriores a 2026 removidas do CRM</span>` : ""}
      ${errors.length ? `<span style="color:#c62828"><b>${errors.length}</b> canal(is) com falha</span>` : ""}
    </div>`;
  }

  async function pollSyncStatus() {
    try {
      const status = await api("/api/crm/evolution/sync");
      renderSyncStatus(status);
      if (status.running) syncTimer = setTimeout(pollSyncStatus, 1800);
      else { syncTimer = null; await renderChannels(true); }
    } catch (error) {
      const box = document.querySelector("#evolutionSyncStatus");
      if (box) { box.style.display = "block"; box.innerHTML = `<span style="color:#c62828">${escapeHtml(error.message)}</span>`; }
      syncTimer = null;
    }
  }

  async function startHistorySync(button) {
    button.disabled = true;
    button.textContent = "Iniciando...";
    renderSyncStatus({running:true, instances_total:0, instances_done:0, contacts:0, conversations:0, messages:0, phase:"Iniciando sincronização segura...", errors:[]});
    try {
      const status = await api("/api/crm/evolution/sync", {method: "POST", body: "{}"});
      renderSyncStatus(status);
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(pollSyncStatus, 700);
    } catch (error) {
      renderSyncStatus({running:false, errors:[{error:error.message}]});
    } finally {
      button.disabled = false;
      button.textContent = "Sincronizar histórico";
    }
  }

  async function openEvolutionSettings() {
    document.querySelector("#evolutionSettingsOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "evolutionSettingsOverlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:20px";
    overlay.innerHTML = `<form style="width:520px;max-width:94vw;background:var(--panel);color:var(--text);border-radius:16px;padding:26px;box-shadow:0 24px 70px rgba(0,0,0,.35)">
      <p style="margin:0 0 5px;color:#b58b43;font-size:11px;font-weight:800;letter-spacing:.12em">CONEXÃO PROTEGIDA</p>
      <h2 style="margin:0 0 8px">Evolution API</h2>
      <p style="margin:0 0 22px;color:var(--text2);font-size:13px">Use a URL da API e a chave global do mesmo ambiente onde estão seus números. A chave permanece somente no servidor.</p>
      <label style="display:block;font-size:11px;font-weight:800;color:var(--text3);margin-bottom:7px">URL BASE DA EVOLUTION API</label>
      <input name="url" type="url" placeholder="https://api.seudominio.com" required style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--input);color:var(--text);font:inherit;margin-bottom:16px">
      <label style="display:block;font-size:11px;font-weight:800;color:var(--text3);margin-bottom:7px">CHAVE GLOBAL DA API</label>
      <input name="key" type="password" autocomplete="new-password" placeholder="Informe para salvar ou deixe vazio para manter" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--input);color:var(--text);font:inherit;margin-bottom:8px">
      <p data-result style="min-height:20px;margin:8px 0 16px;font-size:12px;color:var(--text2)"></p>
      <div style="display:flex;justify-content:flex-end;gap:10px"><button type="button" data-cancel style="padding:10px 18px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font-weight:700">Cancelar</button><button type="submit" style="padding:10px 18px;border:0;border-radius:10px;background:#25d366;color:white;font-weight:800">Testar e salvar</button></div>
    </form>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector("form");
    const result = overlay.querySelector("[data-result]");
    overlay.querySelector("[data-cancel]").onclick = () => overlay.remove();
    overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
    try {
      const config = await api("/api/crm/evolution/config");
      form.elements.url.value = config.api_base_url || "";
      if (config.token_configured) form.elements.key.placeholder = "Chave salva com segurança — deixe vazio para manter";
    } catch (error) { result.textContent = error.message; result.style.color = "#c62828"; }
    form.onsubmit = async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true; result.style.color = "var(--text2)"; result.textContent = "Testando conexão com a Evolution…";
      try {
        const response = await api("/api/crm/evolution/config", {method: "POST", body: JSON.stringify({api_base_url: form.elements.url.value.trim(), api_key: form.elements.key.value.trim()})});
        result.style.color = "#15a34a"; result.textContent = `Conexão salva. ${response.instances_found} canal(is) localizado(s).`;
        await renderChannels();
        setTimeout(() => overlay.remove(), 1400);
      } catch (error) { result.style.color = "#c62828"; result.textContent = error.message; }
      finally { submit.disabled = false; }
    };
  }

  function n8nDate(value) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Cuiaba",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }

  function n8nWorkflowCard(item) {
    const settings = item.settings || {};
    const triggers = (item.trigger_types || []).join(", ") || "Automático";
    const integrations = (item.integrations || []).join(", ") || "Nenhuma identificada";
    const failed = Number(item.failure_count || 0);
    return `<article style="padding:13px 14px;border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <button type="button" data-n8n-detail="${escapeHtml(item.id)}" style="min-width:0;flex:1;border:0;background:transparent;color:var(--text);text-align:left;cursor:pointer">
          <strong style="display:block;font-size:13px">${escapeHtml(item.name)}</strong>
          <small style="display:block;color:var(--text3);margin-top:3px">ID ${escapeHtml(item.id)} · ${escapeHtml(item.classification || "automatic")} · ${escapeHtml(triggers)}</small>
        </button>
        <button type="button" data-n8n-workflow="${escapeHtml(item.id)}" data-active="${item.active ? "1" : "0"}" style="flex:0 0 auto;padding:6px 10px;border:0;border-radius:16px;background:${item.active ? "#dff5e8" : "#eef1f3"};color:${item.active ? "#147a43" : "#667781"};font-size:11px;font-weight:850;cursor:pointer">${item.active ? "Ativo" : "Pausado"}</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px;font-size:11px">
        <span><b>Frequência</b><br>${escapeHtml(item.frequency || "Sob demanda")}</span>
        <span><b>Última execução</b><br>${n8nDate(item.last_execution_at)}</span>
        <span><b>Resultados recentes</b><br><i style="color:#159447;font-style:normal">${Number(item.success_count || 0)} sucesso(s)</i> · <i style="color:${failed ? "#dc3545" : "var(--text3)"};font-style:normal">${failed} falha(s)</i></span>
        <span><b>Execução CRM</b><br>${settings.manual_enabled ? `Liberada · limite ${Number(settings.max_items || 25)}` : "Bloqueada"}</span>
      </div>
      <small style="display:block;color:var(--text3);margin-top:9px">Integrações: ${escapeHtml(integrations)} · clique para auditar e configurar</small>
    </article>`;
  }

  async function openN8nSettings() {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(8,19,29,.62);display:grid;place-items:center;z-index:10000;padding:20px";
    overlay.innerHTML = `<form style="width:min(560px,96vw);background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.35);overflow:hidden">
      <header style="padding:24px 26px 18px;border-bottom:1px solid var(--line)">
        <small style="display:block;color:#d08a2f;font-weight:900;letter-spacing:.12em;margin-bottom:7px">AUTOMAÇÕES E IA</small>
        <h2 style="margin:0 0 7px;font-size:24px">Conectar instância n8n</h2>
        <p style="margin:0;color:var(--text2);font-size:13px;line-height:1.55">A chave fica protegida no servidor e nunca volta para o navegador depois de salva.</p>
      </header>
      <div style="padding:22px 26px">
        <label style="display:block;font-size:11px;font-weight:900;color:var(--text3);margin-bottom:7px">URL DA INSTÂNCIA</label>
        <input name="url" type="url" placeholder="https://seu-n8n.exemplo.com" required style="width:100%;padding:13px;border:1px solid var(--line);border-radius:10px;background:var(--input);color:var(--text);font:inherit;margin-bottom:17px">
        <p style="margin:-9px 0 17px;color:var(--text3);font-size:11px">Pode colar o endereço completo do n8n. O CRM usará somente o domínio correto da API.</p>
        <label style="display:block;font-size:11px;font-weight:900;color:var(--text3);margin-bottom:7px">CHAVE DA API DO N8N</label>
        <input name="key" type="password" autocomplete="new-password" placeholder="Cole a chave criada em Settings > n8n API" style="width:100%;padding:13px;border:1px solid var(--line);border-radius:10px;background:var(--input);color:var(--text);font:inherit">
        <p style="margin:8px 0 0;color:var(--text3);font-size:11px">Recomendação: nome “CRM IEA” e expiração “Never”.</p>
        <p data-result style="min-height:20px;margin:13px 0 0;font-size:12px;color:var(--text2)"></p>
      </div>
      <footer style="display:flex;justify-content:flex-end;gap:10px;padding:17px 26px;border-top:1px solid var(--line)">
        <button type="button" data-cancel style="padding:10px 18px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font-weight:750">Cancelar</button>
        <button type="submit" style="padding:10px 18px;border:0;border-radius:10px;background:#ea4b71;color:white;font-weight:850">Testar e conectar</button>
      </footer>
    </form>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector("form");
    const result = overlay.querySelector("[data-result]");
    overlay.querySelector("[data-cancel]").onclick = () => overlay.remove();
    overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
    try {
      const config = await api("/api/crm/n8n/config");
      form.elements.url.value = config.api_base_url || "";
      if (config.token_configured) form.elements.key.placeholder = "Chave já protegida — deixe vazio para manter";
    } catch (error) {
      result.textContent = error.message;
      result.style.color = "#c62828";
    }
    form.onsubmit = async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      result.style.color = "var(--text2)";
      result.textContent = "Validando acesso e consultando os fluxos…";
      try {
        const normalizedUrl = new URL(form.elements.url.value.trim()).origin;
        const response = await api("/api/crm/n8n/config", {
          method: "POST",
          body: JSON.stringify({
            api_base_url: normalizedUrl,
            api_token: form.elements.key.value.trim(),
            active: true,
          }),
        });
        result.style.color = "#159447";
        result.textContent = response.message || "n8n conectado.";
        await renderN8nOperations(true);
        setTimeout(() => overlay.remove(), 1200);
      } catch (error) {
        result.style.color = "#c62828";
        result.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    };
  }

  async function changeN8nWorkflow(workflowId, active, button) {
    if (!confirm(`${active ? "Pausar" : "Ativar"} este fluxo no n8n?`)) return;
    button.disabled = true;
    try {
      await api(`/api/crm/n8n/workflows/${encodeURIComponent(workflowId)}/${active ? "deactivate" : "activate"}`, {
        method: "POST",
        body: "{}",
      });
      await renderN8nOperations(true);
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  }

  function n8nModalShell(title, subtitle) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(8,19,29,.68);display:grid;place-items:center;z-index:10020;padding:20px";
    overlay.innerHTML = `<section style="width:min(920px,97vw);max-height:92vh;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:0 28px 90px rgba(0,0,0,.38)">
      <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px;border-bottom:1px solid var(--line)">
        <div><small style="display:block;color:#ea4b71;font-weight:900;letter-spacing:.1em;margin-bottom:5px">N8N · AUTOMAÇÕES</small><h2 style="margin:0;font-size:23px">${escapeHtml(title)}</h2><p style="margin:6px 0 0;color:var(--text2);font-size:12px">${escapeHtml(subtitle || "")}</p></div>
        <button type="button" data-close style="width:38px;height:38px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font-size:20px;cursor:pointer">×</button>
      </header>
      <div data-body style="padding:22px 24px"><p style="color:var(--text2)">Carregando dados oficiais do n8n…</p></div>
    </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-close]").onclick = () => overlay.remove();
    overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
    return overlay;
  }

  async function openN8nPatientTracking() {
    const overlay = n8nModalShell("Rastreamento de pacientes", "Todos os eventos enviados pelos workflows, campanhas, Evolution e IA.");
    const body = overlay.querySelector("[data-body]");
    try {
      const data = await api("/api/crm/n8n/patient-events?limit=500");
      const items = data.items || [];
      const summary = data.summary || {};
      const cards = [
        ["Pacientes", summary.patients || 0],
        ["Eventos", summary.total || 0],
        ["Enviados", summary.sent || 0],
        ["Entregues/lidos", summary.delivered || 0],
        ["Responderam", summary.replied || 0],
        ["Agendamentos", summary.appointments || 0],
        ["Para humano", summary.handoffs || 0],
        ["Falhas", summary.failed || 0],
      ];
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:9px;margin-bottom:17px">${cards.map(([label,value]) => `<div style="border:1px solid var(--line);border-radius:10px;background:var(--panel2);padding:11px"><small style="color:var(--text3);font-weight:800">${label}</small><strong style="display:block;font-size:21px;margin-top:4px">${value}</strong></div>`).join("")}</div>
        <div style="display:grid;grid-template-columns:1fr 190px;gap:9px;margin-bottom:10px"><input data-track-search placeholder="Pesquisar paciente, telefone, campanha ou workflow" style="padding:11px;border:1px solid var(--line);border-radius:9px;background:var(--input);color:var(--text)"><select data-track-filter style="padding:11px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text)"><option value="">Todos os eventos</option><option value="sent">Enviados</option><option value="deliver">Entregues</option><option value="read">Lidos</option><option value="repl">Respostas</option><option value="fail">Falhas</option><option value="appointment">Agendamentos</option><option value="handoff">Transferências</option></select></div>
        <div style="overflow:auto;border:1px solid var(--line);border-radius:11px;max-height:570px"><table style="width:100%;min-width:1100px;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--panel2);text-align:left"><th style="padding:10px">Paciente</th><th style="padding:10px">Telefone</th><th style="padding:10px">Workflow/campanha</th><th style="padding:10px">Canal</th><th style="padding:10px">Evento</th><th style="padding:10px">Resultado</th><th style="padding:10px">Mensagem Evolution</th><th style="padding:10px">Horário</th></tr></thead><tbody>${items.map(item => `<tr data-track-row data-search="${escapeHtml(`${item.patient_name || ""} ${item.phone || ""} ${item.workflow_name || ""} ${item.campaign_id || ""} ${item.channel_name || ""} ${item.event_type || ""} ${item.outcome || ""}`.toLowerCase())}" data-event="${escapeHtml(String(item.event_type || "").toLowerCase())}" style="border-top:1px solid var(--line)"><td style="padding:10px;font-weight:800">${escapeHtml(item.patient_name || "Não identificado")}</td><td style="padding:10px">${escapeHtml(item.phone || "—")}</td><td style="padding:10px">${escapeHtml(item.workflow_name || item.workflow_id || "—")}<small style="display:block;color:var(--text3)">${escapeHtml(item.campaign_id || "")}</small></td><td style="padding:10px">${escapeHtml(item.channel_name || "—")}</td><td style="padding:10px">${escapeHtml(item.event_type || "—")}</td><td style="padding:10px;color:${String(item.event_type || "").includes("fail") ? "#b4232f" : "inherit"}">${escapeHtml(item.outcome || "—")}</td><td style="padding:10px;max-width:180px;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(item.external_message_id || "")}">${escapeHtml(item.external_message_id || "—")}</td><td style="padding:10px;white-space:nowrap">${n8nDate(item.occurred_at || item.received_at)}</td></tr>`).join("") || '<tr><td colspan="8" style="padding:28px;text-align:center;color:var(--text3)"><b>Nenhum paciente rastreado ainda.</b><br>Abra “Integração com conversas” para instrumentar o workflow e começar a receber os eventos.</td></tr>'}</tbody></table></div>`;
      const filterRows = () => {
        const search = String(body.querySelector("[data-track-search]")?.value || "").trim().toLowerCase();
        const event = String(body.querySelector("[data-track-filter]")?.value || "");
        body.querySelectorAll("[data-track-row]").forEach(row => {
          row.style.display = (!search || row.dataset.search.includes(search)) && (!event || row.dataset.event.includes(event)) ? "" : "none";
        });
      };
      body.querySelector("[data-track-search]")?.addEventListener("input", filterRows);
      body.querySelector("[data-track-filter]")?.addEventListener("change", filterRows);
    } catch (error) {
      body.innerHTML = `<p style="color:#b4232f">${escapeHtml(error.message)}</p>`;
    }
  }

  function openN8nConversationIntegration() {
    const overlay = n8nModalShell("Integração com conversas", "Como fazer cada envio, resposta e decisão da IA aparecer no paciente e na conversa correta.");
    const body = overlay.querySelector("[data-body]");
    const endpoint = `${location.origin}/api/integrations/crm/automation-event`;
    const example = `{
  "event_id": "{{$execution.id}}-{{$itemIndex}}-sent",
  "event_type": "message.sent",
  "workflow_id": "ID_DO_WORKFLOW",
  "workflow_name": "Nome do workflow",
  "execution_id": "{{$execution.id}}",
  "campaign_id": "Zero Carie Julho",
  "instance_name": "Zero Carie",
  "phone": "5565999999999",
  "patient_name": "Nome do paciente",
  "external_message_id": "ID_RETORNADO_PELA_EVOLUTION",
  "outcome": "sent"
}`;
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px"><div style="border:1px solid var(--line);border-radius:11px;padding:13px"><b>1. Workflow envia</b><small style="display:block;color:var(--text3);margin-top:5px">Registra paciente, telefone, campanha, canal e ID da Evolution.</small></div><div style="border:1px solid var(--line);border-radius:11px;padding:13px"><b>2. CRM relaciona</b><small style="display:block;color:var(--text3);margin-top:5px">Instância + telefone localizam automaticamente a conversa correta.</small></div><div style="border:1px solid var(--line);border-radius:11px;padding:13px"><b>3. Conversa identifica</b><small style="display:block;color:var(--text3);margin-top:5px">Aparecem origem, IA, transferência e resultado final.</small></div></div>
      <label style="display:block;font-size:11px;font-weight:900;color:var(--text3)">ENDPOINT DO CRM</label><div style="display:flex;gap:8px;margin:6px 0 16px"><input data-endpoint readonly value="${escapeHtml(endpoint)}" style="flex:1;padding:11px;border:1px solid var(--line);border-radius:9px;background:var(--input);color:var(--text)"><button data-copy-endpoint style="padding:9px 13px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font-weight:800">Copiar</button></div>
      <div style="border:1px solid #ecd29b;background:#fffaf0;border-radius:11px;padding:13px;margin-bottom:16px;color:#6e501b"><b>Autorização</b><br><small>Execuções iniciadas pelo CRM recebem um token efêmero automaticamente. Fluxos automáticos precisam usar a chave exclusiva no cabeçalho <code>X-CRM-N8N-Token</code>; ela nunca deve ser colocada no navegador.</small></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line);border-radius:11px;padding:12px 14px;margin-bottom:16px"><div><b>Chaves dos workflows automáticos</b><small data-callback-key-summary style="display:block;color:var(--text3);margin-top:4px">Consultando chaves protegidas…</small></div><button type="button" data-generate-callback-key style="padding:9px 13px;border:0;border-radius:9px;background:#0d2d4a;color:white;font-weight:850;cursor:pointer">Gerar chave exclusiva</button></div>
      <div data-callback-key-result></div>
      <strong style="display:block;margin-bottom:8px">Corpo mínimo do evento</strong><pre style="white-space:pre-wrap;overflow:auto;background:#0d2235;color:#e8f0f7;border-radius:11px;padding:15px;font-size:12px;line-height:1.55">${escapeHtml(example)}</pre>
      <div style="margin-top:15px"><b>Eventos reconhecidos</b><p style="color:var(--text2);font-size:12px;line-height:1.7;margin:6px 0">message.sent · message.delivered · message.read · message.failed · patient.replied · ai.result · human.handoff · appointment.confirmed · run.completed</p></div>`;
    body.querySelector("[data-copy-endpoint]").onclick = async event => {
      try {
        await navigator.clipboard.writeText(endpoint);
        event.currentTarget.textContent = "Copiado";
      } catch (_) {
        body.querySelector("[data-endpoint]").select();
      }
    };
    const keySummary = body.querySelector("[data-callback-key-summary]");
    const keyResult = body.querySelector("[data-callback-key-result]");
    api("/api/crm/n8n/callback-keys").then(data => {
      const active = (data.items || []).filter(item => item.active).length;
      keySummary.textContent = `${active} chave(s) ativa(s). O valor secreto nunca volta para o navegador.`;
    }).catch(error => { keySummary.textContent = error.message; });
    body.querySelector("[data-generate-callback-key]").onclick = async event => {
      const label = prompt("Nome desta chave no n8n:", "CRM IEA · eventos automáticos");
      if (!label) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const created = await api("/api/crm/n8n/callback-keys", {method:"POST",body:JSON.stringify({label})});
        keyResult.innerHTML = `<div style="border:1px solid #b9dec9;background:#f1fbf5;border-radius:11px;padding:13px;margin-bottom:16px"><b>Copie agora — esta chave será exibida uma única vez</b><div style="display:flex;gap:8px;margin-top:8px"><input data-new-callback-key readonly value="${escapeHtml(created.token)}" style="flex:1;padding:10px;border:1px solid var(--line);border-radius:9px;background:white;color:#17324d"><button type="button" data-copy-new-key style="padding:9px 12px;border:0;border-radius:9px;background:#159447;color:white;font-weight:850">Copiar chave</button></div><small style="display:block;color:#176b3b;margin-top:6px">No n8n, salve como credencial e envie no cabeçalho X-CRM-N8N-Token.</small></div>`;
        keyResult.querySelector("[data-copy-new-key]").onclick = async copyEvent => {
          const token = keyResult.querySelector("[data-new-callback-key]").value;
          try { await navigator.clipboard.writeText(token); copyEvent.currentTarget.textContent = "Copiada"; }
          catch (_) { keyResult.querySelector("[data-new-callback-key]").select(); }
        };
        keySummary.textContent = "Nova chave ativa criada com segurança.";
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    };
  }

  async function openN8nSecurityCenter() {
    const overlay = n8nModalShell("Segurança e reversão", "Cópias preservadas antes de ativar, pausar ou restaurar um workflow.");
    const body = overlay.querySelector("[data-body]");
    try {
      const data = await api("/api/crm/n8n/versions");
      const items = data.items || [];
      body.innerHTML = `<div style="border:1px solid #b9dec9;background:#f1fbf5;border-radius:11px;padding:13px;margin-bottom:16px;color:#176b3b"><b>Proteção ativa</b><br><small>Antes de qualquer alteração feita pelo CRM, a versão atual é preservada. Ao restaurar, uma nova cópia de segurança também é criada antes da reversão.</small></div><div style="border:1px solid var(--line);border-radius:11px;overflow:hidden">${items.map(item => `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px;border-top:1px solid var(--line)"><span><b>${escapeHtml(item.workflow_name)}</b><small style="display:block;color:var(--text3);margin-top:3px">Backup #${item.id} · antes de ${escapeHtml(item.action)} · ${n8nDate(item.created_at)} · ${escapeHtml(item.created_by_name || "Sistema")}</small></span><button type="button" data-restore-version="${item.id}" data-restore-workflow="${escapeHtml(item.workflow_id)}" style="padding:8px 12px;border:1px solid #c3355a;border-radius:9px;background:var(--panel);color:#c3355a;font-weight:850;cursor:pointer">Restaurar esta versão</button></div>`).join("") || '<p style="padding:24px;text-align:center;color:var(--text3)">Ainda não há versões preservadas. A primeira será criada antes da próxima ativação ou pausa.</p>'}</div>`;
      body.querySelectorAll("[data-restore-version]").forEach(button => button.onclick = async () => {
        if (!confirm("Restaurar esta versão do workflow?\n\nA versão atual será copiada antes da reversão. O fluxo não será executado automaticamente.")) return;
        button.disabled = true;
        button.textContent = "Restaurando…";
        try {
          await api(`/api/crm/n8n/workflows/${encodeURIComponent(button.dataset.restoreWorkflow)}/versions/${button.dataset.restoreVersion}/restore`, {method:"POST",body:"{}"});
          alert("Versão restaurada. Uma cópia da versão anterior também foi preservada.");
          overlay.remove();
          renderN8nOperations(true);
        } catch (error) {
          button.disabled = false;
          button.textContent = "Restaurar esta versão";
          alert(error.message);
        }
      });
    } catch (error) {
      body.innerHTML = `<p style="color:#b4232f">${escapeHtml(error.message)}</p>`;
    }
  }

  async function openN8nRunDetails(runId) {
    const overlay = n8nModalShell(`Execução #${runId}`, "Pacientes, mensagens e resultados registrados pelo workflow.");
    const body = overlay.querySelector("[data-body]");
    try {
      const data = await api(`/api/crm/n8n/runs/${encodeURIComponent(runId)}`);
      const run = data.run || {};
      const events = data.events || [];
      const processed = Number(run.processed_items || run.total_items || 0);
      const total = Math.max(Number(run.total_items || 0), processed);
      const progress = total ? Math.min(100, Math.round((processed / total) * 100)) : 0;
      const waiting = Math.max(0, Number(run.sent_items || 0) - Number(run.replied_items || 0) - Number(run.failed_items || 0) - Number(run.appointment_items || 0));
      const cards = [
        ["Processados", processed],
        ["Enviados", run.sent_items || 0],
        ["Entregues/lidos", run.delivered_items || 0],
        ["Responderam", run.replied_items || 0],
        ["Agendaram", run.appointment_items || 0],
        ["Falhas", run.failed_items || 0],
        ["Para humano", run.handoff_items || 0],
        ["Aguardando resposta", waiting],
      ];
      body.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:15px"><span style="padding:6px 11px;border-radius:18px;background:var(--panel2);font-size:12px;font-weight:850">${escapeHtml(run.status || "—")}</span><span style="padding:6px 11px;border-radius:18px;background:var(--panel2);font-size:12px">${escapeHtml(run.mode || "—")}</span><span style="padding:6px 11px;border-radius:18px;background:var(--panel2);font-size:12px">${n8nDate(run.started_at)}</span><span style="padding:6px 11px;border-radius:18px;background:var(--panel2);font-size:12px">Executado por ${escapeHtml(run.requested_by_name || "n8n")}</span><span title="Chave que impede o mesmo disparo de ser executado duas vezes" style="padding:6px 11px;border-radius:18px;background:var(--panel2);font-size:12px">Idempotência: ${escapeHtml(run.run_key || "—")}</span></div>
        <div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text3);margin-bottom:5px"><span>Progresso da execução</span><b>${processed}/${total || "—"} · ${progress}%</b></div><div style="height:9px;border-radius:9px;background:var(--panel2);overflow:hidden"><i style="display:block;width:${progress}%;height:100%;background:${Number(run.failed_items || 0) ? "#f0a22e" : "#25b96f"}"></i></div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px;margin-bottom:18px">${cards.map(([label,value]) => `<div style="border:1px solid var(--line);background:var(--panel2);border-radius:11px;padding:12px"><small style="color:var(--text3);font-weight:800">${label}</small><strong style="display:block;font-size:22px;margin-top:4px">${value}</strong></div>`).join("")}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:9px"><strong>Eventos por paciente</strong><span style="font-size:12px;color:var(--text3)">${events.length} registro(s)</span></div>
        <div style="display:grid;grid-template-columns:1fr 190px;gap:9px;margin-bottom:9px"><input data-event-search placeholder="Pesquisar paciente, telefone ou resultado" style="padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--input);color:var(--text)"><select data-event-filter style="padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text)"><option value="">Todos os eventos</option><option value="message.sent">Enviados</option><option value="message.failed">Falhas</option><option value="patient.replied">Respostas</option><option value="appointment.confirmed">Agendamentos</option><option value="human">Transferências</option></select></div>
        <div style="overflow:auto;border:1px solid var(--line);border-radius:11px;max-height:440px">
          <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:980px"><thead><tr style="background:var(--panel2);text-align:left"><th style="padding:10px">Paciente</th><th style="padding:10px">Telefone</th><th style="padding:10px">Campanha</th><th style="padding:10px">Canal</th><th style="padding:10px">Evento</th><th style="padding:10px">Resultado</th><th style="padding:10px">ID da mensagem</th><th style="padding:10px">Horário</th></tr></thead>
          <tbody>${events.map(item => `<tr data-event-row data-search="${escapeHtml(`${item.patient_name || ""} ${item.phone || ""} ${item.campaign_id || ""} ${item.channel_name || ""} ${item.event_type || ""} ${item.outcome || ""}`.toLowerCase())}" data-event="${escapeHtml(item.event_type || "")}" style="border-top:1px solid var(--line)"><td style="padding:10px;font-weight:750">${escapeHtml(item.patient_name || "Não identificado")}</td><td style="padding:10px">${escapeHtml(item.phone || "—")}</td><td style="padding:10px">${escapeHtml(item.campaign_id || "—")}</td><td style="padding:10px">${escapeHtml(item.channel_name || "—")}</td><td style="padding:10px">${escapeHtml(item.event_type || "—")}</td><td style="padding:10px;color:${String(item.event_type || "").includes("failed") ? "#dc3545" : "inherit"}">${escapeHtml(item.outcome || "—")}</td><td style="padding:10px;max-width:170px;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(item.external_message_id || "")}">${escapeHtml(item.external_message_id || "—")}</td><td style="padding:10px;white-space:nowrap">${n8nDate(item.occurred_at || item.received_at)}</td></tr>`).join("") || '<tr><td colspan="8" style="padding:22px;text-align:center;color:var(--text3)">Este workflow ainda não enviou eventos padronizados ao CRM.</td></tr>'}</tbody></table>
        </div>`;
      const applyEventFilters = () => {
        const query = String(body.querySelector("[data-event-search]")?.value || "").trim().toLowerCase();
        const eventFilter = String(body.querySelector("[data-event-filter]")?.value || "");
        body.querySelectorAll("[data-event-row]").forEach(row => {
          const matchesText = !query || String(row.dataset.search || "").includes(query);
          const currentEvent = String(row.dataset.event || "");
          const matchesEvent = !eventFilter || (eventFilter === "human" ? ["handoff", "human", "opportunity"].some(value => currentEvent.includes(value)) : currentEvent.includes(eventFilter));
          row.style.display = matchesText && matchesEvent ? "" : "none";
        });
      };
      body.querySelector("[data-event-search]")?.addEventListener("input", applyEventFilters);
      body.querySelector("[data-event-filter]")?.addEventListener("change", applyEventFilters);
      if (["requested", "running"].includes(String(run.status || "").toLowerCase())) {
        const signature = `${run.status}:${run.processed_items}:${run.sent_items}:${run.replied_items}:${run.failed_items}:${events.length}`;
        const live = document.createElement("p");
        live.style.cssText = "margin:12px 0 0;color:var(--text3);font-size:11px;text-align:right";
        live.textContent = "Acompanhamento ao vivo · atualiza automaticamente";
        body.appendChild(live);
        setTimeout(async () => {
          if (!document.body.contains(overlay)) return;
          try {
            const latest = await api(`/api/crm/n8n/runs/${encodeURIComponent(runId)}`);
            const current = latest.run || {};
            const latestEvents = latest.events || [];
            const nextSignature = `${current.status}:${current.processed_items}:${current.sent_items}:${current.replied_items}:${current.failed_items}:${latestEvents.length}`;
            if (nextSignature !== signature) {
              overlay.remove();
              openN8nRunDetails(runId);
            } else {
              live.textContent = "Acompanhamento ao vivo · aguardando o próximo evento";
            }
          } catch (_) {}
        }, 5000);
      }
    } catch (error) {
      body.innerHTML = `<p style="color:#b4232f">${escapeHtml(error.message)}</p>`;
    }
  }

  async function openN8nWorkflowDetails(workflowId) {
    const overlay = n8nModalShell("Detalhes do workflow", "Configuração segura, execuções e rastreamento operacional.");
    const body = overlay.querySelector("[data-body]");
    try {
      const data = await api(`/api/crm/n8n/workflows/${encodeURIComponent(workflowId)}`);
      const settings = data.settings || {};
      const classification = data.classification || {};
      const runs = data.runs || [];
      const executions = data.executions || [];
      const failedNodes = data.failed_nodes || [];
      const versions = data.versions || [];
      const successExecutions = executions.filter(item => item.status === "success").length;
      const failedExecutions = executions.filter(item => ["error", "failed", "crashed"].includes(item.status)).length;
      const nodeTypes = (data.nodes || []).map(item => String(item.type || "").split(".").pop()).filter(Boolean);
      const integrations = [...new Set(nodeTypes)].slice(0, 12);
      body.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:17px"><div><h3 style="margin:0 0 5px;font-size:18px">${escapeHtml(data.name)}</h3><small style="color:var(--text3)">ID ${escapeHtml(data.id)} · ${data.nodes_total || 0} nós · ${data.active ? "Ativo" : "Pausado"}</small></div><span style="padding:6px 11px;border-radius:18px;background:${data.active ? "#dff5e8" : "#eef1f3"};color:${data.active ? "#147a43" : "#667781"};font-size:11px;font-weight:900">${escapeHtml(classification.kind || "automatic")}</span></div>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:17px">
          <div style="border:1px solid var(--line);border-radius:10px;padding:11px"><small style="color:var(--text3);font-weight:800">GATILHO</small><strong style="display:block;margin-top:4px">${classification.has_schedule_trigger ? "Horário" : classification.has_webhook_trigger ? "Webhook/mensagem" : classification.has_manual_trigger ? "Manual" : "Automático"}</strong></div>
          <div style="border:1px solid var(--line);border-radius:10px;padding:11px"><small style="color:var(--text3);font-weight:800">ÚLTIMA EXECUÇÃO</small><strong style="display:block;margin-top:4px">${n8nDate(executions[0]?.started_at)}</strong></div>
          <div style="border:1px solid var(--line);border-radius:10px;padding:11px"><small style="color:var(--text3);font-weight:800">SUCESSOS RECENTES</small><strong style="display:block;margin-top:4px;color:#159447">${successExecutions}</strong></div>
          <div style="border:1px solid var(--line);border-radius:10px;padding:11px"><small style="color:var(--text3);font-weight:800">FALHAS RECENTES</small><strong style="display:block;margin-top:4px;color:${failedExecutions ? "#dc3545" : "var(--text)"}">${failedExecutions}</strong></div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:11px;margin-bottom:17px"><small style="color:var(--text3);font-weight:800">CANAIS E INTEGRAÇÕES IDENTIFICADAS</small><p style="margin:6px 0 0;font-size:12px">${escapeHtml(integrations.join(", ") || "Nenhuma integração identificada")}</p></div>
        ${failedNodes.length ? `<div style="border:1px solid #f3b6bc;background:rgba(220,53,69,.07);border-radius:11px;padding:12px 14px;margin-bottom:17px"><strong style="display:block;color:#b4232f;margin-bottom:6px">Nós que falharam na última execução com erro</strong>${failedNodes.map(item => `<div style="font-size:12px;margin-top:5px"><b>${escapeHtml(item.name)}</b> · ${escapeHtml(item.message)} <span style="color:var(--text3)">#${escapeHtml(item.execution_id)}</span></div>`).join("")}</div>` : ""}
        <form data-settings style="border:1px solid var(--line);background:var(--panel2);border-radius:12px;padding:15px;margin-bottom:18px">
          <strong style="display:block;margin-bottom:12px">Controle de execução pelo CRM</strong>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
            <label style="font-size:11px;font-weight:850;color:var(--text3)">TIPO DO FLUXO<select name="kind" style="display:block;width:100%;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text)">${["automatic","scheduled","response","manual","hybrid","critical"].map(value => `<option value="${value}" ${String(settings.workflow_kind || classification.kind) === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
            <label style="font-size:11px;font-weight:850;color:var(--text3)">LIMITE MÁXIMO<input name="max" type="number" min="1" max="5000" value="${Number(settings.max_items || 25)}" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text)"></label>
            <label style="font-size:11px;font-weight:850;color:var(--text3)">ORIGEM DA LISTA<input name="source" value="${escapeHtml(settings.source_label || "")}" placeholder="Ex.: pacientes sem agendamento" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text)"></label>
            <label style="font-size:11px;font-weight:850;color:var(--text3)">CANAL UTILIZADO<input name="channel" value="${escapeHtml(settings.channel_label || "")}" placeholder="Ex.: Zero Cárie / Orto" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text)"></label>
            <label style="grid-column:1/-1;font-size:11px;font-weight:850;color:var(--text3)">WEBHOOK SEGURO PARA EXECUTAR<input name="path" value="${escapeHtml(settings.webhook_path || "")}" placeholder="crm-executar-nome-do-fluxo" style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text)"></label>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:16px;margin:13px 0"><label><input name="manual" type="checkbox" ${settings.manual_enabled ? "checked" : ""}> Permitir execução pelo CRM</label><label><input name="test" type="checkbox" ${settings.test_mode !== 0 ? "checked" : ""}> Iniciar em modo teste</label><label><input name="confirm" type="checkbox" ${settings.requires_confirmation !== 0 ? "checked" : ""}> Exigir confirmação</label></div>
          <div style="display:flex;justify-content:flex-end;gap:9px"><span data-result style="margin-right:auto;color:var(--text2);font-size:12px"></span><button type="submit" style="padding:9px 14px;border:0;border-radius:9px;background:#0d2d4a;color:white;font-weight:850;cursor:pointer">Salvar controle</button>${settings.manual_enabled ? '<button type="button" data-run-mode="test" style="padding:9px 14px;border:1px solid #ea4b71;border-radius:9px;background:var(--panel);color:#c3355a;font-weight:850;cursor:pointer">Executar teste</button><button type="button" data-run-mode="production" style="padding:9px 14px;border:0;border-radius:9px;background:#ea4b71;color:white;font-weight:850;cursor:pointer">Executar agora</button>' : ""}</div>
        </form>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px">
          <div><strong style="display:block;margin-bottom:9px">Gatilhos e webhooks</strong><div style="border:1px solid var(--line);border-radius:11px;overflow:hidden">${(data.webhooks || []).map(item => `<div style="padding:11px;border-top:1px solid var(--line)"><strong style="font-size:12px">${escapeHtml(item.name)}</strong><small style="display:block;color:var(--text3);margin-top:3px">${escapeHtml(item.method || "GET")} · ${escapeHtml(item.path || "sem caminho")}</small></div>`).join("") || '<p style="padding:14px;color:var(--text3)">Nenhum webhook neste fluxo.</p>'}</div></div>
          <div><strong style="display:block;margin-bottom:9px">Execuções iniciadas pelo CRM</strong><div style="border:1px solid var(--line);border-radius:11px;overflow:hidden">${runs.map(run => `<button type="button" data-run-detail="${run.id}" style="display:flex;width:100%;justify-content:space-between;gap:10px;padding:11px;border:0;border-top:1px solid var(--line);background:var(--panel);color:var(--text);text-align:left;cursor:pointer"><span><strong style="display:block;font-size:12px">#${run.id} · ${escapeHtml(run.status)}</strong><small style="color:var(--text3)">${n8nDate(run.started_at)}</small></span><span style="font-size:12px">${run.sent_items || 0} enviados · ${run.replied_items || 0} respostas</span></button>`).join("") || '<p style="padding:14px;color:var(--text3)">Nenhuma execução iniciada pelo CRM.</p>'}</div></div>
        </div>
        <div style="margin-top:17px"><strong style="display:block;margin-bottom:9px">Segurança e versões preservadas</strong><div style="border:1px solid var(--line);border-radius:11px;overflow:hidden">${versions.map(version => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-top:1px solid var(--line);font-size:12px"><span>Backup #${version.id} antes de <b>${escapeHtml(version.action)}</b><small style="display:block;color:var(--text3);margin-top:3px">${escapeHtml(version.created_by_name || "Sistema")} · ${n8nDate(version.created_at)}</small></span><button type="button" data-inline-restore="${version.id}" style="padding:7px 10px;border:1px solid #c3355a;border-radius:8px;background:var(--panel);color:#c3355a;font-weight:850">Restaurar</button></div>`).join("") || '<p style="padding:14px;color:var(--text3)">Nenhuma mudança feita pelo CRM. O primeiro backup será criado antes de ativar ou pausar.</p>'}</div></div>`;
      const form = body.querySelector("[data-settings]");
      const result = form.querySelector("[data-result]");
      form.onsubmit = async event => {
        event.preventDefault();
        result.textContent = "Salvando…";
        try {
          await api(`/api/crm/n8n/workflows/${encodeURIComponent(workflowId)}/settings`, {
            method: "POST",
            body: JSON.stringify({
              workflow_kind: form.elements.kind.value,
              max_items: Number(form.elements.max.value || 25),
              source_label: form.elements.source.value.trim(),
              channel_label: form.elements.channel.value.trim(),
              webhook_path: form.elements.path.value.trim(),
              webhook_method: "POST",
              manual_enabled: form.elements.manual.checked,
              test_mode: form.elements.test.checked,
              requires_confirmation: form.elements.confirm.checked,
            }),
          });
          result.style.color = "#159447";
          result.textContent = "Controle salvo.";
          setTimeout(() => { overlay.remove(); openN8nWorkflowDetails(workflowId); }, 700);
        } catch (error) {
          result.style.color = "#b4232f";
          result.textContent = error.message;
        }
      };
      body.querySelectorAll("[data-run-mode]").forEach(runButton => runButton.addEventListener("click", async buttonEvent => {
        const button = buttonEvent.currentTarget;
        const production = button.dataset.runMode === "production";
        if (!confirm(`Executar “${data.name}” em modo ${production ? "PRODUÇÃO" : "TESTE"}?\n\nEstimativa máxima: ${form.elements.max.value} contato(s)\nOrigem: ${form.elements.source.value || "não informada"}\nCanal: ${form.elements.channel.value || "não informado"}\n\nUma chave de idempotência impedirá disparo duplicado.`)) return;
        button.disabled = true;
        button.textContent = "Iniciando…";
        try {
          const response = await api(`/api/crm/n8n/workflows/${encodeURIComponent(workflowId)}/run`, {
            method: "POST",
            body: JSON.stringify({mode: production ? "production" : "test", limit: Number(form.elements.max.value || 25), confirmed: true}),
          });
          overlay.remove();
          openN8nRunDetails(response.run_id);
        } catch (error) {
          button.disabled = false;
          button.textContent = production ? "Executar agora" : "Executar teste";
          alert(error.message);
        }
      }));
      body.querySelectorAll("[data-run-detail]").forEach(button => button.onclick = () => openN8nRunDetails(button.dataset.runDetail));
      body.querySelectorAll("[data-inline-restore]").forEach(button => button.onclick = async () => {
        if (!confirm("Restaurar este backup?\n\nA versão atual será preservada antes da reversão.")) return;
        button.disabled = true;
        button.textContent = "Restaurando…";
        try {
          await api(`/api/crm/n8n/workflows/${encodeURIComponent(workflowId)}/versions/${button.dataset.inlineRestore}/restore`, {method:"POST",body:"{}"});
          overlay.remove();
          openN8nWorkflowDetails(workflowId);
          renderN8nOperations(true);
        } catch (error) {
          button.disabled = false;
          button.textContent = "Restaurar";
          alert(error.message);
        }
      });
    } catch (error) {
      body.innerHTML = `<p style="color:#b4232f">${escapeHtml(error.message)}</p>`;
    }
  }

  async function renderN8nOperations(force = false) {
    const evolutionPanel = document.querySelector("#evolutionServerPanel");
    if (!evolutionPanel) return;
    let panel = document.querySelector("#n8nOperationsPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "n8nOperationsPanel";
      panel.style.cssText = "background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px;margin:18px 0";
      const syncPanel = document.querySelector("#evolutionSyncStatus");
      (syncPanel || evolutionPanel).insertAdjacentElement("afterend", panel);
    }
    if (n8nOperationsMarkup) panel.innerHTML = n8nOperationsMarkup;
    if (!force && n8nOperationsState === "loaded") return;
    if (n8nOperationsRequest) return n8nOperationsRequest;
    if (!n8nOperationsMarkup || force) setN8nOperationsMarkup(n8nOperationsLoadingMarkup());
    n8nOperationsState = "loading";
    n8nOperationsRequest = (async () => {
      try {
        // Uma única consulta ao overview valida a configuração e carrega os
        // fluxos. Usa o cliente principal do CRM, o mesmo já utilizado por
        // Inbox, Fila e Campanhas. Isso evita a rotina isolada de XHR que
        // podia ser interrompida pelo bundle ao trocar de aba.
        const data = await n8nApi(`/api/crm/n8n/overview?limit=50${force ? "&refresh=1" : ""}`);
        const summary = data.summary || {};
        const failures = (data.executions || []).filter(item => ["error", "failed", "crashed"].includes(item.status));
        const recent = (data.executions || []).slice(0, 12);
        n8nOperationsState = "loaded";
        setN8nOperationsMarkup(`
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:17px">
          <div><small style="display:block;color:#ea4b71;font-weight:900;letter-spacing:.1em;margin-bottom:5px">CENTRAL DE AUTOMAÇÕES</small><strong style="font-size:19px">n8n · Fluxos e execuções</strong><p style="margin:5px 0 0;color:var(--text2);font-size:12px">Dados oficiais da instância conectada, em horário de Cuiabá.</p></div>
          <div style="display:flex;gap:8px"><button type="button" data-n8n-refresh style="padding:9px 13px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font-weight:800;cursor:pointer">Atualizar</button><button type="button" data-n8n-configure style="padding:9px 13px;border:1px solid #ea4b71;border-radius:9px;background:rgba(234,75,113,.09);color:#c3355a;font-weight:800;cursor:pointer">Configurar</button></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:10px;margin-bottom:18px">
          ${[
            ["Fluxos", summary.workflows_total || 0, "var(--text)"],
            ["Ativos", summary.workflows_active || 0, "#159447"],
            ["Sucessos", summary.success || 0, "#159447"],
            ["Falhas", summary.errors || 0, summary.errors ? "#dc3545" : "var(--text)"],
            ["Executando", summary.running || 0, "#b26a00"],
          ].map(([label, value, color]) => `<div style="background:var(--panel2);border:1px solid var(--line);border-radius:11px;padding:13px"><small style="display:block;color:var(--text3);font-weight:800">${label}</small><strong style="display:block;margin-top:4px;font-size:23px;color:${color}">${value}</strong></div>`).join("")}
        </div>
        ${failures.length ? `<div style="border:1px solid #f3b6bc;background:rgba(220,53,69,.07);border-radius:11px;padding:12px 14px;margin-bottom:16px"><strong style="color:#b4232f">Atenção: ${failures.length} falha(s) entre as execuções recentes.</strong><small style="display:block;color:var(--text2);margin-top:4px">${failures.slice(0,3).map(item => `${escapeHtml(item.workflow_name)} · ${n8nDate(item.started_at)}`).join("<br>")}</small></div>` : ""}
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-bottom:18px">
          <button type="button" data-n8n-patient-tracking style="padding:15px;border:1px solid #b7d7c4;border-radius:12px;background:#f1fbf5;color:#164f31;text-align:left;cursor:pointer"><strong style="display:block;font-size:14px">Rastreamento de pacientes</strong><small style="display:block;margin-top:5px;line-height:1.45">Envios, entregas, respostas, IA, agendamentos, transferências e falhas.</small></button>
          <button type="button" data-n8n-conversation-integration style="padding:15px;border:1px solid #c8d7e7;border-radius:12px;background:#f3f7fb;color:#193b5a;text-align:left;cursor:pointer"><strong style="display:block;font-size:14px">Integração com conversas</strong><small style="display:block;margin-top:5px;line-height:1.45">Aprenda a configurar o evento que liga workflow, paciente, Evolution e conversa.</small></button>
          <button type="button" data-n8n-security-center style="padding:15px;border:1px solid #ead19f;border-radius:12px;background:#fffaf0;color:#6d4e16;text-align:left;cursor:pointer"><strong style="display:block;font-size:14px">Segurança e reversão</strong><small style="display:block;margin-top:5px;line-height:1.45">Backups, responsável, data e botão real para restaurar uma versão.</small></button>
        </div>
        <div style="display:grid;grid-template-columns:minmax(360px,1.15fr) minmax(360px,.85fr);gap:16px">
          <div><strong style="display:block;margin-bottom:9px">Auditoria dos workflows</strong><div style="max-height:560px;overflow:auto;border:1px solid var(--line);border-radius:11px">${(data.workflows || []).map(n8nWorkflowCard).join("") || '<p style="padding:14px;color:var(--text2)">Nenhum fluxo encontrado.</p>'}</div></div>
          <div><strong style="display:block;margin-bottom:9px">Execuções recentes</strong><div style="max-height:430px;overflow:auto;border:1px solid var(--line);border-radius:11px">${recent.map(item => { const failed = ["error", "failed", "crashed"].includes(item.status); return `<div style="padding:11px 12px;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px"><strong style="font-size:12px">${escapeHtml(item.workflow_name)}</strong><span style="color:${failed ? "#dc3545" : item.status === "success" ? "#159447" : "#b26a00"};font-size:11px;font-weight:850">${failed ? "Falhou" : item.status === "success" ? "Sucesso" : escapeHtml(item.status)}</span></div><small style="display:block;color:var(--text3);margin-top:4px">${n8nDate(item.started_at)} · #${escapeHtml(item.id)}</small></div>`; }).join("") || '<p style="padding:14px;color:var(--text2)">Nenhuma execução encontrada.</p>'}</div></div>
          </div>`);
      } catch (error) {
        n8nOperationsState = "error";
        setN8nOperationsMarkup(`<div style="display:flex;align-items:center;justify-content:space-between;gap:18px"><div><strong style="display:block;color:#b4232f">Não foi possível consultar o n8n</strong><small style="color:var(--text2)">${escapeHtml(error.message)}</small></div><div style="display:flex;gap:8px"><button type="button" data-n8n-refresh style="padding:9px 13px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font-weight:800;cursor:pointer">Tentar novamente</button><button type="button" data-n8n-configure style="padding:9px 13px;border:1px solid #ea4b71;border-radius:9px;background:rgba(234,75,113,.09);color:#c3355a;font-weight:800">Reconfigurar</button></div></div>`);
      } finally {
        n8nOperationsRequest = null;
      }
    })();
    // Nunca deixa a interface em estado de carregamento indefinido, mesmo se
    // um navegador interromper uma requisição durante a troca de abas.
    setTimeout(() => {
      if (n8nOperationsState !== "loading" || n8nOperationsRequest === null) return;
      n8nOperationsState = "error";
      n8nOperationsRequest = null;
      setN8nOperationsMarkup(`<div style="display:flex;align-items:center;justify-content:space-between;gap:18px"><div><strong style="display:block;color:#b4232f">A consulta dos workflows não foi concluída</strong><small style="color:var(--text2)">O CRM manteve a conexão n8n salva. Clique para tentar novamente sem reconfigurar nenhum fluxo.</small></div><button type="button" data-n8n-refresh style="padding:9px 13px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font-weight:800;cursor:pointer">Tentar novamente</button></div>`);
    }, 16000);
    return n8nOperationsRequest;
  }

  function enhanceIntegrationScreen() {
    const title = [...document.querySelectorAll("h1")].find(element => text(element) === "Integrações & Canais");
    const header = title?.parentElement?.parentElement;
    if (!header) return;
    let panel = document.querySelector("#evolutionServerPanel");
    if (!document.querySelector("#evolutionSyncAnimation")) {
      const style = document.createElement("style");
      style.id = "evolutionSyncAnimation";
      style.textContent = "@keyframes evolutionSyncIndeterminate{0%{left:-34%}50%{left:45%}100%{left:100%}}";
      document.head.appendChild(style);
    }
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "evolutionServerPanel";
      panel.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:20px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin:18px 0";
      panel.innerHTML = '<div><strong style="display:block">Servidor Evolution</strong><small style="color:var(--text3)">Todos os contatos; conversas somente de 20/07/2026 até hoje.</small></div><div style="display:flex;gap:10px"><button type="button" data-evolution-sync="1" style="padding:10px 15px;border:0;border-radius:9px;background:#25d366;color:#fff;font-weight:800;cursor:pointer">Sincronizar histórico</button><button type="button" data-evolution-configure="1" style="padding:10px 15px;border:1px solid #25d366;border-radius:9px;background:rgba(37,211,102,.1);color:#159447;font-weight:800;cursor:pointer">Configurar Evolution</button></div>';
      header.insertAdjacentElement("afterend", panel);
      loadAutomationPermission();
      renderChannels(true);
      api("/api/crm/evolution/sync").then(status => {
        if (status.started_at) renderSyncStatus(status);
        if (status.running) pollSyncStatus();
      }).catch(() => {});
    }
    let syncBox = document.querySelector("#evolutionSyncStatus");
    if (!syncBox) {
      syncBox = document.createElement("section");
      syncBox.id = "evolutionSyncStatus";
      syncBox.style.cssText = "display:none;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin:-8px 0 20px";
      panel.insertAdjacentElement("afterend", syncBox);
      if (lastSyncStatus) renderSyncStatus(lastSyncStatus);
    }
    const channelsGrid = ensureChannelsGrid();
    if (channelsGrid && !channelsGrid.dataset.evolutionState && !channelsRequest) {
      renderChannels();
    }
    if (!document.querySelector("#n8nOperationsPanel")) {
      renderN8nOperations();
    }
  }

  async function refreshStatus(instanceName, modal) {
    try {
      const data = await api("/api/crm/evolution/instances");
      const instance = data.items.find(item => item.name === instanceName);
      if (instance?.connected) {
        setStatus(modal, "WhatsApp conectado", true);
        if (statusTimer) clearInterval(statusTimer);
        statusTimer = null;
      }
    } catch (_) {}
  }

  async function generateQr() {
    const modal = findModal();
    if (!modal || loading) return;
    const input = modal.querySelector("input");
    const instanceName = "Teste-CRM-IEA";
    if (input) { input.value = instanceName; input.readOnly = true; }
    loading = true;
    const frame = modal.children?.[2];
    if (frame) frame.innerHTML = '<div style="height:100%;display:grid;place-items:center;color:#667781;font-size:13px;font-weight:700">Solicitando QR à Evolution…</div>';
    setStatus(modal, "Gerando QR Code real…");
    try {
      const data = await api("/api/crm/evolution/connect", {
        method: "POST",
        body: JSON.stringify({instance_name: instanceName, display_name: "Canal de teste CRM"}),
      });
      if (data.connected) {
        setStatus(modal, "WhatsApp conectado", true);
      } else if (data.qr_code) {
        setQr(modal, data.qr_code);
        setStatus(modal, "Aguardando leitura…");
        if (statusTimer) clearInterval(statusTimer);
        statusTimer = setInterval(() => refreshStatus(data.instance_name, modal), 4000);
      } else {
        setStatus(modal, "A instância está iniciando. Clique em Gerar novo QR novamente.");
      }
    } catch (error) {
      setStatus(modal, error.message, false, true);
    } finally {
      loading = false;
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches('[data-evolution-configure="1"]') || text(button) === "Configurar Evolution") {
      event.preventDefault();
      event.stopImmediatePropagation();
      openEvolutionSettings();
      return;
    }
    if (button.matches('[data-evolution-sync="1"]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startHistorySync(button);
      return;
    }
    if (button.matches("[data-n8n-configure]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openN8nSettings();
      return;
    }
    if (button.matches("[data-n8n-refresh]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderN8nOperations(true);
      return;
    }
    if (button.matches("[data-n8n-detail]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openN8nWorkflowDetails(button.dataset.n8nDetail);
      return;
    }
    if (button.matches("[data-n8n-patient-tracking]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openN8nPatientTracking();
      return;
    }
    if (button.matches("[data-n8n-conversation-integration]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openN8nConversationIntegration();
      return;
    }
    if (button.matches("[data-n8n-security-center]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openN8nSecurityCenter();
      return;
    }
    if (button.matches("[data-n8n-workflow]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      changeN8nWorkflow(button.dataset.n8nWorkflow, button.dataset.active === "1", button);
      return;
    }
    if (text(button) === "Gerar novo QR") {
      event.preventDefault();
      event.stopImmediatePropagation();
      generateQr();
    }
  }, true);

  let enhancementScheduled = false;
  function scheduleEnhancements() {
    if (enhancementScheduled || document.hidden) return;
    enhancementScheduled = true;
    window.requestAnimationFrame(() => {
      enhancementScheduled = false;
      enhanceIntegrationScreen();
      scheduleConversationOrigin();
      enhanceCampaignScreen();
      const modal = findModal();
      if (!modal || modal.dataset.evolutionReady) return;
      modal.dataset.evolutionReady = "1";
      const input = modal.querySelector("input");
      if (input) { input.value = "Teste-CRM-IEA"; input.readOnly = true; }
      generateQr();
    });
  }
  const observer = new MutationObserver(scheduleEnhancements);
  observer.observe(document.documentElement, {childList: true, subtree: true});
  scheduleEnhancements();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleEnhancements();
  });
})();
