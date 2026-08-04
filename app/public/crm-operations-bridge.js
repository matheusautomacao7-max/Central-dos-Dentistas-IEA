(function () {
  "use strict";

  const FEATURES = [
    ["inbox", "Inbox"], ["queue", "Filas"], ["funnel", "Funil"],
    ["management", "Gestão"], ["contacts", "Pacientes"],
    ["campaigns", "Campanhas"], ["integrations", "Integrações"],
    ["settings", "Configuração"]
  ];
  let activeScreen = null;
  let permissionState = null;
  let permissionRequest = null;
  let permissionTimer = null;
  const originalNavDisplays = new WeakMap();

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
      .iea-btn{border:1px solid #d7e0e8;border-radius:10px;background:#fff;padding:11px 16px;font-weight:800;color:#102f4d;cursor:pointer}
      .iea-btn-primary{background:#17c964;color:#fff;border-color:#17c964}.iea-btn-dark{background:#102f4d;color:#fff}
      .iea-panel{background:#fff;border:1px solid #dde5eb;border-radius:16px;padding:20px;margin-bottom:18px}
      .iea-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
      .iea-stat{background:#fff;border:1px solid #dde5eb;border-radius:14px;padding:17px}.iea-stat small{color:#718295}.iea-stat strong{display:block;font-size:25px;margin-top:5px}
      .iea-filters{display:grid;grid-template-columns:2fr repeat(3,minmax(150px,1fr));gap:10px}
      .iea-field{width:100%;box-sizing:border-box;border:1px solid #d8e1e8;border-radius:10px;padding:11px 12px;background:#fff;color:#17344f;font-size:14px}
      .iea-table{width:100%;border-collapse:collapse}.iea-table th,.iea-table td{padding:13px 10px;border-bottom:1px solid #e7edf1;text-align:left;font-size:13px}.iea-table th{color:#718295;font-size:11px;text-transform:uppercase}
      .iea-user{border:1px solid #dce5eb;border-radius:14px;padding:16px;background:#fff}.iea-user h3{margin:0 0 4px}.iea-user small{color:#718295}
      .iea-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:13px}.iea-checks label{display:flex;gap:8px;align-items:center;font-size:13px}
      .iea-modal-bg{position:fixed;inset:0;z-index:100;background:rgba(8,26,42,.54);display:grid;place-items:center;padding:20px}
      .iea-modal{width:min(560px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.25)}
      .iea-modal h2{margin:0 0 5px}.iea-form{display:grid;gap:13px;margin-top:20px}.iea-form label{font-size:12px;font-weight:800;color:#607488}.iea-form label .iea-field{margin-top:6px}
      body[data-omtheme='dark'] .iea-ops-screen{background:#0b141a;color:#e9edef}body[data-omtheme='dark'] .iea-panel,body[data-omtheme='dark'] .iea-stat,body[data-omtheme='dark'] .iea-user,body[data-omtheme='dark'] .iea-modal{border-color:#2a3942;background:#111b21;color:#e9edef}body[data-omtheme='dark'] .iea-field,body[data-omtheme='dark'] .iea-btn{border-color:#2a3942;background:#182229;color:#e9edef}body[data-omtheme='dark'] .iea-btn-primary{border-color:#17c964;background:#17c964;color:#fff}body[data-omtheme='dark'] .iea-btn-dark{border-color:#31516b;background:#183653;color:#fff}body[data-omtheme='dark'] .iea-ops-head p,body[data-omtheme='dark'] .iea-stat small,body[data-omtheme='dark'] .iea-user small,body[data-omtheme='dark'] .iea-form label,body[data-omtheme='dark'] .iea-table th{color:#9aa9b2}body[data-omtheme='dark'] .iea-table th,body[data-omtheme='dark'] .iea-table td{border-color:#2a3942}
      @media(max-width:900px){.iea-ops-screen{left:74px;padding:20px 16px}.iea-filters{grid-template-columns:1fr}.iea-checks{grid-template-columns:1fr}}
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
    const body = screen("Controle de pacientes", "Atendimentos finalizados, métricas e exportação em uma tela nativa do CRM.");
    const url = new URL(window.location.href);
    url.searchParams.set("screen", "patient-control");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    body.innerHTML = `<div class="iea-panel"><div class="iea-filters">
      <input class="iea-field" data-search placeholder="Buscar paciente ou telefone">
      <select class="iea-field" data-period><option value="30d">Últimos 30 dias</option><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option></select>
      <select class="iea-field" data-category><option value="">Todas as categorias</option></select>
      <select class="iea-field" data-outcome><option value="">Todos os resultados</option></select>
    </div></div><div data-results><div class="iea-panel">Carregando atendimentos...</div></div>`;
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
        // A tela antiga procurava `items`, então exibia zero linhas mesmo
        // depois de a finalização ter sido persistida corretamente.
        const items = data.rows || data.items || [];
        const filterData = data.filters || {};
        fillOptions(body.querySelector("[data-category]"), filterData.categories || [], category);
        fillOptions(body.querySelector("[data-outcome]"), filterData.outcomes || [], outcome);
        body.querySelector("[data-results]").innerHTML = `<div class="iea-grid" style="margin-bottom:18px">
          ${stat("Atendimentos", summary.total)}${stat("Agendamentos", summary.scheduled)}
          ${stat("Com participação da IA", summary.ai_involved)}${stat("Finalizados por humano", summary.human_finalized)}
        </div><div class="iea-panel" style="overflow:auto"><table class="iea-table"><thead><tr><th>Paciente</th><th>Finalizado em</th><th>Atendente</th><th>Categoria</th><th>Resultado</th><th>Agendamento</th><th>Canal</th><th>Profissional</th></tr></thead><tbody>
          ${items.length ? items.map(row => {
            const scheduled = [row.scheduled_date, row.scheduled_time].filter(Boolean).join(" · ") || row.scheduled_at || "-";
            return `<tr><td><b>${esc(row.contact_name || row.patient_name || row.name)}</b><br><small>${esc(row.phone)}</small></td><td>${esc(row.resolved_at || row.finished_at)}</td><td>${esc(row.resolved_by_name || row.agent_name || row.attendant_name)}</td><td>${esc(row.category)}</td><td>${esc(row.outcome || row.result)}</td><td>${esc(scheduled)}</td><td>${esc(row.channel_name || row.channel)}</td><td>${esc(row.responsible_professional || row.professional_name || "-")}</td></tr>`;
          }).join("") : `<tr><td colspan="8" style="text-align:center;padding:35px;color:#718295">Nenhum atendimento corresponde aos filtros.</td></tr>`}
        </tbody></table></div>`;
      } catch (error) {
        body.querySelector("[data-results]").innerHTML = `<div class="iea-panel" style="color:#bd2436">${esc(error.message)}</div>`;
      }
    };
    let timer;
    body.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 250); });
    body.addEventListener("change", load);
    load();
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

  async function openSettings() {
    const body = screen("Configuração e permissões", "Controle quais módulos e canais cada pessoa pode visualizar no CRM.");
    body.innerHTML = `<div class="iea-panel">Carregando usuários e permissões...</div>`;
    try {
      const data = await request("/api/admin/crm-channel-access");
      body.innerHTML = `<div class="iea-grid">${(data.users || []).map(user => userCard(user, data.channels || [])).join("")}</div>`;
      body.querySelectorAll("[data-save-user]").forEach(button => {
        button.onclick = () => saveUser(button.closest("[data-user]"));
      });
    } catch (error) {
      body.innerHTML = `<div class="iea-panel"><h3>Acesso restrito</h3><p>${esc(error.message)}</p><p>Somente o administrador do CRM ou o administrador geral pode alterar essas permissões.</p></div>`;
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
      return `<article class="iea-user" data-user="${Number(user.id)}"><h3>${esc(user.name)}</h3><small>${esc(user.email)} · ${esc(level)}</small><div class="iea-panel" style="margin-top:14px"><strong>Acesso total ao CRM</strong><p style="margin-bottom:0">Pode configurar metas e permissões. Este grau é alterado no cadastro do profissional.</p></div></article>`;
    }
    return `<article class="iea-user" data-user="${Number(user.id)}"><h3>${esc(user.name)}</h3><small>${esc(user.email)} · ${esc(level)}</small>
      <label style="display:flex;gap:8px;margin:14px 0 8px;font-size:13px"><input type="checkbox" data-channel-scope ${user.crm_channel_scope_enabled ? "checked" : ""}> Restringir aos canais selecionados</label>
      <div class="iea-checks">${channels.map(channel => `<label><input type="checkbox" data-channel="${Number(channel.id)}" ${selectedChannels.has(String(channel.id)) ? "checked" : ""}> ${esc(channel.name || channel.instance_name || `Canal ${channel.id}`)}</label>`).join("")}</div>
      <label style="display:flex;gap:8px;margin:16px 0 8px;font-size:13px"><input type="checkbox" data-feature-scope ${featureScopeEnabled ? "checked" : ""}> Personalizar telas disponíveis</label>
      <div class="iea-checks">${FEATURES.map(([key, label]) => `<label><input type="checkbox" data-feature="${key}" ${features.includes(key) || !featureScopeEnabled ? "checked" : ""}> ${label}</label>`).join("")}</div>
      <label style="display:flex;gap:8px;margin:14px 0;font-size:13px"><input type="checkbox" data-automation ${user.can_manage_automation ? "checked" : ""}> Gerenciar automações</label>
      <button class="iea-btn iea-btn-dark" data-save-user>Salvar permissões</button><span data-status style="margin-left:8px;font-size:12px"></span></article>`;
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
          scope_enabled: card.querySelector("[data-channel-scope]").checked,
          feature_scope_enabled: card.querySelector("[data-feature-scope]").checked
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

  async function openConversationModal() {
    css();
    const overlay = document.createElement("div");
    overlay.className = "iea-modal-bg";
    overlay.innerHTML = `<div class="iea-modal"><h2>Iniciar conversa</h2><p style="color:#718295">Informe um número real com DDD.</p><form class="iea-form">
      <label>Nome do contato<input class="iea-field" name="name" required placeholder="Nome do paciente"></label>
      <label>Telefone com DDD<input class="iea-field" name="phone" required inputmode="tel" placeholder="(65) 99999-9999"></label>
      <label>Canal<select class="iea-field" name="channel_id" required><option value="">Selecione o número de saída</option></select></label>
      <label>Primeira mensagem<textarea class="iea-field" name="text" rows="4" required placeholder="Digite a mensagem"></textarea></label>
      <div style="display:flex;justify-content:flex-end;gap:9px"><button type="button" class="iea-btn" data-cancel>Cancelar</button><button class="iea-btn iea-btn-primary">Iniciar conversa</button></div>
      <div data-error style="color:#bd2436;font-size:13px"></div>
    </form></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-cancel]").onclick = () => overlay.remove();
    overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };
    try {
      const channels = await request("/api/crm/channels");
      const select = overlay.querySelector("[name=channel_id]");
      (channels.items || []).filter(item => item.active !== false && item.sync_enabled !== false).forEach(channel => {
        select.add(new Option(channel.display_name || channel.instance_name, channel.id));
      });
    } catch (error) {
      overlay.querySelector("[data-error]").textContent = error.message;
    }
    overlay.querySelector("form").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const phone = String(form.get("phone") || "").replace(/\D/g, "");
      if (phone.length < 10 || phone.length > 13) {
        overlay.querySelector("[data-error]").textContent = "Informe DDD + número válido.";
        return;
      }
      try {
        await request("/api/crm/conversations", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.get("name"), phone, channel_id: Number(form.get("channel_id")), text: form.get("text") })
        });
        overlay.remove();
        window.dispatchEvent(new CustomEvent("iea:crm-conversation-created"));
      } catch (error) {
        overlay.querySelector("[data-error]").textContent = error.message;
      }
    };
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function setNavFeatureVisible(nav, visible) {
    // Os itens nativos usam display:flex para manter o ícone acima do rótulo.
    // Ao liberar uma tela, restaure o layout original em vez de apagá-lo.
    if (!originalNavDisplays.has(nav)) originalNavDisplays.set(nav, nav.style.display);
    nav.style.display = visible ? originalNavDisplays.get(nav) : "none";
  }

  function renderPermissions() {
    if (!permissionState) return;
    const restricted = Boolean(permissionState.feature_scope_enabled);
    const allowed = new Set(permissionState.allowed_features || []);
    const aliases = [
      ["inbox", "inbox"], ["fila", "queue"], ["funil", "funnel"],
      ["gestao", "management"], ["paciente", "contacts"], ["controle", "contacts"],
      ["campanha", "campaigns"], ["integra", "integrations"], ["config", "settings"]
    ];
    document.querySelectorAll("aside a,aside button,aside [role=button],aside div").forEach(nav => {
      const label = normalize(nav.textContent);
      const featureMatches = [...new Set(aliases.filter(([name]) => label.includes(name)).map(([, feature]) => feature))];
      // Containers da barra lateral contêm o texto de várias opções. Alterar
      // o display deles ocultaria também telas autorizadas; só trate o nó que
      // representa uma única funcionalidade.
      if (featureMatches.length === 1) {
        setNavFeatureVisible(nav, !restricted || allowed.has(featureMatches[0]));
      }
    });
  }

  function applyPermissions(force) {
    if (permissionState && !force) {
      renderPermissions();
      return Promise.resolve(permissionState);
    }
    if (permissionRequest) return permissionRequest;
    permissionRequest = request("/api/crm/permissions")
      .then(data => {
        permissionState = data;
        renderPermissions();
        return data;
      })
      .catch(() => { permissionState={feature_scope_enabled:true,allowed_features:[]};renderPermissions();return permissionState; })
      .finally(() => { permissionRequest = null; });
    return permissionRequest;
  }

  function schedulePermissionRender() {
    clearTimeout(permissionTimer);
    permissionTimer = setTimeout(renderPermissions, 80);
  }

  let observedPermissionsAside = null;
  const permissionObserver = new MutationObserver(schedulePermissionRender);
  function observePermissionSidebar() {
    const aside = Array.from(document.querySelectorAll("aside")).find(item => {
      const width = item.getBoundingClientRect().width;
      return width > 0 && width <= 140;
    });
    if (!aside || aside === observedPermissionsAside) return;
    permissionObserver.disconnect();
    observedPermissionsAside = aside;
    permissionObserver.observe(aside, { childList: true, subtree: true });
    schedulePermissionRender();
  }

  function normalizedLabel(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isSidebarTarget(target) {
    const sidebar = target.closest("aside,[class*='sidebar'],[class*='side-bar']");
    if (!sidebar) return false;
    const width = sidebar.getBoundingClientRect().width;
    return width > 0 && width <= 140;
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("button,a,[role=button]");
    if (!target) return;
    // Buttons inside our own modal must keep their native form behaviour.
    // Without this guard, the submit button "Iniciar conversa" is intercepted
    // below and opens a second modal instead of sending the form.
    if (target.closest(".iea-modal")) return;
    const label = normalizedLabel(target.textContent);
    if (target.closest("[data-iea-patient-control]") ||
        (isSidebarTarget(target) && (label === "controle" || label.includes("controle de pacientes")))) {
      event.preventDefault(); event.stopImmediatePropagation(); openControl(); return;
    }
    if (isSidebarTarget(target) && (label === "config" || label.startsWith("configur"))) {
      event.preventDefault(); event.stopImmediatePropagation(); openSettings();
    }
  }, true);

  window.IEACrmOperations = { openControl, closeScreen, openSettings, openConversationModal };
  css();
  applyPermissions();
  new MutationObserver(observePermissionSidebar).observe(document.body, { childList: true });
  observePermissionSidebar();
})();
