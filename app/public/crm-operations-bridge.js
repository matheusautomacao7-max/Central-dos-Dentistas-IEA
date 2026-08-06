(function () {
  "use strict";

  const FEATURES = [
    ["inbox", "Inbox"], ["queue", "Filas"], ["funnel", "Funil"],
    ["management", "GestÃ£o"], ["contacts", "Pacientes"], ["control", "Controle"],
    ["campaigns", "Campanhas"], ["integrations", "IntegraÃ§Ãµes"],
    ["settings", "ConfiguraÃ§Ã£o"]
  ];
  let activeScreen = null;
  let permissionState = null;
  let permissionRequest = null;
  let permissionTimer = null;
  let permissionStateFetchedAt = 0;
  const PERMISSIONS_TTL_MS = 15000;
  let channelCacheForModal = null;
  let channelCacheForModalAt = 0;
  const CHANNEL_CACHE_TTL_MS = 30000;
  const originalNavDisplays = new WeakMap();
  let permissionNavCache = [];
  let permissionNavComputed = false;

  const esc = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  async function request(url, options) {
    const response = await fetch(url, Object.assign({ credentials: "same-origin" }, options || {}));
    const type = response.headers.get("content-type") || "";
    const data = type.includes("json") ? await response.json() : { error: await response.text() };
    if (!response.ok) throw new Error(data.error || data.detail || `Erro ${response.status}`);
    return data;
  }

  function css() {
    if (document.getElementById("iea-operations-css")) return;
    const style = document.createElement("style");
    style.id = "iea-operations-css";
    style.textContent = `
      .iea-ops-screen{position:fixed;inset:0 0 0 80px;z-index:45;background:#f3f6f8;overflow:auto;padding:28px 32px;color:#0b2945}
      .iea-ops-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px}
      .iea-ops-head h1{font-size:28px;margin:0}.iea-ops-head p{margin:5px 0 0;color:#66788a}
      .iea-btn{border:1px solid #d7e0e8;border-radius:10px;background:#fff;padding:11px 16px;font-weight:800;color:#102f4d;cursor:pointer}.iea-btn:hover{border-color:#7fa8d4;background:#f8fbff}.iea-native-settings-permissions{margin-top:16px}
      .iea-btn-primary{background:#17c964;color:#fff;border-color:#17c964}.iea-btn-dark{background:#102f4d;color:#fff}
      .iea-panel{background:#fff;border:1px solid #dde5eb;border-radius:16px;padding:20px;margin-bottom:18px}
      .iea-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
      .iea-stat{background:#fff;border:1px solid #dde5eb;border-radius:14px;padding:17px}.iea-stat small{color:#718295}.iea-stat strong{display:block;font-size:25px;margin-top:5px}
      .iea-filters{display:grid;grid-template-columns:2fr repeat(3,minmax(150px,1fr));gap:10px}
      .iea-field{width:100%;box-sizing:border-box;border:1px solid #d8e1e8;border-radius:10px;padding:11px 12px;background:#fff;color:#17344f;font-size:14px}
      .iea-table{width:100%;border-collapse:collapse}.iea-table th,.iea-table td{padding:13px 10px;border-bottom:1px solid #e7edf1;text-align:left;font-size:13px}.iea-table th{color:#718295;font-size:11px;text-transform:uppercase}
      .iea-table tr:last-child td{border-bottom:0}.iea-table .iea-action-cell{text-align:right}.iea-btn-sm{padding:7px 10px;border-radius:8px;font-size:12px}
      .iea-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}.iea-detail{padding:11px 12px;border-radius:10px;background:#f5f8fb;border:1px solid #e1e8ef}.iea-detail small{display:block;color:#718295;font-weight:700;margin-bottom:4px}.iea-detail b{word-break:break-word}.iea-detail-wide{grid-column:1/-1}.iea-detail-note{white-space:pre-wrap;line-height:1.45}
      .iea-funnel-columns{display:grid;grid-template-columns:repeat(4,minmax(230px,1fr));gap:16px;align-items:start}.iea-funnel-column{min-height:390px;background:#eef3f7;border:1px solid #dfe7ed;border-radius:16px;overflow:hidden}.iea-funnel-title{display:flex;justify-content:space-between;align-items:center;padding:16px;background:#fff;border-bottom:1px solid #e1e9ef;font-weight:850}.iea-funnel-count{background:#e9f0f5;border-radius:999px;padding:3px 10px;font-size:12px}.iea-funnel-cards{display:grid;gap:10px;padding:12px}.iea-funnel-card{background:#fff;border:1px solid #dce6ed;border-radius:13px;padding:13px;box-shadow:0 2px 7px rgba(20,48,74,.04)}.iea-funnel-card h3{font-size:14px;margin:0 0 5px}.iea-funnel-card p{color:#708397;font-size:12px;margin:0 0 11px}.iea-badge{display:inline-flex;align-items:center;max-width:100%;box-sizing:border-box;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:800;background:#eaf1ff;color:#2459b1}.iea-badge-success{background:#e8f8ef;color:#147a43}.iea-badge-danger{background:#fff0f0;color:#ba2638}.iea-badge-warning{background:#fff6de;color:#9a6500}
      .iea-contacts-toolbar{display:flex;gap:12px;align-items:center;margin-bottom:16px}.iea-contacts-toolbar .iea-field{flex:1}.iea-contact-list{max-height:calc(100vh - 250px);min-height:380px;overflow-y:auto;padding-right:6px}.iea-contact-list::-webkit-scrollbar{width:10px}.iea-contact-list::-webkit-scrollbar-thumb{background:#b7c6d5;border-radius:999px;border:3px solid #fff}.iea-contact-card{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 4px;border-bottom:1px solid #e8eef3}.iea-contact-card:last-child{border-bottom:0}.iea-contact-card h3{margin:0 0 4px;font-size:15px}.iea-contact-card p{margin:0;color:#718295;font-size:13px}.iea-contact-avatar{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#e5efff;color:#2459b1;font-weight:850;flex:0 0 auto}
      .iea-user{border:1px solid #dce5eb;border-radius:14px;padding:16px;background:#fff}.iea-user h3{margin:0 0 4px}.iea-user small{color:#718295}
      .iea-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:13px}.iea-checks label{display:flex;gap:8px;align-items:center;font-size:13px}
      .iea-modal-bg{position:fixed;inset:0;z-index:100;background:rgba(8,26,42,.54);display:grid;place-items:center;padding:20px}
      .iea-modal{width:min(560px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.25)}
      .iea-modal h2{margin:0 0 5px}.iea-form{display:grid;gap:13px;margin-top:20px}.iea-form label{font-size:12px;font-weight:800;color:#607488}.iea-form label .iea-field{margin-top:6px}
      body[data-omtheme='dark'] .iea-ops-screen{background:#0b141a;color:#e9edef}body[data-omtheme='dark'] .iea-panel,body[data-omtheme='dark'] .iea-stat,body[data-omtheme='dark'] .iea-user,body[data-omtheme='dark'] .iea-modal,body[data-omtheme='dark'] .iea-funnel-column,body[data-omtheme='dark'] .iea-funnel-card{border-color:#2a3942;background:#111b21;color:#e9edef}body[data-omtheme='dark'] .iea-field,body[data-omtheme='dark'] .iea-btn,body[data-omtheme='dark'] .iea-funnel-title{border-color:#2a3942;background:#182229;color:#e9edef}body[data-omtheme='dark'] .iea-btn-primary{border-color:#17c964;background:#17c964;color:#fff}body[data-omtheme='dark'] .iea-btn-dark{border-color:#31516b;background:#183653;color:#fff}body[data-omtheme='dark'] .iea-ops-head p,body[data-omtheme='dark'] .iea-stat small,body[data-omtheme='dark'] .iea-user small,body[data-omtheme='dark'] .iea-form label,body[data-omtheme='dark'] .iea-table th,body[data-omtheme='dark'] .iea-funnel-card p,body[data-omtheme='dark'] .iea-detail small,body[data-omtheme='dark'] .iea-contact-card p{color:#9aa9b2}body[data-omtheme='dark'] .iea-table th,body[data-omtheme='dark'] .iea-table td,body[data-omtheme='dark'] .iea-contact-card{border-color:#2a3942}body[data-omtheme='dark'] .iea-funnel-column{background:#0d171d}body[data-omtheme='dark'] .iea-detail{background:#182229;border-color:#2a3942}body[data-omtheme='dark'] .iea-contact-list::-webkit-scrollbar-thumb{background:#4c6375;border-color:#111b21}
      @media(max-width:1100px){.iea-funnel-columns{grid-template-columns:repeat(2,minmax(240px,1fr))}}@media(max-width:900px){.iea-ops-screen{left:74px;padding:20px 16px}.iea-filters{grid-template-columns:1fr}.iea-checks{grid-template-columns:1fr}.iea-detail-grid,.iea-funnel-columns{grid-template-columns:1fr}.iea-contacts-toolbar{align-items:stretch;flex-direction:column}.iea-contact-card{align-items:flex-start;flex-direction:column}.iea-contact-list{max-height:none}}
    `;
    document.head.appendChild(style);
  }

  function screen(title, subtitle) {
    css();
    if (window.IEACrmGoals && window.IEACrmGoals.close) window.IEACrmGoals.close();
    closeScreen();
    const root = document.createElement("section");
    root.className = "iea-ops-screen";
    root.innerHTML = `<div class="iea-ops-head"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><button class="iea-btn" data-close>Voltar</button></div><div data-body></div>`;
    root.querySelector("[data-close]").onclick = closeScreen;
    document.body.appendChild(root);
    activeScreen = root;
    return root.querySelector("[data-body]");
  }

  function closeScreen(event) {
    if (event && event.target && event.target.closest && event.target.closest("[data-iea-patient-control]")) return;
    if (activeScreen) activeScreen.remove();
    activeScreen = null;
    const url = new URL(window.location.href);
    if (url.searchParams.get("screen") === "patient-control") {
      url.searchParams.delete("screen");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  async function openControl() {
    const body = screen("Controle de pacientes", "Atendimentos finalizados, mÃ©tricas e exportaÃ§Ã£o em uma tela nativa do CRM.");
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "patient-control");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    body.innerHTML = `<div class="iea-panel"><div class="iea-filters">
      <input class="iea-field" data-search placeholder="Buscar paciente ou telefone">
      <select class="iea-field" data-period><option value="30d">Ãšltimos 30 dias</option><option value="today">Hoje</option><option value="7d">Ãšltimos 7 dias</option></select>
      <select class="iea-field" data-category><option value="">Todas as categorias</option></select>
      <select class="iea-field" data-outcome><option value="">Todos os resultados</option></select>
    </div><div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="iea-btn iea-btn-dark" data-export>Exportar informaÃƒÂ§ÃƒÂµes</button></div></div><div data-results><div class="iea-panel">Carregando atendimentos...</div></div>`;
    const load = async () => {
      const params = new URLSearchParams({ per_page: "50", period: body.querySelector("[data-period]").value });
      const search = body.querySelector("[data-search]").value.trim();
      const category = body.querySelector("[data-category]").value;
      const outcome = body.querySelector("[data-outcome]").value;
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (outcome) params.set("outcome", outcome);
      try {
        const data = await request(`/api/crm/patient-control?${params}`);
        const summary = data.summary || {};
        // /api/crm/patient-control devolve um ledger paginado em `rows`.
        // A tela antiga procurava `items`, entÃ£o exibia zero linhas mesmo
        // depois de a finalizaÃ§Ã£o ter sido persistida corretamente.
        const items = data.rows || data.items || [];
        const filterData = data.filters || {};
        fillOptions(body.querySelector("[data-category]"), filterData.categories || [], category);
        fillOptions(body.querySelector("[data-outcome]"), filterData.outcomes || [], outcome);
        const rowById = new Map(items.map(row => [String(row.id), row]));
        body.querySelector("[data-results]").innerHTML = `<div class="iea-grid" style="margin-bottom:18px">
          ${stat("Atendimentos", summary.total)}${stat("Agendamentos", summary.scheduled)}
          ${stat("Com participaÃ§Ã£o da IA", summary.ai_involved)}${stat("Finalizados por humano", summary.human_finalized)}
        </div><div class="iea-panel" style="overflow:auto"><table class="iea-table"><thead><tr><th>Paciente</th><th>Finalizado em</th><th>Atendente</th><th>Categoria</th><th>Resultado</th><th>Agendamento</th><th>Canal</th><th>Profissional</th><th></th></tr></thead><tbody>
          ${items.length ? items.map(row => {
            const scheduled = [row.scheduled_date, row.scheduled_time].filter(Boolean).join(" Â· ") || row.scheduled_at || "-";
            return `<tr><td><b>${esc(row.contact_name || row.patient_name || row.name)}</b><br><small>${esc(row.phone)}</small></td><td>${esc(row.resolved_at || row.finished_at)}</td><td>${esc(row.resolved_by_name || row.agent_name || row.attendant_name)}</td><td>${esc(row.category)}</td><td>${esc(row.outcome || row.result)}</td><td>${esc(scheduled)}</td><td>${esc(row.channel_name || row.channel)}</td><td>${esc(row.responsible_professional || row.professional_name || "-")}</td><td class="iea-action-cell"><button class="iea-btn iea-btn-sm" data-detail="${Number(row.id)}">Detalhar</button></td></tr>`;
          }).join("") : `<tr><td colspan="9" style="text-align:center;padding:35px;color:#718295">Nenhum atendimento corresponde aos filtros.</td></tr>`}
        </tbody></table></div>`;
        body.querySelectorAll("[data-detail]").forEach(button => {
          button.onclick = () => openResolutionDetails(rowById.get(button.dataset.detail));
        });
      } catch (error) {
        body.querySelector("[data-results]").innerHTML = `<div class="iea-panel" style="color:#bd2436">${esc(error.message)}</div>`;
      }
    };
    let timer;
    body.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 250); });
    body.addEventListener("change", load);
    body.querySelector("[data-export]").onclick = () => {
      const params = new URLSearchParams({ export: "csv", per_page: "5000", period: body.querySelector("[data-period]").value });
      [["search", "[data-search]"], ["category", "[data-category]"], ["outcome", "[data-outcome]"]].forEach(([key, selector]) => {
        const value = body.querySelector(selector).value.trim();
        if (value) params.set(key, value);
      });
      window.location.assign(`/api/crm/patient-control?${params}`);
    };
    load();
  }

  function detail(label, value, wide) {
    const safe = value === null || value === undefined || value === "" ? "-" : value;
    return `<div class="iea-detail${wide ? " iea-detail-wide" : ""}"><small>${esc(label)}</small><b class="${wide ? "iea-detail-note" : ""}">${esc(safe)}</b></div>`;
  }

  function openResolutionDetails(row) {
    if (!row) return;
    css();
    let metadata = row.metadata_json;
    try { metadata = typeof metadata === "string" ? JSON.parse(metadata) : (metadata || {}); } catch (_) { metadata = { "Dados adicionais": metadata }; }
    const extra = Object.entries(metadata || {}).filter(([key]) => !["contact_name", "channel_name"].includes(key));
    const scheduled = [row.scheduled_date, row.scheduled_time].filter(Boolean).join(" Ã‚Â· ") || "-";
    const overlay = document.createElement("div");
    overlay.className = "iea-modal-bg";
    overlay.innerHTML = `<article class="iea-modal"><div style="display:flex;justify-content:space-between;gap:18px;align-items:start"><div><h2>Detalhes do atendimento</h2><p style="margin:5px 0 0;color:#718295">${esc(row.contact_name || row.patient_name || row.name)}${row.attendance_number ? ` Ã‚Â· #${esc(row.attendance_number)}` : ""}</p></div><button class="iea-btn iea-btn-sm" data-close>Fechar</button></div><div class="iea-detail-grid">
      ${detail("Finalizado em", row.resolved_at)}${detail("Atendente", row.resolved_by_name)}
      ${detail("Categoria", row.category)}${detail("Resultado", row.outcome || row.result)}
      ${detail("Tipo de paciente", row.patient_type)}${detail("RecuperaÃ§Ã£o", row.is_recovery ? "Sim" : "NÃ£o")}
      ${detail("Interesse", row.interest)}${detail("Origem", row.origin)}
      ${detail("Profissional responsÃ¡vel", row.responsible_professional)}${detail("Canal", row.channel_name || row.channel)}
      ${detail("Agendamento", scheduled)}${detail("Tipo de agendamento", row.schedule_type)}
      ${detail("PrÃ³ximo contato", row.next_contact_at)}${detail("Tentativas", row.attempts)}
      ${detail("Finalizado por", row.final_actor)}${detail("ParticipaÃ§Ã£o da IA", row.ai_involved ? "Sim" : "NÃ£o")}
      ${detail("Motivo de perda", row.loss_reason, true)}${detail("Observa\\u00e7\\u00f5es registradas", row.notes, true)}
      ${extra.map(([key, value]) => detail(key, typeof value === "object" ? JSON.stringify(value) : value, true)).join("")}
    </div></article>`;
    overlay.querySelector("[data-close]").onclick = () => overlay.remove();
    overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }

  function stat(label, value) {
    return `<div class="iea-stat"><small>${esc(label)}</small><strong>${Number(value || 0)}</strong></div>`;
  }

  function fillOptions(select, values, selected) {
    if (!Array.isArray(values) || !values.length || select.options.length > 1) return;
    values.forEach(value => {
      const label = typeof value === "object" ? (value.label || value.name || value.value) : value;
      const option = new Option(label, typeof value === "object" ? (value.value || label) : label);
      option.selected = option.value === selected;
      select.add(option);
    });
  }

  function funnelStage(item) {
    if (String(item.status || "").toLowerCase() === "resolvida" || String(item.pipeline_stage || "").toLowerCase() === "resolvido") return "Resolvido";
    const stage = String(item.pipeline_stage || "Novo");
    return ["Novo", "Em atendimento", "Aguardando cliente"].includes(stage) ? stage : "Novo";
  }

  function funnelBadge(outcome) {
    const value = String(outcome || "").trim();
    const normalized = normalize(value);
    const tone = normalized.includes("desqual") || normalized.includes("perd") ? " iea-badge-danger"
      : normalized.includes("agend") ? " iea-badge-success" : " iea-badge-warning";
    return `<span class="iea-badge${tone}">${esc(value || "Finalizado")}</span>`;
  }

  async function openFunnel() {
    const body = screen("Funil operacional", "Acompanhe os atendimentos por etapa e filtre os resultados finalizados.");
    body.innerHTML = `<div class="iea-panel"><div class="iea-filters"><input class="iea-field" data-funnel-search placeholder="Buscar paciente ou canal"><select class="iea-field" data-funnel-stage><option value="">Todas as etapas</option><option value="Novo">Novos</option><option value="Em atendimento">Em atendimento</option><option value="Aguardando cliente">Aguardando cliente</option><option value="Resolvido">Resolvidos</option></select><select class="iea-field" data-funnel-outcome><option value="">Todos os resultados</option></select><select class="iea-field" data-funnel-channel><option value="">Todos os canais</option></select></div></div><div data-funnel-results><div class="iea-panel">Carregando funil...</div></div>`;
    let dataset = [];
    const render = () => {
      const search = normalize(body.querySelector("[data-funnel-search]").value);
      const wantedStage = body.querySelector("[data-funnel-stage]").value;
      const wantedOutcome = body.querySelector("[data-funnel-outcome]").value;
      const wantedChannel = body.querySelector("[data-funnel-channel]").value;
      const items = dataset.filter(item => (!wantedStage || item.stage === wantedStage) && (!wantedOutcome || item.outcome === wantedOutcome) && (!wantedChannel || item.channel === wantedChannel) && (!search || normalize(`${item.name} ${item.channel} ${item.owner} ${item.outcome}`).includes(search)));
      const columns = [["Novo", "Novos"], ["Em atendimento", "Em atendimento"], ["Aguardando cliente", "Aguardando cliente"], ["Resolvido", "Resolvidos"]];
      body.querySelector("[data-funnel-results]").innerHTML = `<div class="iea-funnel-columns">${columns.map(([stage, title]) => {
        const list = items.filter(item => item.stage === stage);
        return `<section class="iea-funnel-column"><header class="iea-funnel-title"><span>${esc(title)}</span><span class="iea-funnel-count">${list.length}</span></header><div class="iea-funnel-cards">${list.length ? list.map(item => `<article class="iea-funnel-card"><h3>${esc(item.name)}</h3><p>${esc(item.channel || "Canal nÃƒÂ£o identificado")}</p>${stage === "Resolvido" ? funnelBadge(item.outcome) : `<span class="iea-badge">${esc(item.owner || "Aguardando atendimento")}</span>`}</article>`).join("") : `<p style="margin:17px;text-align:center;color:#718295;font-size:13px">Nenhum atendimento</p>`}</div></section>`;
      }).join("")}</div>`;
    };
    try {
      const data = await request("/api/crm/conversations?view=operational&compact=pipeline");
      dataset = (data.items || []).map(item => ({ id: item.id, name: item.name || "Sem nome", channel: item.channel_name || item.instance_name || "", owner: item.assigned_to || item.resolved_by || "", stage: funnelStage(item), outcome: item.resolution_reason || "" }));
      const outcomes = [...new Set(dataset.filter(item => item.stage === "Resolvido" && item.outcome).map(item => item.outcome))].sort();
      const channels = [...new Set(dataset.map(item => item.channel).filter(Boolean))].sort();
      fillOptions(body.querySelector("[data-funnel-outcome]"), outcomes, "");
      fillOptions(body.querySelector("[data-funnel-channel]"), channels, "");
      render();
    } catch (error) {
      body.querySelector("[data-funnel-results]").innerHTML = `<div class="iea-panel" style="color:#bd2436">${esc(error.message)}</div>`;
    }
    body.addEventListener("input", render);
    body.addEventListener("change", render);
  }

  function contactInitials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
  }

  function compactPhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  async function openContacts() {
    const body = screen("Pacientes", "Encontre um contato por nome ou telefone e inicie novos atendimentos.");
    body.innerHTML = `<div class="iea-panel"><div class="iea-contacts-toolbar"><input class="iea-field" data-contact-search placeholder="Buscar por nome ou qualquer parte do telefone"><button class="iea-btn iea-btn-primary" data-new-contact>+ Iniciar contato novo</button></div><div class="iea-contact-list" data-contact-list>Carregando contatos...</div></div>`;
    let contacts = [];
    let contactIndex = new Map();
    let searchDebounce = null;
    let renderVersion = 0;
    const searchInput = body.querySelector("[data-contact-search]");
    const contactList = body.querySelector("[data-contact-list]");
    const scheduleRender = () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(render, 120);
    };
    const render = () => {
      const version = ++renderVersion;
      const rawQuery = searchInput.value.trim();
      const queryText = normalize(rawQuery);
      const queryPhone = compactPhone(rawQuery);
      requestAnimationFrame(() => {
        if (version !== renderVersion) return;
        const filtered = contacts.filter(contact => (!queryText || contact.searchName.includes(queryText)) || (!queryPhone || contact.searchPhone.includes(queryPhone)));
        contactList.innerHTML = filtered.length ? filtered.map(contact => `<article class="iea-contact-card"><div style="display:flex;align-items:center;gap:12px;min-width:0"><span class="iea-contact-avatar">${esc(contact.initials)}</span><div><h3>${esc(contact.name)}</h3><p>${esc(contact.phone || "Sem telefone")}</p></div></div><button class="iea-btn iea-btn-sm" data-start-contact="${esc(contact.id)}">Iniciar conversa</button></article>`).join("") : `<p style="text-align:center;color:#718295;padding:36px 10px">Nenhum contato encontrado.</p>`;
      });
    };
    contactList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-start-contact]");
      if (!button) return;
      const contact = contactIndex.get(button.dataset.startContact);
      if (contact) openConversationModal(contact);
    });
    searchInput.oninput = scheduleRender;
    searchInput.onchange = scheduleRender;
    body.querySelector("[data-new-contact]").onclick = () => openConversationModal();
    try {
      const data = await request("/api/crm/contacts");
      contacts = (data.items || []).map(contact => {
        const name = String(contact.name || "Sem nome");
        const phone = String(contact.phone || "");
        return {
          ...contact,
          name,
          phone,
          initials: contactInitials(name),
          searchName: normalize(name),
          searchPhone: compactPhone(phone)
        };
      });
      contactIndex = new Map(contacts.map(contact => [String(contact.id), contact]));
      render();
    } catch (error) {
      contactList.innerHTML = `<p style="color:#bd2436">${esc(error.message)}</p>`;
    }
  }

  async function openSettings() {
    const body = screen("ConfiguraÃ§Ã£o e permissÃµes", "Controle quais mÃ³dulos e canais cada pessoa pode visualizar no CRM.");
    body.innerHTML = `<div class="iea-panel">Carregando usuÃ¡rios e permissÃµes...</div>`;
    try {
      const data = await request("/api/admin/crm-channel-access");
      body.innerHTML = `<div class="iea-grid">${(data.users || []).map(user => userCard(user, data.channels || [])).join("")}</div>`;
      body.querySelectorAll("[data-user]").forEach(card => {
        const channelScope = card.querySelector("[data-channel-scope]");
        const channels = [...card.querySelectorAll("[data-channel]")];
        if (channelScope && channels.length) {
          channels.forEach(input => {
            input.onchange = () => {
              if (channels.some(item => !item.checked)) channelScope.checked = true;
            };
          });
          channelScope.onchange = () => {
            if (!channelScope.checked) channels.forEach(input => { input.checked = true; });
          };
        }
        const scope = card.querySelector("[data-feature-scope]");
        const features = [...card.querySelectorAll("[data-feature]")];
        if (!scope || !features.length) return;
        features.forEach(input => {
          input.onchange = () => {
            // Desmarcar qualquer tela ativa a restriÃ§Ã£o automaticamente.
            if (features.some(item => !item.checked)) scope.checked = true;
          };
        });
        scope.onchange = () => {
          // "Todas as telas" deve ser uma aÃ§Ã£o explÃ­cita e previsÃ­vel.
          if (!scope.checked) features.forEach(input => { input.checked = true; });
        };
      });
      body.querySelectorAll("[data-save-user]").forEach(button => {
        button.onclick = () => saveUser(button.closest("[data-user]"));
      });
    } catch (error) {
      body.innerHTML = `<div class="iea-panel"><h3>Acesso restrito</h3><p>${esc(error.message)}</p><p>Somente o administrador do CRM ou o administrador geral pode alterar essas permissÃµes.</p></div>`;
    }
  }

  function csv(value) {
    if (Array.isArray(value)) return value.map(String);
    return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
  }

  function userCard(user, channels) {
    const features = csv(user.feature_keys);
    const featureScopeEnabled = Number(user.crm_feature_scope_enabled) === 1;
    const selectedChannels = new Set(csv(user.channel_ids));
    const level = user.crm_access_level === "admin" ? "Administrador do CRM" : "Atendente do CRM";
    if (user.crm_access_level === "admin") {
      return `<article class="iea-user" data-user="${Number(user.id)}"><h3>${esc(user.name)}</h3><small>${esc(user.email)} Â· ${esc(level)}</small><div class="iea-panel" style="margin-top:14px"><strong>Acesso total ao CRM</strong><p style="margin-bottom:0">Pode configurar metas e permissÃµes. Este grau Ã© alterado no cadastro do profissional.</p></div></article>`;
    }
    return `<article class="iea-user" data-user="${Number(user.id)}"><h3>${esc(user.name)}</h3><small>${esc(user.email)} Â· ${esc(level)}</small>
      <label style="display:flex;gap:8px;margin:14px 0 8px;font-size:13px"><input type="checkbox" data-channel-scope ${user.crm_channel_scope_enabled ? "checked" : ""}> Restringir aos canais selecionados</label>
      <div class="iea-checks">${channels.map(channel => `<label><input type="checkbox" data-channel="${Number(channel.id)}" ${selectedChannels.has(String(channel.id)) ? "checked" : ""}> ${esc(channel.name || channel.instance_name || `Canal ${channel.id}`)}</label>`).join("")}</div>
      <label style="display:flex;gap:8px;margin:16px 0 8px;font-size:13px"><input type="checkbox" data-feature-scope ${featureScopeEnabled ? "checked" : ""}> Restringir telas do CRM</label>
      <div class="iea-checks">${FEATURES.map(([key, label]) => `<label><input type="checkbox" data-feature="${key}" ${features.includes(key) || !featureScopeEnabled ? "checked" : ""}> ${label}</label>`).join("")}</div>
      <label style="display:flex;gap:8px;margin:14px 0;font-size:13px"><input type="checkbox" data-automation ${user.can_manage_automation ? "checked" : ""}> Gerenciar automaÃ§Ãµes</label>
      <button class="iea-btn iea-btn-dark" data-save-user>Salvar permissÃµes</button><span data-status style="margin-left:8px;font-size:12px"></span></article>`;
  }

  async function saveUser(card) {
    const button = card.querySelector("[data-save-user]");
    const status = card.querySelector("[data-status]");
    button.disabled = true;
    try {
      await request("/api/admin/crm-channel-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: Number(card.dataset.user),
          channel_ids: [...card.querySelectorAll("[data-channel]:checked")].map(input => Number(input.dataset.channel)),
          feature_keys: [...card.querySelectorAll("[data-feature]:checked")].map(input => input.dataset.feature),
          can_manage_automation: card.querySelector("[data-automation]").checked,
          scope_enabled: card.querySelector("[data-channel-scope]").checked || card.querySelectorAll("[data-channel]:checked").length !== card.querySelectorAll("[data-channel]").length,
          feature_scope_enabled: card.querySelector("[data-feature-scope]").checked || card.querySelectorAll("[data-feature]:checked").length !== FEATURES.length
        })
      });
      status.textContent = "Salvo";
      status.style.color = "#16834c";
    } catch (error) {
      status.textContent = error.message;
      status.style.color = "#bd2436";
    } finally {
      button.disabled = false;
    }
  }

  async function openConversationModal(contact) {
    css();
    const savedContact = contact || null;
    const title = savedContact ? "Iniciar conversa" : "Iniciar contato novo";
    const description = savedContact ? "Escolha o canal e envie a primeira mensagem." : "Cadastre o nome e o telefone do novo contato.";
    const overlay = document.createElement("div");
    overlay.className = "iea-modal-bg";
    overlay.innerHTML = `<div class="iea-modal"><h2>${esc(title)}</h2><p style="color:#718295">${esc(description)}</p><form class="iea-form">
      <label>Nome do contato<input class="iea-field" name="name" required placeholder="Nome do paciente" value="${esc(savedContact?.name || "")}"></label>
      <label>Telefone com DDD<input class="iea-field" name="phone" required inputmode="tel" placeholder="(65) 99999-9999" value="${esc(savedContact?.phone || "")}"></label>
      <label>Canal<select class="iea-field" name="channel_id" required><option value="">Selecione o nÃºmero de saÃ­da</option></select></label>
      <label>Primeira mensagem <span style="font-weight:400">(opcional)</span><textarea class="iea-field" name="text" rows="4" placeholder="Digite a mensagem ou deixe em branco para apenas abrir o atendimento"></textarea></label>
      <div style="display:flex;justify-content:flex-end;gap:9px"><button type="button" class="iea-btn" data-cancel>Cancelar</button><button class="iea-btn iea-btn-primary">${savedContact ? "Iniciar conversa" : "Criar e iniciar atendimento"}</button></div>
      <div data-error style="color:#bd2436;font-size:13px"></div>
    </form></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-cancel]").onclick = () => overlay.remove();
    overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
    const select = overlay.querySelector("[name=channel_id]");
    const errorNode = overlay.querySelector("[data-error]");
    const submitButton = overlay.querySelector("button[type=submit], button.iea-btn-primary");
    try {
      const now = Date.now();
      const channels = (channelCacheForModal && (now - channelCacheForModalAt) < CHANNEL_CACHE_TTL_MS) ? channelCacheForModal : await request("/api/crm/channels");
      if (channels !== channelCacheForModal) {
        channelCacheForModal = channels;
        channelCacheForModalAt = now;
      }
      select.innerHTML = `<option value="">Selecione o nÃºmero de saÃ­da</option>${(channels.items || [])
        .filter(item => item.active !== false && item.sync_enabled !== false)
        .map(channel => `<option value="${esc(channel.id)}">${esc(channel.display_name || channel.instance_name || `Canal ${channel.id}`)}</option>`).join("")}`;
    } catch (error) {
      errorNode.textContent = error.message;
      submitButton.disabled = true;
    }
    overlay.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const phone = String(form.get("phone") || "").replace(/\D/g, "");
      if (phone.length < 10 || phone.length > 13) {
        errorNode.textContent = "Informe DDD + nÃºmero vÃ¡lido.";
        return;
      }
      try {
        const text = String(form.get("text") || "").trim();
        submitButton.disabled = true;
        await request("/api/crm/conversations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.get("name"), phone, channel_id: Number(form.get("channel_id")), text, open_only: !text })
        });
        overlay.remove();
        window.dispatchEvent(new CustomEvent("iea:crm-conversation-created"));
      } catch (error) {
        errorNode.textContent = error.message;
        submitButton.disabled = false;
      }
    };
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function setNavFeatureVisible(nav, visible) {
    // Os itens nativos usam display:flex para manter o Ã­cone acima do rÃ³tulo.
    // Ao liberar uma tela, restaure o layout original em vez de apagÃ¡-lo.
    if (!originalNavDisplays.has(nav)) originalNavDisplays.set(nav, nav.style.display);
    nav.style.display = visible ? originalNavDisplays.get(nav) : "none";
  }

  function renderPermissions() {
    if (!permissionState) return;
    const restricted = Boolean(permissionState.feature_scope_enabled);
    const allowed = new Set(permissionState.allowed_features || []);
    const aside = observedPermissionsAside;
    if (!aside) return;
    if (!permissionNavComputed || !permissionNavCache.length || !permissionNavCache.every((item) => item.isConnected)) {
      permissionNavCache = Array.from(aside.querySelectorAll("a,button,[role=button],div"))
        .filter((item) => item.children.length <= 1)
        .map((item) => {
          item.__ieaSidebarLabel = normalize(item.textContent);
          return item;
        });
      permissionNavComputed = true;
    }
    const aliases = [
      ["inbox", "inbox"], ["fila", "queue"], ["funil", "funnel"],
      ["gestao", "management"], ["paciente", "contacts"], ["controle", "control"],
      ["campanha", "campaigns"], ["integra", "integrations"], ["config", "settings"]
    ];
    permissionNavCache.forEach((nav) => {
      const label = nav.__ieaSidebarLabel || normalize(nav.textContent);
      const featureMatches = [...new Set(aliases.filter(([name]) => label.includes(name)).map(([, feature]) => feature))];
      // Containers da barra lateral contÃ©m o texto de vÃ¡rias opÃ§Ãµes. Alterar
      // o display deles ocultaria tambÃ©m telas autorizadas; sÃ³ trate o nÃ³ que
      // representa uma Ãºnica funcionalidade.
      if (featureMatches.length === 1) {
        setNavFeatureVisible(nav, !restricted || allowed.has(featureMatches[0]));
      }
    });
  }

  function applyPermissions(force) {
    const now = Date.now();
    const stale = now - permissionStateFetchedAt > PERMISSIONS_TTL_MS;
    if (permissionState && !force && !stale) {
      renderPermissions();
      return Promise.resolve(permissionState);
    }
    if (permissionRequest) return permissionRequest;
    permissionRequest = request("/api/crm/permissions")
      .then(data => {
        permissionState = data;
        permissionStateFetchedAt = Date.now();
        renderPermissions();
        return data;
      })
      .catch(() => { 
        permissionState={feature_scope_enabled:true,allowed_features:[]};
        permissionStateFetchedAt = Date.now();
        renderPermissions();
        return permissionState;
      })
      .finally(() => { permissionRequest = null; });
    return permissionRequest;
  }

  function schedulePermissionRender() {
    clearTimeout(permissionTimer);
    permissionTimer = setTimeout(() => {
      permissionTimer = null;
      permissionNavComputed = false;
      renderPermissions();
    }, 120);
  }

  let observedPermissionsAside = null;
  const permissionObserver = new MutationObserver(schedulePermissionRender);
  function observePermissionSidebar() {
    const aside = Array.from(document.querySelectorAll("aside")).find(item => {
      const width = item.getBoundingClientRect().width;
      return width > 0 && width <= 140;
    });
    if (!aside || aside === observedPermissionsAside) return;
    permissionNavCache = [];
    permissionNavComputed = false;
    permissionObserver.disconnect();
    observedPermissionsAside = aside;
    permissionObserver.observe(aside, { childList: true, subtree: true });
    schedulePermissionRender();
    applyPermissions(true);
  }

  function normalizedLabel(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }

  function injectSettingsPermissionsButton() {
    if (activeScreen) return;
    const heading = Array.from(document.querySelectorAll("h1,h2")).find(element =>
      normalizedLabel(element.textContent) === "configuracoes" && !element.closest(".iea-ops-screen")
    );
    if (!heading || document.querySelector("[data-iea-open-permissions]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "iea-btn iea-btn-dark iea-native-settings-permissions";
    button.dataset.ieaOpenPermissions = "true";
    button.textContent = "Gerenciar permissÃµes do CRM";
    button.onclick = event => { event.preventDefault(); openSettings(); };
    const subtitle = heading.parentElement && heading.parentElement.querySelector("p");
    (subtitle || heading).insertAdjacentElement("afterend", button);
  }

  let settingsEntryTimer = null;
  function scheduleSettingsPermissionsButton() {
    if (settingsEntryTimer) return;
    settingsEntryTimer = setTimeout(() => {
      settingsEntryTimer = null;
      injectSettingsPermissionsButton();
    }, 120);
  }

  let sidebarNavigationHost = null;
  let sidebarNavigationHandler = null;
  let sidebarNavigationRebindTimer = null;

  function resolveSidebarHost() {
    return Array.from(document.querySelectorAll("aside")).find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.width > 0 && rect.width <= 160;
    });
  }

  function bindSidebarNavigation() {
    const sidebar = resolveSidebarHost();
    if (!sidebar || sidebar === sidebarNavigationHost) return;

    if (sidebarNavigationHost && sidebarNavigationHandler) {
      sidebarNavigationHost.removeEventListener("click", sidebarNavigationHandler, true);
    }

    sidebarNavigationHandler = event => {
      const target = event.target.closest("button,a,[role=button],div");
      if (!target || target.closest(".iea-modal")) return;
      if (!sidebar.contains(target)) return;

      if (target.closest("[data-iea-open-permissions]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openSettings();
        return;
      }

      const label = normalizedLabel(target.textContent);
      if (target.closest("[data-iea-patient-control]") || (label === "controle" || label.includes("controle de pacientes"))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openControl();
        return;
      }
      if (label === "funil" || label.includes("funil operacional")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openFunnel();
        return;
      }
      if (label === "pacientes" || label === "contatos" || label.includes("lista de pacientes")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openContacts();
        return;
      }
      if (label === "config" || label.startsWith("configur")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openSettings();
      }
    };

    sidebar.addEventListener("click", sidebarNavigationHandler, true);
    sidebarNavigationHost = sidebar;
  }

  const sidebarNavigationHostObserver = new MutationObserver(() => {
    if (sidebarNavigationRebindTimer) return;
    sidebarNavigationRebindTimer = setTimeout(() => {
      sidebarNavigationRebindTimer = null;
      bindSidebarNavigation();
    }, 80);
  });
  sidebarNavigationHostObserver.observe(document.body, { childList: true, subtree: true });
  bindSidebarNavigation();

  window.IEACrmOperations = { openControl, openFunnel, openContacts, closeScreen, openSettings, openConversationModal };
  css();
  applyPermissions();
  // Observa somente mudanças de âncoras da sidebar (lado da navegação).
  const permissionSidebarHostObserver = new MutationObserver((mutations) => {
    const shouldRebind = mutations.some((mutation) => {
      if (mutation.type !== "childList") return false;
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return nodes.some((node) => node instanceof Element && (node.matches("aside") || node.closest("aside"))) ||
        mutation.target instanceof Element && mutation.target.matches("aside");
    });
    if (shouldRebind) observePermissionSidebar();
  });
  permissionSidebarHostObserver.observe(document.body, { childList: true });
  observePermissionSidebar();
  injectSettingsPermissionsButton();
})();
