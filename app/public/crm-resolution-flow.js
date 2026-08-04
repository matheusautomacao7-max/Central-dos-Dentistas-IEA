(function () {
  "use strict";

  if (window.__ieaResolutionFlowInstalled) return;
  window.__ieaResolutionFlowInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const categories = ["Primeira consulta", "Controle", "Tratamento", "Orçamento"];
  const outcomes = [
    "Agendou", "Quer agendar", "Retorno", "Novo Contato IA",
    "Mudou de cidade", "Em tratamento externo", "Desqualificado", "Outros"
  ];
  const interests = ["Avaliação", "Estética", "Zero Cárie", "Ortodontia", "Implante", "Clareamento"];
  const origins = ["Instagram", "Indicação", "Google", "Campanha", "Retorno", "Outro"];
  const style = document.createElement("style");
  style.id = "iea-resolution-flow-style";
  style.textContent = `
    .iea-r-overlay{position:fixed;inset:0;z-index:99999;background:rgba(7,27,34,.62);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Manrope,system-ui,sans-serif}
    .iea-r-card{width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 30px 90px rgba(0,0,0,.3);color:#11283d}
    .iea-r-head{padding:24px 28px 18px;border-bottom:1px solid #e6ebef;display:flex;justify-content:space-between;gap:20px}
    .iea-r-kicker{font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:#b28a3c;font-weight:800}
    .iea-r-title{font-size:25px;line-height:1.2;margin:5px 0 2px;font-weight:800}.iea-r-sub{font-size:13px;color:#718090}
    .iea-r-close{width:38px;height:38px;border:1px solid #dce3e8;background:#fff;border-radius:10px;font-size:20px;cursor:pointer}
    .iea-r-progress{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:18px 28px 0}
    .iea-r-step{height:5px;border-radius:8px;background:#e7ecef}.iea-r-step.on{background:#25b967}
    .iea-r-body{padding:22px 28px 26px}.iea-r-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .iea-r-field{display:flex;flex-direction:column;gap:7px}.iea-r-field.full{grid-column:1/-1}
    .iea-r-field label{font-size:12px;font-weight:800;color:#536575;text-transform:uppercase;letter-spacing:.03em}
    .iea-r-field select,.iea-r-field input,.iea-r-field textarea{width:100%;border:1px solid #d7e0e6;border-radius:11px;padding:12px 13px;background:#fff;color:#132b3f;font:600 14px Manrope,system-ui,sans-serif;outline:none}
    .iea-r-field textarea{min-height:86px;resize:vertical}.iea-r-field input:focus,.iea-r-field select:focus,.iea-r-field textarea:focus{border-color:#b28a3c;box-shadow:0 0 0 3px rgba(178,138,60,.12)}
    .iea-r-actions{display:flex;justify-content:space-between;gap:12px;padding:18px 28px;border-top:1px solid #e6ebef;background:#fafbfc;border-radius:0 0 20px 20px}
    .iea-r-btn{border:0;border-radius:11px;padding:12px 19px;font:800 14px Manrope,system-ui,sans-serif;cursor:pointer}.iea-r-btn.alt{background:#fff;border:1px solid #d9e1e6;color:#263b4e}.iea-r-btn.main{background:#12314d;color:#fff}.iea-r-btn.gold{background:#c99e4b;color:#10283d}
    .iea-r-error{display:none;margin:0 28px 4px;padding:10px 13px;border-radius:9px;background:#feeceb;color:#bd2e2e;font-size:13px;font-weight:700}
    .iea-r-summary{display:grid;gap:10px}.iea-r-row{display:flex;justify-content:space-between;gap:18px;padding:12px 14px;background:#f4f7f8;border-radius:10px;font-size:14px}.iea-r-row b{text-align:right}
    .iea-report{margin:18px 0;padding:20px;background:#fff;border:1px solid #e3e9ed;border-radius:16px;color:#10283d;font-family:Manrope,system-ui,sans-serif}
    .iea-report-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-end;flex-wrap:wrap}.iea-report h2{margin:0;font-size:21px}.iea-report p{margin:4px 0 0;color:#718090;font-size:13px}
    .iea-report-filters{display:flex;gap:8px;flex-wrap:wrap}.iea-report select,.iea-report input{border:1px solid #d8e1e7;border-radius:9px;padding:9px 10px;background:#fff;font:600 13px Manrope,system-ui,sans-serif}
    .iea-kpis{display:grid;grid-template-columns:repeat(7,minmax(115px,1fr));gap:10px;margin-top:17px;overflow-x:auto}.iea-kpi{padding:15px;background:#f5f7f8;border-radius:12px;min-width:120px}.iea-kpi small{display:block;color:#718090;font-weight:700}.iea-kpi strong{display:block;font-size:25px;margin-top:4px}
    .iea-report-tables{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.iea-report-box{border:1px solid #e4eaee;border-radius:12px;overflow:hidden}.iea-report-box h3{font-size:14px;margin:0;padding:12px;background:#f7f9fa}.iea-report-line{display:flex;justify-content:space-between;padding:10px 12px;border-top:1px solid #edf1f3;font-size:13px}
    @media(max-width:720px){.iea-r-grid{grid-template-columns:1fr}.iea-r-field.full{grid-column:auto}.iea-report-tables{grid-template-columns:1fr}.iea-kpis{grid-template-columns:repeat(2,1fr)}}
  `;
  document.head.appendChild(style);
  const ensureResolutionStyle = () => {
    if (document.getElementById("iea-resolution-flow-style")) return;
    const restored = style.cloneNode(true);
    restored.id = "iea-resolution-flow-style";
    // The CRM runtime rebuilds <head> after boot. Keeping the module style in
    // <body> makes it survive that rebuild and prevents an unstyled modal.
    (document.body || document.documentElement).appendChild(restored);
  };

  const escapeHtml = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const opts = values => `<option value="">Selecione...</option>${values.map(v => `<option>${escapeHtml(v)}</option>`).join("")}`;
  let dentistsCache = null;
  let dentistsRequest = null;
  const loadDentists = async () => {
    if (dentistsCache) return dentistsCache;
    if (!dentistsRequest) {
      dentistsRequest = originalFetch("/api/journey/professionals", { credentials: "same-origin" })
        .then(async response => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Não foi possível carregar os dentistas.");
          const items = Array.isArray(data.items) ? data.items : [];
          dentistsCache = items
            .filter(item => item && item.name)
            .map(item => ({
              id: item.id,
              name: String(item.name).trim(),
              specialties: String(item.specialties || "").trim()
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
          return dentistsCache;
        })
        .finally(() => { dentistsRequest = null; });
    }
    return dentistsRequest;
  };
  const dentistOptions = (dentists, selected) => {
    const options = [`<option value="">Selecione o dentista...</option>`];
    dentists.forEach(dentist => {
      const detail = dentist.specialties ? ` — ${dentist.specialties}` : "";
      options.push(`<option value="${escapeHtml(dentist.name)}"${dentist.name === selected ? " selected" : ""}>${escapeHtml(dentist.name + detail)}</option>`);
    });
    return options.join("");
  };
  const visiblePatientName = () => {
    const headings = Array.from(document.querySelectorAll("h1,h2,strong"));
    const candidate = headings.find(el => {
      const t = (el.textContent || "").trim();
      return t && !/Conversas|Fila|Funil|Visão|Contatos|Campanhas|Integrações|Configurações/i.test(t);
    });
    return candidate ? candidate.textContent.trim() : "Paciente selecionado";
  };

  async function resolutionModal(patientName) {
    const dentists = await loadDentists();
    return new Promise((resolve, reject) => {
      ensureResolutionStyle();
      // Some runtime updates happen just after the click. Recheck after those
      // updates so the modal never loses its stylesheet.
      [0, 50, 250].forEach(delay => window.setTimeout(ensureResolutionStyle, delay));
      let step = 1;
      const overlay = document.createElement("div");
      overlay.className = "iea-r-overlay";
      overlay.innerHTML = `
        <div class="iea-r-card" role="dialog" aria-modal="true">
          <div class="iea-r-head"><div><div class="iea-r-kicker">Conclusão do atendimento</div><div class="iea-r-title">Resolver atendimento</div><div class="iea-r-sub">${escapeHtml(patientName || visiblePatientName())}</div></div><button class="iea-r-close" type="button">×</button></div>
          <div class="iea-r-progress"><i class="iea-r-step on"></i><i class="iea-r-step"></i><i class="iea-r-step"></i></div>
          <div class="iea-r-error"></div><div class="iea-r-body"></div><div class="iea-r-actions"></div>
        </div>`;
      document.body.appendChild(overlay);
      const body = overlay.querySelector(".iea-r-body");
      const actions = overlay.querySelector(".iea-r-actions");
      const error = overlay.querySelector(".iea-r-error");
      const form = {
        patient_type: "", is_recovery: "0", category: "", outcome: "", interest: "", origin: "", notes: "",
        responsible_professional: "", scheduled_date: "", scheduled_time: "",
        schedule_type: "", next_contact_at: "", attempts: "", loss_reason: ""
      };
      const close = () => { overlay.remove(); reject(new Error("Encerramento cancelado")); };
      overlay.querySelector(".iea-r-close").onclick = close;
      const read = () => overlay.querySelectorAll("[data-field]").forEach(el => { form[el.dataset.field] = el.value; });
      const showError = msg => { error.textContent = msg; error.style.display = "block"; };
      const conditionalFields = () => {
        const recoveryField = form.patient_type === "Retorno s/ Tratamento" && form.outcome === "Agendou" ? `
          <div class="iea-r-field full"><label>Este agendamento recuperou um paciente?</label><select data-field="is_recovery">
            <option value="0"${form.is_recovery !== "1" ? " selected" : ""}>Não</option>
            <option value="1"${form.is_recovery === "1" ? " selected" : ""}>Sim, paciente recuperado</option>
          </select></div>` : "";
        if (!recoveryField) form.is_recovery = "0";
        if (form.outcome === "Agendou") {
          // O resultado já confirma o agendamento; não há uma segunda decisão a tomar.
          form.schedule_type = "Agendado";
          return `${recoveryField}
          <div class="iea-r-field"><label>Data do agendamento</label><input data-field="scheduled_date" type="date" value="${escapeHtml(form.scheduled_date)}"></div>
          <div class="iea-r-field"><label>Horário</label><input data-field="scheduled_time" type="time" value="${escapeHtml(form.scheduled_time)}"></div>
          <div class="iea-r-field full"><label>Profissional</label><select data-field="responsible_professional">${dentistOptions(dentists, form.responsible_professional)}</select></div>`;
        }
        if (["Quer agendar","Retorno"].includes(form.outcome)) return `${recoveryField}
          <div class="iea-r-field full"><label>Próximo contato</label><input data-field="next_contact_at" type="datetime-local" value="${escapeHtml(form.next_contact_at)}"></div>`;
        if (form.outcome === "Novo Contato IA") return `${recoveryField}
          <div class="iea-r-field"><label>Tentativas realizadas</label><input data-field="attempts" type="number" min="0" max="99" value="${escapeHtml(form.attempts)}"></div>
          <div class="iea-r-field"><label>Próxima tentativa (opcional)</label><input data-field="next_contact_at" type="datetime-local" value="${escapeHtml(form.next_contact_at)}"></div>`;
        if (["Mudou de cidade","Em tratamento externo","Desqualificado","Outros"].includes(form.outcome)) return `${recoveryField}
          <div class="iea-r-field full"><label>Motivo / explicação</label><textarea data-field="loss_reason" placeholder="Registre o motivo para os relatórios">${escapeHtml(form.loss_reason)}</textarea></div>`;
        return recoveryField;
      };
      const render = () => {
        error.style.display = "none";
        overlay.querySelectorAll(".iea-r-step").forEach((el, i) => el.classList.toggle("on", i < step));
        if (step === 1) body.innerHTML = `<div class="iea-r-grid">
          <div class="iea-r-field full"><label>Tipo de paciente</label><select data-field="patient_type">
            <option value="">Selecione...</option>
            <option value="Primeira consulta">Primeira consulta</option>
            <option value="Retorno s/ Tratamento">Cliente recorrente — retorno sem tratamento</option>
          </select></div>
          <div class="iea-r-field"><label>Categoria</label><select data-field="category">${opts(categories)}</select></div>
          <div class="iea-r-field"><label>Resultado</label><select data-field="outcome">${opts(outcomes)}</select></div>
          <div class="iea-r-field"><label>Interesse</label><select data-field="interest">${opts(interests)}</select></div>
          <div class="iea-r-field"><label>Origem</label><select data-field="origin">${opts(origins)}</select></div>
        </div>`;
        if (step === 2) body.innerHTML = `<div class="iea-r-grid">${conditionalFields()}
          <div class="iea-r-field full"><label>Observação final</label><textarea data-field="notes" placeholder="Contexto importante deste atendimento">${escapeHtml(form.notes)}</textarea></div>
        </div>`;
        if (step === 3) {
          const rows = [
            ["Paciente", patientName || visiblePatientName()], ["Tipo de paciente", form.patient_type],
            ["Categoria", form.category], ["Resultado", form.outcome],
            ["Paciente recuperado", form.is_recovery === "1" ? "Sim" : "Não"],
            ["Interesse", form.interest || "Não informado"], ["Origem", form.origin || "Não informada"],
            ["Profissional", form.responsible_professional || "Não informado"],
            ["Agendamento", form.scheduled_date ? `${form.scheduled_date} às ${form.scheduled_time} · ${form.schedule_type}` : "Não"],
            ["Próximo contato", form.next_contact_at || "Não programado"], ["Observação", form.notes || form.loss_reason || "Sem observação"]
          ];
          body.innerHTML = `<div class="iea-r-summary">${rows.map(r => `<div class="iea-r-row"><span>${escapeHtml(r[0])}</span><b>${escapeHtml(r[1])}</b></div>`).join("")}</div>`;
        }
        body.querySelectorAll("[data-field]").forEach(el => {
          if (form[el.dataset.field] && el.tagName === "SELECT") el.value = form[el.dataset.field];
        });
        actions.innerHTML = `<button class="iea-r-btn alt" data-back type="button">${step === 1 ? "Cancelar" : "Voltar"}</button><button class="iea-r-btn ${step === 3 ? "gold" : "main"}" data-next type="button">${step === 3 ? "Confirmar e resolver" : "Continuar"}</button>`;
        actions.querySelector("[data-back]").onclick = () => { if (step === 1) close(); else { step--; render(); } };
        actions.querySelector("[data-next]").onclick = () => {
          read();
          if (step === 1 && (!form.patient_type || !form.category || !form.outcome)) return showError("Selecione o tipo de paciente, a categoria e o resultado.");
          if (step === 2) {
            if (form.outcome === "Agendou" && (!form.scheduled_date || !form.scheduled_time || !form.responsible_professional)) return showError("Preencha data, horário e profissional do agendamento.");
            if (["Quer agendar","Retorno"].includes(form.outcome) && !form.next_contact_at) return showError("Informe a data e o horário do próximo contato.");
            if (["Mudou de cidade","Em tratamento externo","Desqualificado","Outros"].includes(form.outcome) && !form.loss_reason.trim()) return showError("Informe o motivo para concluir.");
          }
          if (step < 3) { step++; render(); } else { overlay.remove(); resolve(form); }
        };
      };
      render();
    });
  }

  // Explicit bridge for the embedded CRM runtime. The application can call
  // this directly even when it retained its own fetch reference during boot.
  window.IEA_CRM_RESOLUTION = { open: resolutionModal };

  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (/\/api\/crm\/conversations\/\d+\/resolve(?:\?|$)/.test(url) && method === "POST" && !(init && init.headers && init.headers["X-IEA-Structured-Resolution"])) {
      const payload = await resolutionModal();
      return originalFetch(input, {
        ...(init || {}),
        method: "POST",
        headers: { ...((init && init.headers) || {}), "Content-Type": "application/json", "X-IEA-Structured-Resolution": "1" },
        body: JSON.stringify(payload)
      });
    }
    return originalFetch(input, init);
  };

  let reportLoading = false;
  function isManagerScreen() {
    return Array.from(document.querySelectorAll("h1,h2")).some(el => /Visão do gestor/i.test(el.textContent || ""));
  }
  function mountReport() {
    // O runtime do CRM reconstrói o <head> ao trocar de tela. Recolocamos o
    // stylesheet antes de inserir o relatório para ele nunca aparecer cru.
    ensureResolutionStyle();
    if (!isManagerScreen() || document.getElementById("iea-resolution-report")) return;
    const heading = Array.from(document.querySelectorAll("h1,h2")).find(el => /Visão do gestor/i.test(el.textContent || ""));
    const host = heading && (heading.parentElement && heading.parentElement.parentElement);
    if (!host) return;
    const section = document.createElement("section");
    section.id = "iea-resolution-report";
    section.className = "iea-report";
    section.innerHTML = `<div class="iea-report-head"><div><h2>Resultados dos atendimentos</h2><p>Relatórios por tipo de paciente e conclusão registrada.</p></div><div class="iea-report-filters">
      <select data-period><option value="today">Hoje</option><option value="7d">7 dias</option><option value="30d" selected>30 dias</option><option value="custom">Personalizado</option></select>
      <select data-category><option value="">Todas as categorias</option>${categories.map(x=>`<option>${x}</option>`).join("")}</select>
      <select data-outcome><option value="">Todos os resultados</option>${outcomes.map(x=>`<option>${x}</option>`).join("")}</select>
      <input data-start type="date" hidden><input data-end type="date" hidden>
    </div></div><div data-content style="margin-top:16px;color:#718090">Carregando relatório...</div>`;
    host.insertAdjacentElement("afterend", section);
    const updateDates = () => {
      const custom = section.querySelector("[data-period]").value === "custom";
      section.querySelector("[data-start]").hidden = !custom; section.querySelector("[data-end]").hidden = !custom;
    };
    section.querySelectorAll("select,input").forEach(el => el.addEventListener("change", () => { updateDates(); loadReport(section); }));
    loadReport(section);
  }
  function controlNavigationMarkup() {
    return '<svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:0 0 22px;margin:0 auto"><circle cx="12" cy="7" r="4"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg><span style="display:block;width:100%;text-align:center;line-height:1.1">Controle</span>';
  }
  function mountPatientControlLink() {
    if (document.querySelector("[data-iea-patient-control]")) return;
    const management = Array.from(document.querySelectorAll("aside div,aside span"))
      .find(el => /^Gestão$/i.test((el.textContent || "").trim()));
    const aside = management && management.closest("aside");
    if (!aside) return;
    const item = document.createElement("button");
    item.dataset.ieaPatientControl = "1";
    item.type = "button";
    item.title = "Controle";
    item.setAttribute("aria-label", "Controle");
    item.style.cssText = "width:56px;min-height:58px;border:0;padding:0;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:transparent;color:rgba(255,255,255,.72);text-decoration:none;font:700 9.5px Manrope,system-ui,sans-serif;gap:5px;margin:2px 0;cursor:pointer";
    item.innerHTML = controlNavigationMarkup();
    item.addEventListener("mouseenter", () => item.style.background = "rgba(255,255,255,.08)");
    item.addEventListener("mouseleave", () => item.style.background = "transparent");
    item.addEventListener("click", event => {
      event.preventDefault();
      openPatientControl();
    });
    const integrations = Array.from(aside.querySelectorAll("div")).find(el => /^Integra$/i.test((el.textContent || "").trim()));
    let anchor = integrations;
    while (anchor && anchor.parentElement !== aside) anchor = anchor.parentElement;
    if (anchor && anchor.parentElement === aside) aside.insertBefore(item, anchor);
    else aside.appendChild(item);
  }
  function normalizeCrmNavigation() {
    // A lista nativa passa a representar os pacientes; o controle operacional
    // continua acessível pelo item independente de contatos.
    document.querySelectorAll("aside span,aside div").forEach(label => {
      if ((label.textContent || "").trim() !== "Contatos" || label.children.length) return;
      label.textContent = "Pacientes";
      const nav = label.parentElement;
      if (!nav || nav.dataset.ieaPatientsNav === "1") return;
      nav.dataset.ieaPatientsNav = "1";
      nav.title = "Pacientes";
      const icon = nav.querySelector("svg");
      if (!icon) return;
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("fill", "none");
      icon.setAttribute("stroke", "currentColor");
      icon.setAttribute("stroke-width", "2");
      icon.setAttribute("stroke-linecap", "round");
      icon.setAttribute("stroke-linejoin", "round");
      icon.innerHTML = '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8.01 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"></path>';
    });
    const shortcut = document.querySelector("[data-iea-patient-control]");
    if (shortcut && shortcut.dataset.ieaRenamed !== "1") {
      shortcut.dataset.ieaRenamed = "1";
      shortcut.title = "Controle";
      shortcut.setAttribute("aria-label", "Controle");
      shortcut.innerHTML = controlNavigationMarkup();
    }
  }
  function openPatientControl() {
    if (window.IEACrmOperations && window.IEACrmOperations.openControl) {
      window.IEACrmOperations.openControl();
      return;
    }
    const link = document.querySelector("[data-iea-patient-control]");
    if (link) link.style.background = "rgba(255,255,255,.16)";
  }
  function closePatientControl(event) {
    if (window.IEACrmOperations && window.IEACrmOperations.closeScreen) {
      window.IEACrmOperations.closeScreen(event);
    }
    const frame = document.getElementById("iea-patient-control-screen");
    if (!frame || frame.hidden) return;
    if (event && event.target.closest("[data-iea-patient-control]")) return;
    frame.hidden = true;
    const link = document.querySelector("[data-iea-patient-control]");
    if (link) link.style.background = "transparent";
  }
  document.addEventListener("click", event => {
    const aside = event.target.closest("aside");
    if (aside && !event.target.closest("[data-iea-patient-control]")) closePatientControl(event);
  }, true);
  async function loadReport(section) {
    if (reportLoading) return;
    reportLoading = true;
    const q = new URLSearchParams({
      period: section.querySelector("[data-period]").value,
      category: section.querySelector("[data-category]").value,
      outcome: section.querySelector("[data-outcome]").value,
      start: section.querySelector("[data-start]").value,
      end: section.querySelector("[data-end]").value
    });
    const content = section.querySelector("[data-content]");
    try {
      const response = await originalFetch(`/api/crm/resolution-reports?${q}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar relatório");
      const s = data.summary || {};
      const cards = [
        ["Atendimentos",s.total],["1ª consulta",s.first_consultations],["Controle",s.controls],
        ["Tratamento",s.treatments],["Orçamento",s.budgets],["Agendou",s.scheduled],
        ["Conversão · 1ª consulta",`${s.first_consultation_conversion_rate || 0}%`],
        ["Conversão · Recorrente",`${s.recurring_conversion_rate || 0}%`]
      ];
      const lines = items => (items || []).slice(0,8).map(x => `<div class="iea-report-line"><span>${escapeHtml(x.label)}</span><b>${x.total}</b></div>`).join("") || `<div class="iea-report-line"><span>Sem registros no período</span></div>`;
      content.innerHTML = `<div class="iea-kpis">${cards.map(c => `<div class="iea-kpi"><small>${c[0]}</small><strong>${c[1] || 0}</strong></div>`).join("")}</div>
        <div class="iea-report-tables"><div class="iea-report-box"><h3>Por categoria</h3>${lines(data.by_category)}</div><div class="iea-report-box"><h3>Por resultado</h3>${lines(data.by_outcome)}</div></div>`;
    } catch (error) {
      content.innerHTML = `<div style="padding:12px;background:#feeceb;color:#b92c2c;border-radius:10px;font-weight:700">${escapeHtml(error.message)}</div>`;
    } finally { reportLoading = false; }
  }
  let maintenanceScheduled = false;
  function scheduleMaintenance() {
    if (maintenanceScheduled || document.hidden) return;
    maintenanceScheduled = true;
    window.requestAnimationFrame(() => {
      maintenanceScheduled = false;
      ensureResolutionStyle();
      mountReport();
      mountPatientControlLink();
      normalizeCrmNavigation();
    });
  }
  new MutationObserver(scheduleMaintenance).observe(document.body, { childList: true, subtree: true });
  mountReport();
  mountPatientControlLink();
  normalizeCrmNavigation();
  if (new URLSearchParams(location.search).get("screen") === "patient-control") {
    const openWhenReady = setInterval(() => {
      mountPatientControlLink();
      if (document.querySelector("[data-iea-patient-control]")) {
        clearInterval(openWhenReady);
        openPatientControl();
      }
    }, 150);
    setTimeout(() => clearInterval(openWhenReady), 10000);
  }
})();
