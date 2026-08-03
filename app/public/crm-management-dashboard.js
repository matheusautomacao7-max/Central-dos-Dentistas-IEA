(function () {
  "use strict";

  if (window.__IEA_CRM_MANAGEMENT_DASHBOARD_INSTALLED__) return;
  window.__IEA_CRM_MANAGEMENT_DASHBOARD_INSTALLED__ = true;

  const escapeHtml = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const number = value => Number(value || 0);
  let mountScheduled = false;

  async function request(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function managementRoot() {
    const heading = Array.from(document.querySelectorAll("h1,h2")).find(element =>
      /^Visão do gestor$/i.test((element.textContent || "").trim())
    );
    if (!heading) return null;
    let root = heading;
    for (let level = 0; root && level < 7; level += 1, root = root.parentElement) {
      const style = String(root.getAttribute("style") || "");
      if (/overflow-y\s*:\s*auto/i.test(style)) return root;
    }
    return heading.parentElement && heading.parentElement.parentElement;
  }

  function monthRange() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const pad = value => String(value).padStart(2, "0");
    const iso = value => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    return { start: iso(first), end: iso(now) };
  }

  function query(root) {
    const period = root.querySelector("[data-management-period]").value;
    const channel = root.querySelector("[data-management-channel]").value;
    const params = new URLSearchParams();
    if (period === "month") {
      const range = monthRange();
      params.set("period", "custom");
      params.set("start", range.start);
      params.set("end", range.end);
    } else {
      params.set("period", period);
    }
    if (channel) params.set("channel_id", channel);
    return params;
  }

  function formatMinutes(value) {
    const minutes = number(value);
    if (minutes < 60) return `${minutes.toFixed(minutes % 1 ? 1 : 0)} min`;
    return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}min`;
  }

  function metricCard(label, value, detail, accent) {
    return `<article class="iea-management-card" style="--accent:${accent}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail)}</span></article>`;
  }

  function renderDashboard(root, data) {
    const summary = data.summary || {};
    const totalMovement = number(summary.active) + number(summary.resolved_today);
    const resolutionShare = totalMovement ? Math.round(number(summary.resolved_today) / totalMovement * 100) : 0;
    root.__ieaManagementRows = data.agents || [];
    root.querySelector("[data-management-kpis]").innerHTML = [
      metricCard("Conversas ativas", number(summary.active), `${number(summary.in_service)} em atendimento`, "#2563eb"),
      metricCard("Na fila agora", number(summary.waiting), number(summary.waiting) ? "Aguardando atendimento" : "Fila em dia", number(summary.waiting) ? "#f59e0b" : "#16a34a"),
      metricCard("Mensagens não lidas", number(summary.unread_messages), `${number(summary.unread)} conversa(s)`, number(summary.unread_messages) ? "#ef4444" : "#16a34a"),
      metricCard("Resolvidas", number(summary.resolved_today), `${resolutionShare}% do movimento`, "#16a34a"),
      metricCard("1ª resposta média", formatMinutes(summary.avg_first_response_minutes), "Tempo até o primeiro atendimento", "#7c3aed"),
      metricCard("Resolução média", formatMinutes(summary.avg_resolution_minutes), "Tempo do atendimento", "#0f766e"),
    ].join("");

    const volume = data.volume || [];
    const max = Math.max(1, ...volume.map(item => number(item.total)));
    root.querySelector("[data-management-volume]").innerHTML = volume.length
      ? volume.map(item => {
          const height = Math.max(4, Math.round(number(item.total) / max * 100));
          return `<div class="iea-management-bar"><b title="${number(item.total)} recebida(s)" style="height:${height}%"></b><strong>${number(item.total)}</strong><span>${escapeHtml(item.label || item.bucket)}</span></div>`;
        }).join("")
      : `<div class="iea-management-empty">Nenhuma mensagem recebida neste período.</div>`;

    const agents = data.agents || [];
    root.querySelector("[data-management-agents]").innerHTML = agents.length
      ? agents.map(agent => {
          const initials = String(agent.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
          const active = number(agent.active);
          return `<tr><td><div class="iea-management-agent"><i>${escapeHtml(initials)}</i><div><b>${escapeHtml(agent.name)}</b><small>${escapeHtml(agent.service_sector || "CRC")}</small></div></div></td><td><span class="iea-management-status ${active ? "busy" : "available"}">${active ? "Em atendimento" : "Disponível"}</span></td><td>${active}</td><td class="positive">${number(agent.resolved_today)}</td><td>${formatMinutes(agent.avg_first_response_minutes)}</td></tr>`;
        }).join("")
      : `<tr><td colspan="5" class="iea-management-empty">Nenhum atendente encontrado para o período.</td></tr>`;
    root.querySelector("[data-management-updated]").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  async function load(root, silent) {
    if (!root.isConnected || root.dataset.managementLoading === "1") return;
    root.dataset.managementLoading = "1";
    const status = root.querySelector("[data-management-status]");
    if (!silent) status.textContent = "Atualizando indicadores…";
    try {
      const data = await request(`/api/crm/metrics?${query(root)}`);
      renderDashboard(root, data);
      status.textContent = "Indicadores sincronizados";
      status.dataset.error = "0";
    } catch (error) {
      status.textContent = error.name === "AbortError" ? "A atualização demorou demais. Tente novamente." : (error.message || "Falha ao carregar indicadores.");
      status.dataset.error = "1";
    } finally {
      delete root.dataset.managementLoading;
    }
  }

  function csvCell(value) {
    return `"${String(value == null ? "" : value).replace(/"/g, '""')}"`;
  }

  function exportCsv(root) {
    const rows = root.__ieaManagementRows || [];
    const body = [
      ["Atendente", "Setor", "Ativos", "Resolvidos", "Primeira resposta (min)"],
      ...rows.map(item => [item.name, item.service_sector || "CRC", number(item.active), number(item.resolved_today), number(item.avg_first_response_minutes)]),
    ].map(row => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gestao-crm-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function styles() {
    if (document.getElementById("iea-management-dashboard-style")) return;
    const style = document.createElement("style");
    style.id = "iea-management-dashboard-style";
    style.textContent = `
      .iea-management{padding:28px 34px;min-height:100%;background:var(--bg);color:var(--text)}
      .iea-management-head{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:22px}.iea-management-head h1{margin:0;font-size:25px}.iea-management-head p{margin:5px 0 0;color:var(--text2);font-size:13px}
      .iea-management-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.iea-management-actions select,.iea-management-actions button{height:40px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);padding:0 12px;font:700 13px Manrope,system-ui,sans-serif}.iea-management-actions button{cursor:pointer}.iea-management-actions button.primary{background:#2563eb;border-color:#2563eb;color:#fff}
      .iea-management-feedback{display:flex;justify-content:space-between;color:var(--text3);font-size:12px;margin:-10px 0 15px}.iea-management-feedback [data-error='1']{color:#ef4444;font-weight:700}
      .iea-management-kpis{display:grid;grid-template-columns:repeat(6,minmax(145px,1fr));gap:12px;margin-bottom:18px;overflow-x:auto}.iea-management-card{min-width:145px;border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:14px;background:var(--panel);padding:15px;box-shadow:0 8px 24px rgba(15,23,42,.05)}.iea-management-card small,.iea-management-card span{display:block;color:var(--text2);font-size:11px}.iea-management-card strong{display:block;font-size:25px;margin:6px 0;color:var(--accent)}
      .iea-management-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:16px}.iea-management-panel{background:var(--panel);border:1px solid var(--line);border-radius:15px;padding:20px;min-width:0}.iea-management-panel h2{font-size:16px;margin:0 0 18px}
      .iea-management-volume{height:230px;display:flex;align-items:flex-end;gap:9px;overflow-x:auto}.iea-management-bar{height:100%;min-width:36px;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px}.iea-management-bar b{display:block;width:100%;max-width:54px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#2563eb,#60a5fa);min-height:4px}.iea-management-bar strong{font-size:10px;color:var(--text2)}.iea-management-bar span{font-size:10px;color:var(--text3);white-space:nowrap}
      .iea-management-table{width:100%;border-collapse:collapse}.iea-management-table th,.iea-management-table td{text-align:left;padding:12px 9px;border-bottom:1px solid var(--line2);font-size:12px}.iea-management-table th{font-size:10px;color:var(--text3);text-transform:uppercase}.iea-management-agent{display:flex;align-items:center;gap:9px}.iea-management-agent i{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#e8f0ff;color:#2563eb;font-style:normal;font-weight:850}.iea-management-agent small{display:block;color:var(--text3);margin-top:2px}.iea-management-status{display:inline-flex;padding:4px 8px;border-radius:999px;font-weight:750}.iea-management-status.available{background:#eaf8ef;color:#15803d}.iea-management-status.busy{background:#fff4da;color:#a16207}.iea-management-table .positive{color:#16a34a;font-weight:850}.iea-management-empty{width:100%;padding:30px!important;text-align:center!important;color:var(--text3)}
      @media(max-width:1100px){.iea-management-grid{grid-template-columns:1fr}.iea-management-kpis{grid-template-columns:repeat(3,1fr)}}
    `;
    // O runtime legado reconstrói <head> em algumas transições. Manter o CSS
    // junto ao corpo evita a tela sem estilo durante essas atualizações.
    (document.body || document.documentElement).appendChild(style);
  }

  async function mount() {
    const root = managementRoot();
    if (!root || root.dataset.ieaManagementMounted === "1") return;
    styles();
    root.dataset.ieaManagementMounted = "1";
    root.innerHTML = `<div class="iea-management">
      <header class="iea-management-head"><div><h1>Visão do gestor</h1><p>Indicadores operacionais reais, atualizados sem recarregar o CRM.</p></div><div class="iea-management-actions"><select data-management-period aria-label="Período"><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="month">Este mês</option></select><select data-management-channel aria-label="Canal"><option value="">Todos os canais</option></select><button type="button" data-management-refresh class="primary">Atualizar</button><button type="button" data-management-export>Exportar CSV</button></div></header>
      <div class="iea-management-feedback"><span data-management-status>Carregando indicadores…</span><span data-management-updated></span></div>
      <section class="iea-management-kpis" data-management-kpis></section>
      <div class="iea-management-grid"><section class="iea-management-panel"><h2>Volume de mensagens recebidas</h2><div class="iea-management-volume" data-management-volume><div class="iea-management-empty">Carregando gráfico…</div></div></section><section class="iea-management-panel"><h2>Desempenho da equipe</h2><div style="overflow:auto"><table class="iea-management-table"><thead><tr><th>Atendente</th><th>Situação</th><th>Ativos</th><th>Resolvidos</th><th>1ª resposta</th></tr></thead><tbody data-management-agents><tr><td colspan="5" class="iea-management-empty">Carregando equipe…</td></tr></tbody></table></div></section></div>
    </div>`;
    root.querySelector("[data-management-refresh]").addEventListener("click", () => load(root, false));
    root.querySelector("[data-management-period]").addEventListener("change", () => load(root, false));
    root.querySelector("[data-management-channel]").addEventListener("change", () => load(root, false));
    root.querySelector("[data-management-export]").addEventListener("click", () => exportCsv(root));
    try {
      const channels = await request("/api/crm/channels");
      const select = root.querySelector("[data-management-channel]");
      (channels.items || []).forEach(channel => select.add(new Option(channel.display_name || channel.instance_name, channel.id)));
    } catch (_) {
      // Os indicadores gerais continuam disponíveis se a lista de canais falhar.
    }
    await load(root, false);
    const refresh = window.setInterval(() => {
      if (!root.isConnected) return window.clearInterval(refresh);
      load(root, true);
    }, 15000);
  }

  function scheduleMount() {
    if (mountScheduled || document.hidden) return;
    mountScheduled = true;
    window.requestAnimationFrame(() => {
      mountScheduled = false;
      mount();
    });
  }

  new MutationObserver(scheduleMount).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleMount(); });
  scheduleMount();
})();
