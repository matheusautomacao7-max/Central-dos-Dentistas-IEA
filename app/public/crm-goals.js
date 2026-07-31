(function () {
  "use strict";

  const METRICS = [
    ["first_consultations", "Primeiras consultas"],
    ["recoveries", "Recuperação de pacientes"],
    ["attendances", "Atendimentos"]
  ];
  const baseFetch = window.fetch.bind(window);
  let root = null;
  let currentData = null;
  let selectedMonth = new Date().toISOString().slice(0, 7);
  let selectedUserId = "";
  let activeTab = "progress";
  let refreshTimer = null;
  let mountScheduled = false;

  const esc = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const number = value => Number(value || 0).toLocaleString("pt-BR");
  const percent = value => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  async function request(url, options) {
    const response = await window.fetch(url, Object.assign({ credentials: "same-origin" }, options || {}));
    const type = response.headers.get("content-type") || "";
    const data = type.includes("json") ? await response.json() : { error: await response.text() };
    if (!response.ok) throw new Error(data.error || data.detail || `Erro ${response.status}`);
    return data;
  }

  function ensureStyles() {
    if (document.getElementById("iea-goals-css")) return;
    const style = document.createElement("style");
    style.id = "iea-goals-css";
    style.textContent = `
      .iea-goals-screen{position:fixed;inset:0 0 0 80px;z-index:46;background:#f3f6f8;color:#102f4d;overflow:auto;font-family:Manrope,system-ui,sans-serif}
      .iea-goals-wrap{max-width:1440px;margin:0 auto;padding:28px 32px 48px}
      .iea-goals-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:18px}
      .iea-goals-head h1{margin:0;font-size:28px}.iea-goals-head p{margin:6px 0 0;color:#66788a;font-size:14px}
      .iea-goals-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}
      .iea-goals-btn{min-height:42px;border:1px solid #d7e0e8;border-radius:10px;background:#fff;padding:9px 15px;font:800 13px Manrope,system-ui;color:#102f4d;cursor:pointer}
      .iea-goals-btn.primary{border-color:#17c964;background:#17c964;color:#fff}.iea-goals-btn:disabled{opacity:.55;cursor:wait}
      .iea-goals-field{min-height:42px;border:1px solid #d7e0e8;border-radius:10px;background:#fff;padding:9px 12px;color:#17344f;font:700 13px Manrope,system-ui}
      .iea-goals-tabs{display:flex;gap:8px;margin:0 0 18px}.iea-goals-tab{border:1px solid #d9e2e8;border-radius:999px;background:#fff;padding:9px 15px;color:#5e7284;font-weight:800;cursor:pointer}.iea-goals-tab.on{border-color:#17c964;background:#eafaf1;color:#08783c}
      .iea-goals-panel{border:1px solid #dde5eb;border-radius:16px;background:#fff;padding:20px;margin-bottom:18px}
      .iea-goals-summary{display:grid;grid-template-columns:repeat(3,minmax(230px,1fr));gap:14px;margin-bottom:18px}
      .iea-goal-card{border:1px solid #dfe7ec;border-radius:16px;background:#fff;padding:18px;min-width:0}
      .iea-goal-card.reached{border-color:#8be3ad;background:#f2fcf6}.iea-goal-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.iea-goal-title h2{font-size:16px;margin:0}.iea-goal-badge{border-radius:999px;background:#eef2f5;color:#607386;padding:5px 9px;font-size:10px;font-weight:900}.iea-goal-card.reached .iea-goal-badge{background:#dff8e9;color:#08783c}
      .iea-goal-bar{height:10px;background:#edf1f3;border-radius:999px;overflow:hidden;margin:17px 0}.iea-goal-bar>i{display:block;height:100%;border-radius:inherit;background:#17c964;transition:width .35s ease}
      .iea-goal-values{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.iea-goal-values small{display:block;color:#7b8c9a;font-size:10px;text-transform:uppercase;font-weight:800}.iea-goal-values strong{display:block;margin-top:4px;font-size:19px}
      .iea-goal-pace{margin:15px 0 0;padding-top:13px;border-top:1px solid #edf1f3;color:#607386;font-size:12px;line-height:1.5}.iea-goal-pace b{color:#102f4d}
      .iea-goals-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.iea-conversion{display:flex;align-items:center;justify-content:space-between;gap:18px}.iea-conversion h3{margin:0 0 5px;font-size:15px}.iea-conversion p{margin:0;color:#718295;font-size:12px}.iea-conversion strong{font-size:30px;color:#08783c}
      .iea-daily-table{width:100%;border-collapse:collapse}.iea-daily-table th,.iea-daily-table td{padding:13px 10px;border-bottom:1px solid #e8edf1;text-align:left;font-size:13px}.iea-daily-table th{color:#718295;font-size:10px;text-transform:uppercase}.iea-daily-table tr:last-child td{border-bottom:0}
      .iea-goals-config{display:grid;gap:14px}.iea-config-card{border:1px solid #dfe7ec;border-radius:14px;padding:17px}.iea-config-card h3{margin:0 0 13px;font-size:15px}.iea-config-grid{display:grid;grid-template-columns:160px 160px minmax(230px,1fr) auto;gap:12px;align-items:end}.iea-config-grid label{display:block;color:#607386;font-size:11px;font-weight:800}.iea-config-grid label .iea-goals-field{width:100%;margin-top:6px}.iea-goals-check{display:flex!important;align-items:center;gap:8px;min-height:42px;color:#17344f!important}.iea-goals-check input{width:18px;height:18px}
      .iea-history{display:grid;gap:10px}.iea-history-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:12px 0;border-bottom:1px solid #edf1f3}.iea-history-row:last-child{border:0}.iea-history-row p{margin:0;font-weight:750;font-size:13px}.iea-history-row small{color:#788a98}
      .iea-goals-empty,.iea-goals-error{padding:32px;text-align:center;color:#718295}.iea-goals-error{color:#bd2436;background:#fff1f1;border-radius:13px}
      .iea-celebration{position:fixed;left:50%;bottom:28px;z-index:260;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));border:1px solid #8be3ad;border-radius:18px;background:#fff;padding:19px 54px 19px 20px;box-shadow:0 20px 60px rgba(7,45,30,.25);color:#123b2a}
      .iea-celebration h2{margin:0 0 6px;font-size:20px}.iea-celebration p{margin:4px 0;font-size:13px;line-height:1.45}.iea-celebration button{position:absolute;right:14px;top:14px;border:0;border-radius:50%;width:30px;height:30px;background:#edf7f1;color:#175c39;cursor:pointer;font-size:18px}
      .iea-confetti{position:fixed;inset:0;z-index:255;pointer-events:none;overflow:hidden}.iea-confetti i{position:absolute;top:-20px;width:9px;height:15px;background:var(--color);left:var(--left);animation:iea-confetti-fall var(--duration) cubic-bezier(.15,.65,.35,1) forwards;animation-delay:var(--delay);transform:rotate(var(--rotate))}
      @keyframes iea-confetti-fall{to{transform:translate3d(var(--drift),105vh,0) rotate(760deg);opacity:.9}}
      @media(prefers-reduced-motion:reduce){.iea-goal-bar>i{transition:none}.iea-confetti{display:none}}
      @media(max-width:1050px){.iea-goals-summary{grid-template-columns:1fr}.iea-config-grid{grid-template-columns:1fr 1fr}.iea-config-grid label:nth-child(3){grid-column:1/-1}}
      @media(max-width:720px){.iea-goals-screen{left:0}.iea-goals-wrap{padding:20px 14px 36px}.iea-goals-head{flex-direction:column}.iea-goals-actions{justify-content:flex-start}.iea-goals-two{grid-template-columns:1fr}.iea-goal-values{grid-template-columns:1fr 1fr}.iea-config-grid{grid-template-columns:1fr}.iea-config-grid label:nth-child(3){grid-column:auto}.iea-daily-table{min-width:620px}.iea-goals-panel.table-scroll{overflow:auto}}
    `;
    document.head.appendChild(style);
  }

  function closeGoals() {
    if (root) root.remove();
    root = null;
    currentData = null;
    clearInterval(refreshTimer);
    refreshTimer = null;
    const link = document.querySelector("[data-iea-goals-nav]");
    if (link) link.style.background = "transparent";
  }

  function openGoals() {
    ensureStyles();
    if (window.IEACrmOperations && window.IEACrmOperations.closeScreen) window.IEACrmOperations.closeScreen();
    closeGoals();
    root = document.createElement("section");
    root.className = "iea-goals-screen";
    root.setAttribute("aria-label", "Metas individuais do CRC");
    document.body.appendChild(root);
    const link = document.querySelector("[data-iea-goals-nav]");
    if (link) link.style.background = "rgba(255,255,255,.16)";
    loadGoals();
    refreshTimer = window.setInterval(() => {
      if (root && !document.hidden && activeTab === "progress") loadGoals(true);
    }, 15000);
  }

  async function loadGoals(silent) {
    if (!root) return;
    if (!silent) root.innerHTML = `<div class="iea-goals-wrap"><div class="iea-goals-panel">Carregando metas...</div></div>`;
    const params = new URLSearchParams({ month: selectedMonth });
    if (selectedUserId) params.set("user_id", selectedUserId);
    try {
      currentData = await request(`/api/crm/goals?${params}`);
      selectedUserId = String((currentData.user || {}).id || selectedUserId || "");
      render();
    } catch (error) {
      root.innerHTML = `<div class="iea-goals-wrap"><div class="iea-goals-error">${esc(error.message)}</div><button class="iea-goals-btn" data-close style="margin-top:12px">Voltar</button></div>`;
      root.querySelector("[data-close]").onclick = closeGoals;
    }
  }

  function render() {
    if (!root || !currentData) return;
    const agents = currentData.agents || [];
    const agentPicker = currentData.can_configure ? `<select class="iea-goals-field" data-agent aria-label="Atendente">${agents.map(agent => `<option value="${Number(agent.id)}"${String(agent.id) === selectedUserId ? " selected" : ""}>${esc(agent.name)}</option>`).join("")}</select>` : "";
    root.innerHTML = `<div class="iea-goals-wrap">
      <header class="iea-goals-head"><div><h1>Metas individuais</h1><p>${esc((currentData.user || {}).name)} · ${esc(currentData.month_label)}</p></div><div class="iea-goals-actions">
        ${agentPicker}<input class="iea-goals-field" data-month type="month" value="${esc(selectedMonth)}" aria-label="Mês das metas"><button class="iea-goals-btn" data-close>Voltar</button>
      </div></header>
      <nav class="iea-goals-tabs" aria-label="Seções de metas"><button class="iea-goals-tab ${activeTab === "progress" ? "on" : ""}" data-tab="progress">Acompanhamento</button>${currentData.can_configure ? `<button class="iea-goals-tab ${activeTab === "config" ? "on" : ""}" data-tab="config">Configuração</button>` : ""}</nav>
      <main data-content>${activeTab === "config" ? configMarkup() : progressMarkup()}</main>
    </div>`;
    bindCommon();
    if (activeTab === "config") bindConfig();
  }

  function progressMarkup() {
    const items = currentData.items || [];
    const cards = items.map(item => {
      const m = item.monthly || {};
      const width = Math.min(100, Number(m.percentage || 0));
      const pace = m.reached ? "Meta mensal atingida" : m.target ? `<b>${number(m.required_per_open_day)}</b> por dia de expediente para fechar o gap` : "Meta mensal ainda não configurada";
      return `<article class="iea-goal-card ${m.reached ? "reached" : ""}"><div class="iea-goal-title"><h2>${esc(item.label)}</h2><span class="iea-goal-badge">${m.reached ? "Meta atingida" : "Em andamento"}</span></div><div class="iea-goal-bar" aria-label="${esc(item.label)}: ${percent(m.percentage)}"><i style="width:${width}%"></i></div><div class="iea-goal-values">
        <div><small>Meta</small><strong>${number(m.target)}</strong></div><div><small>Realizado</small><strong>${number(m.realized)}</strong></div><div><small>% realizada</small><strong>${percent(m.percentage)}</strong></div><div><small>Gap</small><strong>${number(m.gap)}</strong></div>
      </div><p class="iea-goal-pace">${pace}</p></article>`;
    }).join("");
    const conversions = currentData.conversion || {};
    const first = conversions.first_consultation || {};
    const recurring = conversions.recurring || {};
    const schedule = currentData.schedule || {};
    return `<section class="iea-goals-summary">${cards}</section>
      <section class="iea-goals-two" style="margin-bottom:18px"><article class="iea-goals-panel iea-conversion"><div><h3>Conversão · Primeira consulta</h3><p>${number(first.converted)} agendamentos em ${number(first.opportunities)} oportunidades</p></div><strong>${percent(first.percentage)}</strong></article><article class="iea-goals-panel iea-conversion"><div><h3>Conversão · Cliente recorrente</h3><p>${number(recurring.converted)} agendamentos em ${number(recurring.opportunities)} retornos sem tratamento</p></div><strong>${percent(recurring.percentage)}</strong></article></section>
      <section class="iea-goals-panel table-scroll"><div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:10px"><div><h2 style="margin:0;font-size:18px">Meta do dia</h2><p style="margin:5px 0 0;color:#718295;font-size:12px">${esc(schedule.weekdays)} · ${esc(schedule.saturday)}</p></div><span class="iea-goal-badge">${number(schedule.remaining_open_days)} dias de expediente restantes</span></div><table class="iea-daily-table"><thead><tr><th>Indicador</th><th>Meta</th><th>Realizado</th><th>% realizada</th><th>Faltam</th><th>Situação</th></tr></thead><tbody>${items.map(item => { const d = item.daily || {}; return `<tr><td><b>${esc(item.label)}</b></td><td>${number(d.target)}</td><td>${number(d.realized)}</td><td>${percent(d.percentage)}</td><td>${number(d.gap)}</td><td>${d.reached ? "Meta atingida" : d.target ? "Em andamento" : "Não configurada"}</td></tr>`; }).join("")}</tbody></table></section>
      <section class="iea-goals-panel"><h2 style="margin:0 0 13px;font-size:18px">Conquistas recentes</h2><div class="iea-history">${(currentData.history || []).length ? currentData.history.map(row => `<div class="iea-history-row"><div><p>${esc(row.message)}</p><small>${row.achievement_type === "daily" ? "Meta diária" : "Meta mensal"} · ${esc(row.period_key)}</small></div><small>${esc(row.achieved_at)}</small></div>`).join("") : `<div class="iea-goals-empty">As metas alcançadas aparecerão aqui.</div>`}</div></section>`;
  }

  function configMarkup() {
    const cards = (currentData.items || []).map(item => `<article class="iea-config-card" data-metric="${esc(item.metric_key)}"><h3>${esc(item.label)}</h3><div class="iea-config-grid">
      <label>Meta do mês<input class="iea-goals-field" data-monthly type="number" min="0" max="100000" step="1" value="${Number((item.monthly || {}).target || 0)}"></label>
      <label>Meta por dia<input class="iea-goals-field" data-daily type="number" min="0" max="10000" step="1" value="${Number((item.daily || {}).target || 0)}"></label>
      <label>Mensagem personalizada<input class="iea-goals-field" data-message maxlength="180" value="${esc(item.celebration_message || "")}" placeholder="Opcional; o CRM inclui o resultado alcançado"></label>
      <label class="iea-goals-check"><input data-celebration type="checkbox" ${item.celebration_enabled ? "checked" : ""}> Comemorar</label>
    </div></article>`).join("");
    return `<section class="iea-goals-panel"><div style="display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:16px"><div><h2 style="margin:0;font-size:18px">Configurar ${esc(currentData.month_label)}</h2><p style="margin:5px 0 0;color:#718295;font-size:12px">Metas individuais de ${esc((currentData.user || {}).name)}. Zero desativa o indicador.</p></div><button class="iea-goals-btn primary" data-save>Salvar metas</button></div><div class="iea-goals-config">${cards}</div><div data-save-status role="status" style="margin-top:13px;font-size:13px"></div></section>`;
  }

  function bindCommon() {
    root.querySelector("[data-close]").onclick = closeGoals;
    root.querySelector("[data-month]").onchange = event => { selectedMonth = event.target.value; loadGoals(); };
    const agent = root.querySelector("[data-agent]");
    if (agent) agent.onchange = event => { selectedUserId = event.target.value; loadGoals(); };
    root.querySelectorAll("[data-tab]").forEach(button => {
      button.onclick = () => { activeTab = button.dataset.tab; render(); };
    });
  }

  function bindConfig() {
    const button = root.querySelector("[data-save]");
    button.onclick = async () => {
      const status = root.querySelector("[data-save-status]");
      const goals = {};
      root.querySelectorAll("[data-metric]").forEach(card => {
        goals[card.dataset.metric] = {
          monthly_target: Number(card.querySelector("[data-monthly]").value || 0),
          daily_target: Number(card.querySelector("[data-daily]").value || 0),
          celebration_enabled: card.querySelector("[data-celebration]").checked,
          celebration_message: card.querySelector("[data-message]").value.trim()
        };
      });
      button.disabled = true;
      status.textContent = "Salvando...";
      status.style.color = "#607386";
      try {
        currentData = await request("/api/crm/goals", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: selectedMonth, user_id: Number(selectedUserId), goals })
        });
        status.textContent = "Metas salvas com sucesso.";
        status.style.color = "#08783c";
        window.setTimeout(render, 500);
      } catch (error) {
        status.textContent = error.message;
        status.style.color = "#bd2436";
      } finally {
        button.disabled = false;
      }
    };
  }

  function celebrate(achievements) {
    if (!Array.isArray(achievements) || !achievements.length) return;
    document.querySelectorAll(".iea-celebration,.iea-confetti").forEach(item => item.remove());
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const colors = ["#17c964", "#f5a524", "#5b8def", "#e8557a", "#7c5cff"];
      const confetti = document.createElement("div");
      confetti.className = "iea-confetti";
      confetti.setAttribute("aria-hidden", "true");
      for (let index = 0; index < 72; index++) {
        const particle = document.createElement("i");
        particle.style.cssText = `--left:${Math.random() * 100}%;--drift:${(Math.random() - .5) * 240}px;--duration:${2.2 + Math.random() * 1.5}s;--delay:${Math.random() * .45}s;--rotate:${Math.random() * 180}deg;--color:${colors[index % colors.length]}`;
        confetti.appendChild(particle);
      }
      document.body.appendChild(confetti);
      window.setTimeout(() => confetti.remove(), 4300);
    }
    const notice = document.createElement("section");
    notice.className = "iea-celebration";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "assertive");
    notice.innerHTML = `<button type="button" aria-label="Fechar">×</button><h2>🎉 Meta alcançada!</h2>${achievements.map(item => `<p>${esc(item.message)}</p>`).join("")}`;
    notice.querySelector("button").onclick = () => notice.remove();
    document.body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 9000);
  }

  window.fetch = async function (input, init) {
    const response = await baseFetch(input, init);
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if ((/\/api\/crm\/conversations\/\d+\/resolve(?:\?|$)/.test(url) || (url.includes("/api/crm/goals") && method === "POST")) && response.ok) {
      response.clone().json().then(data => {
        celebrate(data.achievements || []);
        if (root && activeTab === "progress") loadGoals(true);
      }).catch(() => {});
    }
    return response;
  };

  function mountNavigation() {
    if (document.querySelector("[data-iea-goals-nav]")) return;
    const management = Array.from(document.querySelectorAll("aside div,aside span"))
      .find(element => /^Gestão$/i.test((element.textContent || "").trim()));
    const aside = (management && management.closest("aside")) || Array.from(document.querySelectorAll("aside"))
      .find(element => {
        const width = element.getBoundingClientRect().width;
        return width > 0 && width <= 120;
      });
    if (!aside) return;
    const item = document.createElement("a");
    item.dataset.ieaGoalsNav = "1";
    item.href = "/central-crc/whatsapp?screen=goals";
    item.title = "Metas";
    item.style.cssText = "width:56px;min-height:58px;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(255,255,255,.72);text-decoration:none;font:700 9.5px Manrope,system-ui,sans-serif;gap:5px;margin:2px 0";
    item.innerHTML = '<svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle><path d="m15 9 5-5"></path></svg><span>Metas</span>';
    item.onmouseenter = () => { if (!root) item.style.background = "rgba(255,255,255,.08)"; };
    item.onmouseleave = () => { if (!root) item.style.background = "transparent"; };
    item.onclick = event => { event.preventDefault(); event.stopPropagation(); openGoals(); };
    const managementItem = management && management.closest("a,button,[role=button],div");
    if (managementItem && managementItem.parentElement === aside) managementItem.insertAdjacentElement("afterend", item);
    else {
      const spacer = Array.from(aside.children).find(child => getComputedStyle(child).flexGrow === "1");
      aside.insertBefore(item, spacer || null);
    }
  }

  function scheduleMount() {
    if (mountScheduled) return;
    mountScheduled = true;
    window.requestAnimationFrame(() => { mountScheduled = false; ensureStyles(); mountNavigation(); });
  }

  ensureStyles();
  mountNavigation();
  document.addEventListener("click", event => {
    if (root && event.target.closest("aside") && !event.target.closest("[data-iea-goals-nav]")) closeGoals();
  }, true);
  new MutationObserver(scheduleMount).observe(document.documentElement, { childList: true, subtree: true });
  if (new URLSearchParams(location.search).get("screen") === "goals") {
    const timer = window.setInterval(() => {
      mountNavigation();
      if (document.querySelector("[data-iea-goals-nav]")) { clearInterval(timer); openGoals(); }
    }, 120);
    window.setTimeout(() => clearInterval(timer), 10000);
  }
  window.IEACrmGoals = { open: openGoals, close: closeGoals, celebrate };
})();
