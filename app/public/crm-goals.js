(function () {
  "use strict";

  const METRICS = [
    ["first_consultations", "Primeiras consultas"],
    ["recoveries", "Recuperação de pacientes"],
    ["attendances", "Atendimentos"]
  ];
  const METRIC_VISUALS = {
    first_consultations: { color: "#2563EB", soft: "#F5F9FF" },
    recoveries: { color: "#7C3AED", soft: "#FAF7FF" },
    attendances: { color: "#F59E0B", soft: "#FFF9F0" }
  };
  const baseFetch = window.fetch.bind(window);
  let root = null;
  let currentData = null;
  let selectedMonth = new Date().toISOString().slice(0, 7);
  let selectedUserId = "";
  let activeTab = "progress";
  let applyToAll = false;
  let configDraft = null;
  let refreshTimer = null;
  let mountScheduled = false;

  const esc = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const number = value => Number(value || 0).toLocaleString("pt-BR");
  const percent = value => `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const money = cents => Number(cents || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const moneyInput = cents => (Number(cents || 0) / 100).toFixed(2);
  const initials = value => String(value || "")
    .trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "CRC";

  function performanceState(percentage, target, reached, minimum, realized) {
    const value = Number(percentage || 0);
    if (!Number(target || 0)) return { key: "unset", label: "Não configurada", color: "#94A3B8", text: "#64748B", soft: "#F1F5F9" };
    if (reached || value >= 100) return { key: "reached", label: "Meta alcançada", color: "#16A34A", text: "#15803D", soft: "#F0FDF4" };
    if (Number(minimum || 0) > 0 && Number(realized || 0) >= Number(minimum)) {
      return { key: "minimum", label: "Mínimo atingido", color: "#2563EB", text: "#1D4ED8", soft: "#EFF6FF" };
    }
    if (Number(minimum || 0) > 0 && Number(realized || 0) < Number(minimum)) {
      const minimumProgress = Number(realized || 0) / Number(minimum) * 100;
      if (minimumProgress <= 50) return { key: "low", label: "Abaixo do mínimo", color: "#EF4444", text: "#DC2626", soft: "#FEF2F2" };
      return { key: "attention", label: "Abaixo do mínimo", color: "#F59E0B", text: "#B45309", soft: "#FFFBEB" };
    }
    if (value <= 50) return { key: "low", label: "Atrasada", color: "#EF4444", text: "#DC2626", soft: "#FEF2F2" };
    if (value <= 75) return { key: "attention", label: "Atenção", color: "#F59E0B", text: "#B45309", soft: "#FFFBEB" };
    return { key: "good", label: "Em andamento", color: "#2563EB", text: "#1D4ED8", soft: "#EFF6FF" };
  }

  function conversionState(percentage) {
    const value = Number(percentage || 0);
    if (value <= 0) return { key: "neutral", color: "#94A3B8", text: "#64748B", soft: "#F1F5F9" };
    return performanceState(value, 100, value >= 100);
  }

  function metricIcon(metricKey) {
    const paths = {
      first_consultations: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path><path d="m9 16 2 2 4-5"></path>',
      recoveries: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path><circle cx="12" cy="11" r="2.5"></circle><path d="M7.5 19c.8-2.3 2.3-3.5 4.5-3.5s3.7 1.2 4.5 3.5"></path>',
      attendances: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="m8 10 2.2 2.2L16 7"></path>'
    };
    return `<svg class="iea-metric-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths[metricKey] || paths.attendances}</svg>`;
  }

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
      .iea-goals-screen{position:fixed;inset:0 0 0 80px;z-index:46;background:#F3F6FA;color:#0F2942;overflow:auto;overflow-x:hidden;font-family:Manrope,system-ui,sans-serif;--blue:#2563EB;--green:#16A34A;--red:#EF4444;--orange:#F59E0B;--purple:#7C3AED;--slate:#334155}.iea-goals-screen,.iea-goals-screen *{box-sizing:border-box}
      .iea-goals-wrap{max-width:1440px;margin:0 auto;padding:30px 32px 52px}
      .iea-goals-head{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:20px}
      .iea-goals-identity{display:flex;align-items:center;gap:13px;min-width:0}.iea-goals-avatar{width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;border-radius:50%;background:#2563EB;color:#fff;box-shadow:0 8px 18px rgba(37,99,235,.2);font-size:15px;font-weight:900;letter-spacing:.03em}
      .iea-goals-head h1{margin:0;font-size:28px;line-height:1.16;letter-spacing:-.025em}.iea-goals-head p{margin:6px 0 0;color:#64748B;font-size:14px}
      .iea-goals-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}.iea-goals-control{position:relative;display:flex;align-items:center}.iea-goals-control svg{position:absolute;left:12px;width:17px;height:17px;color:#64748B;pointer-events:none}.iea-goals-control .iea-goals-field{padding-left:37px}
      .iea-goals-btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #D7E0E8;border-radius:11px;background:#fff;padding:9px 15px;font:800 13px Manrope,system-ui;color:#17344F;cursor:pointer;box-shadow:0 2px 5px rgba(15,41,66,.04);transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease}.iea-goals-btn svg{width:17px;height:17px}.iea-goals-btn:hover{border-color:#AFC0D0;box-shadow:0 6px 16px rgba(15,41,66,.08);transform:translateY(-1px)}
      .iea-goals-btn.primary{border-color:#2563EB;background:#2563EB;color:#fff;box-shadow:0 7px 16px rgba(37,99,235,.2)}.iea-goals-btn:disabled{opacity:.55;cursor:wait;transform:none}
      .iea-goals-field{min-height:44px;border:1px solid #D7E0E8;border-radius:11px;background:#fff;padding:9px 12px;color:#17344F;font:700 13px Manrope,system-ui;outline:none}.iea-goals-field:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.13)}
      .iea-goals-tabs{display:flex;gap:8px;margin:0 0 20px}.iea-goals-tab{min-height:40px;border:1px solid #D9E2E8;border-radius:10px;background:#fff;padding:9px 17px;color:#64748B;font:800 13px Manrope,system-ui;cursor:pointer;transition:all .16s ease}.iea-goals-tab.on{border-color:#2563EB;background:#2563EB;color:#fff;box-shadow:0 7px 16px rgba(37,99,235,.18)}
      .iea-goals-panel{border:1px solid #E1E8EF;border-radius:18px;background:#fff;padding:22px;margin-bottom:18px;box-shadow:0 7px 24px rgba(15,41,66,.045)}
      .iea-goals-summary{display:grid;grid-template-columns:repeat(3,minmax(230px,1fr));gap:16px;margin-bottom:18px}
      .iea-goal-card{position:relative;overflow:hidden;border:1px solid #E0E7EF;border-top:4px solid var(--tone);border-radius:18px;background:linear-gradient(180deg,var(--metric-soft) 0,#fff 48%);padding:20px;min-width:0;box-shadow:0 8px 26px rgba(15,41,66,.07)}
      .iea-goal-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.iea-goal-heading{display:flex;align-items:center;gap:11px;min-width:0}.iea-metric-icon-box{width:42px;height:42px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;border-radius:12px;background:var(--metric-soft);color:var(--metric);border:1px solid color-mix(in srgb,var(--metric) 16%,transparent)}.iea-metric-icon{width:23px;height:23px;display:block}.iea-goal-title h2{font-size:16px;line-height:1.25;margin:0}.iea-goal-badge,.iea-status-badge{display:inline-flex;align-items:center;gap:6px;border:1px solid color-mix(in srgb,var(--tone) 22%,transparent);border-radius:999px;background:var(--tone-soft);color:var(--tone-text,var(--tone));padding:6px 9px;font-size:10px;line-height:1;font-weight:900;white-space:nowrap}.iea-goal-badge:before,.iea-status-badge:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--tone)}
      .iea-goal-bar{height:10px;background:#E7EDF3;border-radius:999px;overflow:hidden;margin:19px 0 18px}.iea-goal-bar>i{display:block;height:100%;border-radius:inherit;background:var(--tone);transition:width .35s ease;box-shadow:0 0 0 1px rgba(255,255,255,.2) inset}
      .iea-goal-values{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.iea-goal-values>div{min-width:0}.iea-goal-values small{display:block;color:#7B8C9A;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;font-weight:850}.iea-goal-values strong{display:block;margin-top:5px;font-size:20px;line-height:1.2}.iea-goal-values .featured{color:var(--tone-text,var(--tone));font-size:22px}.iea-goal-values .gap-zero{color:#15803D}.iea-goal-values .reward-value{font-size:16px;color:#15803D}
      .iea-goal-pace{display:flex;align-items:center;gap:8px;margin:16px 0 0;padding-top:14px;border-top:1px solid rgba(148,163,184,.2);color:#64748B;font-size:12px;line-height:1.5}.iea-goal-pace:before{content:"";width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:var(--tone)}.iea-goal-pace b{color:#17344F}
      .iea-goals-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.iea-conversion{display:flex;align-items:center;justify-content:space-between;gap:20px;border-left:4px solid var(--tone);background:linear-gradient(135deg,var(--tone-soft),#fff 72%)}.iea-conversion-copy{display:flex;align-items:center;gap:12px;min-width:0}.iea-conversion-icon{width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;border-radius:11px;background:#fff;color:var(--tone-text,var(--tone));box-shadow:0 4px 13px rgba(15,41,66,.07)}.iea-conversion-icon svg{width:20px;height:20px}.iea-conversion h3{margin:0 0 6px;font-size:15px}.iea-conversion p{margin:0;color:#64748B;font-size:12px;line-height:1.45}
      .iea-remuneration{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.85fr);gap:18px;align-items:stretch}.iea-remuneration h2{margin:0;font-size:18px}.iea-remuneration-head{display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:14px}.iea-remuneration-head p{margin:5px 0 0;color:#64748B;font-size:12px}.iea-money-table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #E1E8EF;border-radius:12px}.iea-money-table th,.iea-money-table td{padding:12px 10px;text-align:left;border-bottom:1px solid #E8EDF1;font-size:12px}.iea-money-table th{background:linear-gradient(90deg,#0B7A43,#16A34A);color:#fff;font-size:10px;letter-spacing:.04em;text-transform:uppercase}.iea-money-table tr:last-child td{border-bottom:0}.iea-money-table tbody tr:nth-child(even){background:#F8FAFC}.iea-money-metric{display:flex;align-items:center;gap:8px;font-weight:800}.iea-money-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:var(--metric-soft);color:var(--metric)}.iea-money-icon svg{width:15px;height:15px}.iea-money-earned{color:#15803D;font-weight:900}.iea-money-status{font-weight:800;color:var(--tone-text)}.iea-money-progress{display:flex;align-items:center;gap:6px;min-width:105px}.iea-money-progress i{display:block;width:48px;height:5px;border-radius:999px;background:#E2E8F0;overflow:hidden}.iea-money-progress i:after{content:"";display:block;width:var(--value);height:100%;background:var(--tone);border-radius:inherit}.iea-pay-summary{display:grid;gap:12px;background:linear-gradient(145deg,#F0FDF4,#EFF6FF);border-color:#CDEED8}.iea-pay-summary-top{display:grid;grid-template-columns:1fr 1fr;gap:10px}.iea-pay-value{padding:14px;border:1px solid rgba(22,163,74,.13);border-radius:12px;background:rgba(255,255,255,.75)}.iea-pay-value small{display:block;color:#64748B;font-size:10px;font-weight:850;text-transform:uppercase}.iea-pay-value strong{display:block;margin-top:7px;color:#15803D;font-size:25px;letter-spacing:-.035em}.iea-pay-value.neutral strong{color:#0F2942}.iea-pay-gap{padding:16px;border-radius:13px;background:#fff;color:#0F2942}.iea-pay-gap small{display:block;color:#64748B;font-size:10px;font-weight:850;text-transform:uppercase}.iea-pay-gap strong{display:block;margin-top:7px;font-size:28px;letter-spacing:-.04em}.iea-pay-rule{margin:0;color:#52677A;font-size:11px;line-height:1.5}
      .iea-radial{position:relative;width:82px;height:82px;display:grid;place-items:center;flex:0 0 82px;border-radius:50%;background:conic-gradient(var(--tone) calc(var(--value) * 1%),#E2E8F0 0);box-shadow:0 5px 15px rgba(15,41,66,.08)}.iea-radial:before{content:"";position:absolute;inset:8px;border-radius:50%;background:#fff}.iea-radial strong{position:relative;z-index:1;color:var(--tone-text,var(--tone));font-size:19px;letter-spacing:-.03em}
      .iea-daily-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:15px}.iea-daily-head h2,.iea-history-title{margin:0;font-size:18px}.iea-daily-head p{margin:5px 0 0;color:#718295;font-size:12px}.iea-days-card{display:flex;align-items:center;gap:9px;border:1px solid #BFDBFE;border-radius:12px;background:#EFF6FF;color:#1D4ED8;padding:9px 12px;font-size:11px;font-weight:850;white-space:nowrap}.iea-days-card svg{width:18px;height:18px;flex:0 0 auto}
      .iea-daily-table{width:100%;border-collapse:separate;border-spacing:0}.iea-daily-table th,.iea-daily-table td{padding:14px 12px;border-bottom:1px solid #E8EDF1;text-align:left;font-size:13px}.iea-daily-table th{background:#F8FAFC;color:#64748B;font-size:10px;letter-spacing:.04em;text-transform:uppercase}.iea-daily-table th:first-child{border-radius:10px 0 0 10px}.iea-daily-table th:last-child{border-radius:0 10px 10px 0}.iea-daily-table tbody tr:nth-child(even){background:#F8FAFC}.iea-daily-table tbody tr:hover{background:#F1F5F9}.iea-daily-table tr:last-child td{border-bottom:0}.iea-daily-indicator{display:flex;align-items:center;gap:9px}.iea-daily-dot{width:9px;height:9px;flex:0 0 auto;border-radius:50%;background:var(--metric)}.iea-daily-percent{min-width:132px}.iea-daily-percent b{display:block;color:var(--tone-text,var(--tone));font-size:12px}.iea-mini-bar{width:112px;height:5px;margin-top:6px;border-radius:999px;background:#E2E8F0;overflow:hidden}.iea-mini-bar i{display:block;height:100%;border-radius:inherit;background:var(--tone)}
      .iea-goals-config{display:grid;gap:14px}.iea-config-card{border:1px solid #DFE7EC;border-left:4px solid var(--metric);border-radius:14px;padding:18px;background:linear-gradient(100deg,var(--metric-soft),#fff 45%)}.iea-config-card h3{display:flex;align-items:center;gap:9px;margin:0 0 14px;font-size:15px}.iea-config-card h3 svg{width:20px;height:20px;color:var(--metric)}.iea-config-grid{display:grid;grid-template-columns:repeat(6,minmax(115px,1fr));gap:12px;align-items:end}.iea-config-grid label{display:block;color:#607386;font-size:11px;font-weight:800}.iea-config-grid label .iea-goals-field{width:100%;margin-top:6px}.iea-config-grid .iea-config-message{grid-column:span 3}.iea-goals-check{display:flex!important;align-items:center;gap:8px;min-height:44px;padding:0 4px;color:#17344F!important;white-space:nowrap}.iea-goals-check input{width:18px;height:18px;accent-color:#2563EB}
      .iea-goals-scope{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:16px;padding:14px 16px;border:1px solid #D8E3ED;border-radius:14px;background:#F8FAFC}.iea-goals-scope-copy strong{display:block;font-size:13px}.iea-goals-scope-copy span{display:block;margin-top:4px;color:#64748B;font-size:11px}.iea-goals-segment{display:flex;gap:4px;padding:4px;border-radius:11px;background:#E8EEF5}.iea-goals-segment button{min-height:36px;border:0;border-radius:8px;background:transparent;padding:7px 13px;color:#52677A;font:800 11px Manrope,system-ui;cursor:pointer;white-space:nowrap}.iea-goals-segment button.on{background:#fff;color:#1D4ED8;box-shadow:0 2px 7px rgba(15,41,66,.12)}.iea-goals-help{margin:0 0 15px;color:#64748B;font-size:12px;line-height:1.5}.iea-goals-help b{color:#334155}
      .iea-history-title{margin-bottom:14px}.iea-history{display:grid;gap:10px}.iea-history-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:13px 2px;border-bottom:1px solid #EDF1F3}.iea-history-row:last-child{border:0}.iea-history-row p{margin:0;font-weight:750;font-size:13px}.iea-history-row small{color:#788A98}.iea-goals-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:190px;padding:30px;text-align:center;border:1px solid rgba(99,102,241,.14);border-radius:15px;background:linear-gradient(135deg,#EFF6FF 0%,#F5F3FF 100%);color:#64748B}.iea-empty-trophy{width:58px;height:58px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;border-radius:18px;background:rgba(255,255,255,.8);color:#7C3AED;box-shadow:0 7px 20px rgba(76,29,149,.1)}.iea-empty-trophy svg{width:30px;height:30px}.iea-goals-empty strong{color:#334155;font-size:15px}.iea-goals-empty p{max-width:420px;margin:6px 0 0;font-size:12px;line-height:1.5}
      .iea-goals-error{padding:32px;text-align:center;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:13px}.iea-goals-loading{display:flex;align-items:center;gap:11px;color:#64748B}.iea-goals-loading:before{content:"";width:18px;height:18px;border:2px solid #CBD5E1;border-top-color:#2563EB;border-radius:50%;animation:iea-spin .7s linear infinite}
      .iea-celebration{position:fixed;left:50%;bottom:28px;z-index:260;transform:translateX(-50%);width:min(620px,calc(100vw - 32px));border:1px solid #86EFAC;border-radius:18px;background:#fff;padding:19px 54px 19px 20px;box-shadow:0 20px 60px rgba(7,45,30,.25);color:#123B2A}.iea-celebration h2{margin:0 0 6px;font-size:20px}.iea-celebration p{margin:4px 0;font-size:13px;line-height:1.45}.iea-celebration button{position:absolute;right:14px;top:14px;border:0;border-radius:50%;width:30px;height:30px;background:#EDF7F1;color:#175C39;cursor:pointer;font-size:18px}
      .iea-confetti{position:fixed;inset:0;z-index:255;pointer-events:none;overflow:hidden}.iea-confetti i{position:absolute;top:-20px;width:9px;height:15px;background:var(--color);left:var(--left);animation:iea-confetti-fall var(--duration) cubic-bezier(.15,.65,.35,1) forwards;animation-delay:var(--delay);transform:rotate(var(--rotate))}
      body[data-omtheme='dark'] .iea-goals-screen{background:#0B141A;color:#E9EDEF}body[data-omtheme='dark'] .iea-goals-panel,body[data-omtheme='dark'] .iea-goal-card,body[data-omtheme='dark'] .iea-config-card{border-color:#2A3942;background:#111B21;color:#E9EDEF}body[data-omtheme='dark'] .iea-goals-field,body[data-omtheme='dark'] .iea-goals-btn,body[data-omtheme='dark'] .iea-goals-tab,body[data-omtheme='dark'] .iea-radial:before{border-color:#2A3942;background:#182229;color:#E9EDEF}body[data-omtheme='dark'] .iea-goals-tab.on,body[data-omtheme='dark'] .iea-goals-btn.primary{border-color:#2563EB;background:#2563EB;color:#fff}body[data-omtheme='dark'] .iea-goals-scope{border-color:#2A3942;background:#182229}body[data-omtheme='dark'] .iea-goals-segment{background:#0B141A}body[data-omtheme='dark'] .iea-goals-segment button.on{background:#24333C;color:#BFDBFE}body[data-omtheme='dark'] .iea-goals-head p,body[data-omtheme='dark'] .iea-daily-head p,body[data-omtheme='dark'] .iea-goals-help,body[data-omtheme='dark'] .iea-goals-scope-copy span,body[data-omtheme='dark'] .iea-goal-pace{color:#9AA9B2}body[data-omtheme='dark'] .iea-goal-pace b,body[data-omtheme='dark'] .iea-goals-help b{color:#E9EDEF}body[data-omtheme='dark'] .iea-daily-table th,body[data-omtheme='dark'] .iea-daily-table tbody tr:nth-child(even){background:#182229}body[data-omtheme='dark'] .iea-daily-table tbody tr:hover{background:#202C33}body[data-omtheme='dark'] .iea-daily-table td{border-color:#2A3942}body[data-omtheme='dark'] .iea-goals-empty{background:linear-gradient(135deg,#14253A,#211D38);color:#9AA9B2}body[data-omtheme='dark'] .iea-goals-empty strong{color:#E9EDEF}
      @keyframes iea-spin{to{transform:rotate(360deg)}}@keyframes iea-confetti-fall{to{transform:translate3d(var(--drift),105vh,0) rotate(760deg);opacity:.9}}
      @media(prefers-reduced-motion:reduce){.iea-goal-bar>i,.iea-goals-btn,.iea-goals-tab{transition:none}.iea-goals-loading:before{animation:none}.iea-confetti{display:none}}
      @media(max-width:1100px){.iea-goals-summary,.iea-remuneration{grid-template-columns:1fr}.iea-config-grid{grid-template-columns:repeat(3,1fr)}.iea-config-grid .iea-config-message{grid-column:span 2}}
      @media(max-width:720px){.iea-goals-screen{left:0}.iea-goals-wrap{padding:20px 14px 36px}.iea-goals-head{align-items:flex-start;flex-direction:column}.iea-goals-actions{width:100%;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);justify-content:stretch}.iea-goals-control,.iea-goals-actions>[data-agent]{width:100%;min-width:0}.iea-goals-control .iea-goals-field{width:100%;min-width:0}.iea-goals-actions .iea-goals-btn{justify-self:start}.iea-goals-tabs{overflow:auto;padding-bottom:2px}.iea-goals-two{grid-template-columns:1fr}.iea-conversion{align-items:flex-start}.iea-radial{width:72px;height:72px;flex-basis:72px}.iea-goal-values{grid-template-columns:1fr 1fr}.iea-config-grid{grid-template-columns:1fr}.iea-config-grid .iea-config-message{grid-column:auto}.iea-goals-scope{align-items:stretch;flex-direction:column}.iea-goals-segment{display:grid;grid-template-columns:1fr 1fr}.iea-daily-head{flex-direction:column}.iea-daily-table{min-width:820px}.iea-goals-panel.table-scroll{overflow:auto}.iea-goals-avatar{width:44px;height:44px}.iea-goals-head h1{font-size:24px}.iea-money-table{min-width:650px}.iea-remuneration>.iea-goals-panel:first-child{overflow:auto}}
    `;
    document.head.appendChild(style);
  }

  function closeGoals() {
    if (root) root.remove();
    root = null;
    currentData = null;
    applyToAll = false;
    configDraft = null;
    clearInterval(refreshTimer);
    refreshTimer = null;
    const link = document.querySelector("[data-iea-goals-nav]");
    if (link) link.style.background = "transparent";
    updateScreenUrl("");
  }

  function updateScreenUrl(screen) {
    const url = new URL(window.location.href);
    if (screen) url.searchParams.set("screen", screen);
    else url.searchParams.delete("screen");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
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
    updateScreenUrl("goals");
    loadGoals();
    refreshTimer = window.setInterval(() => {
      if (root && !document.hidden && activeTab === "progress") loadGoals(true);
    }, 15000);
  }

  async function loadGoals(silent) {
    if (!root) return;
    if (!silent) root.innerHTML = `<div class="iea-goals-wrap"><div class="iea-goals-panel iea-goals-loading" role="status">Carregando metas...</div></div>`;
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
    const userName = (currentData.user || {}).name || "Colaborador CRC";
    const agentPicker = currentData.can_configure ? `<select class="iea-goals-field" data-agent aria-label="Atendente">${agents.map(agent => `<option value="${Number(agent.id)}"${String(agent.id) === selectedUserId ? " selected" : ""}>${esc(agent.name)}</option>`).join("")}</select>` : "";
    root.innerHTML = `<div class="iea-goals-wrap">
      <header class="iea-goals-head"><div class="iea-goals-identity"><div class="iea-goals-avatar" aria-hidden="true">${esc(initials(userName))}</div><div><h1>Metas individuais</h1><p>${esc(userName)} · ${esc(currentData.month_label)}</p></div></div><div class="iea-goals-actions">
        ${agentPicker}<label class="iea-goals-control" aria-label="Selecionar mês"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg><input class="iea-goals-field" data-month type="month" value="${esc(selectedMonth)}" aria-label="Mês das metas"></label><button class="iea-goals-btn" data-close><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"></path></svg>Voltar</button>
      </div></header>
      <nav class="iea-goals-tabs" aria-label="Seções de metas" role="tablist"><button class="iea-goals-tab ${activeTab === "progress" ? "on" : ""}" data-tab="progress" role="tab" aria-selected="${activeTab === "progress"}">Acompanhamento</button>${currentData.can_configure ? `<button class="iea-goals-tab ${activeTab === "config" ? "on" : ""}" data-tab="config" role="tab" aria-selected="${activeTab === "config"}">Configuração</button>` : ""}</nav>
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
      const visual = METRIC_VISUALS[item.metric_key] || METRIC_VISUALS.attendances;
      const state = performanceState(m.percentage, m.target, m.reached, m.minimum, m.realized);
      const pace = m.reached ? "Meta mensal atingida" : m.target ? `<b>${number(m.required_per_open_day)}</b> por dia de expediente para fechar o gap` : "Meta mensal ainda não configurada";
      return `<article class="iea-goal-card" data-metric-card="${esc(item.metric_key)}" data-performance="${state.key}" style="--metric:${visual.color};--metric-soft:${visual.soft};--tone:${state.color};--tone-text:${state.text};--tone-soft:${state.soft}"><div class="iea-goal-title"><div class="iea-goal-heading"><span class="iea-metric-icon-box">${metricIcon(item.metric_key)}</span><h2>${esc(item.label)}</h2></div><span class="iea-goal-badge">${state.label}</span></div><div class="iea-goal-bar" role="progressbar" aria-label="${esc(item.label)}: ${percent(m.percentage)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, Number(m.percentage || 0)))}"><i style="width:${width}%"></i></div><div class="iea-goal-values">
        <div><small>Meta</small><strong>${number(m.target)}</strong></div><div><small>Mínimo</small><strong>${number(m.minimum)}</strong></div><div><small>Realizado</small><strong class="featured">${number(m.realized)}</strong></div><div><small>% realizada</small><strong class="featured">${percent(m.percentage)}</strong></div><div><small>Gap</small><strong class="${Number(m.gap || 0) === 0 && Number(m.target || 0) > 0 ? "gap-zero" : ""}">${number(m.gap)}</strong></div><div><small>Recompensa</small><strong class="reward-value">${money(item.reward_cents)}</strong></div>
      </div><p class="iea-goal-pace">${pace}</p></article>`;
    }).join("");
    const conversions = currentData.conversion || {};
    const first = conversions.first_consultation || {};
    const recurring = conversions.recurring || {};
    const schedule = currentData.schedule || {};
    const conversionCard = (key, title, data, description) => {
      const state = conversionState(data.percentage);
      const radialValue = Math.min(100, Math.max(0, Number(data.percentage || 0)));
      return `<article class="iea-goals-panel iea-conversion" data-conversion="${key}" data-performance="${state.key}" style="--tone:${state.color};--tone-text:${state.text};--tone-soft:${state.soft};--value:${radialValue}"><div class="iea-conversion-copy"><span class="iea-conversion-icon"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="m7 15 4-4 3 3 5-7"></path></svg></span><div><h3>${title}</h3><p>${description}</p></div></div><div class="iea-radial" role="img" aria-label="${title}: ${percent(data.percentage)}"><strong>${percent(data.percentage)}</strong></div></article>`;
    };
    const dailyRows = items.map(item => {
      const d = item.daily || {};
      const visual = METRIC_VISUALS[item.metric_key] || METRIC_VISUALS.attendances;
      const state = performanceState(d.percentage, d.target, d.reached, d.minimum, d.realized);
      const width = Math.min(100, Math.max(0, Number(d.percentage || 0)));
      return `<tr data-daily-performance="${state.key}" style="--metric:${visual.color};--tone:${state.color};--tone-text:${state.text};--tone-soft:${state.soft}"><td><span class="iea-daily-indicator"><i class="iea-daily-dot" aria-hidden="true"></i><b>${esc(item.label)}</b></span></td><td>${number(d.target)}</td><td>${number(d.minimum)}</td><td><b>${number(d.realized)}</b></td><td><div class="iea-daily-percent"><b>${percent(d.percentage)}</b><div class="iea-mini-bar" role="progressbar" aria-label="Progresso diário de ${esc(item.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}"><i style="width:${width}%"></i></div></div></td><td>${number(d.gap)}</td><td><span class="iea-status-badge">${state.label}</span></td></tr>`;
    }).join("");
    const remuneration = currentData.remuneration || {};
    const moneyRows = items.map(item => {
      const m = item.monthly || {};
      const visual = METRIC_VISUALS[item.metric_key] || METRIC_VISUALS.attendances;
      const state = performanceState(m.percentage, m.target, m.reached, m.minimum, m.realized);
      const earned = (item.remuneration || {}).earned_cents || 0;
      const progress = Math.min(100, Math.max(0, Number(m.percentage || 0)));
      const payoutThreshold = Number(item.payout_threshold_percent == null ? 75 : item.payout_threshold_percent);
      const status = !Number(item.reward_cents || 0) ? "Configure a recompensa" : earned ? "Recebendo" : `A partir de ${number(payoutThreshold)}%`;
      return `<tr style="--metric:${visual.color};--metric-soft:${visual.soft};--tone:${state.color};--tone-text:${state.text}"><td><span class="iea-money-metric"><i class="iea-money-icon">${metricIcon(item.metric_key)}</i>${esc(item.label)}</span></td><td>${number(m.target)}</td><td>${number(m.realized)}</td><td><span class="iea-money-progress"><b>${percent(m.percentage)}</b><i style="--value:${progress}%"></i></span></td><td>${money(item.reward_cents)}</td><td class="iea-money-earned">${money(earned)}</td><td class="iea-money-status">${status}</td></tr>`;
    }).join("");
    const possible = Number(remuneration.possible_cents || 0);
    const earned = Number(remuneration.earned_cents || 0);
    const totalPercentage = possible ? Math.min(100, Math.round(earned / possible * 100)) : 0;
    return `<section class="iea-goals-summary">${cards}</section>
      <section class="iea-goals-two" style="margin-bottom:18px">${conversionCard("first", "Conversão · Primeira consulta", first, `${number(first.converted)} agendamentos em ${number(first.opportunities)} oportunidades`)}${conversionCard("recurring", "Conversão · Cliente recorrente", recurring, `${number(recurring.converted)} agendamentos em ${number(recurring.opportunities)} retornos sem tratamento`)}</section>
      <section class="iea-remuneration" aria-label="Remuneração variável"><article class="iea-goals-panel"><div class="iea-remuneration-head"><div><h2>Remuneração variável · ${esc(currentData.month_label)}</h2><p>Acompanhamento estimado conforme as regras configuradas para cada indicador.</p></div></div><table class="iea-money-table"><thead><tr><th>Indicador</th><th>Meta</th><th>Realizado</th><th>%</th><th>Recompensa</th><th>Estimativa</th><th>Status</th></tr></thead><tbody>${moneyRows}</tbody></table></article><aside class="iea-goals-panel iea-pay-summary"><div><h2>Seu progresso financeiro</h2><p class="iea-pay-rule">O pagamento é estimado: abaixo do mínimo de pagamento não recebe; até 99,99% é proporcional; em 100% aplica-se o bônus configurado.</p></div><div class="iea-pay-summary-top"><div class="iea-pay-value"><small>Já alcançado</small><strong>${money(earned)}</strong></div><div class="iea-pay-value neutral"><small>Do total possível</small><strong>${totalPercentage}%</strong></div></div><div class="iea-pay-gap"><small>Falta para receber 100%</small><strong>${money(remuneration.remaining_cents)}</strong></div></aside></section>
      <section class="iea-goals-panel table-scroll"><div class="iea-daily-head"><div><h2>Meta do dia</h2><p>${esc(schedule.weekdays)} · ${esc(schedule.saturday)}</p></div><span class="iea-days-card"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>${number(schedule.remaining_open_days)} dias de expediente restantes</span></div><table class="iea-daily-table"><thead><tr><th scope="col">Indicador</th><th scope="col">Meta</th><th scope="col">Mínimo</th><th scope="col">Realizado</th><th scope="col">% realizada</th><th scope="col">Faltam</th><th scope="col">Situação</th></tr></thead><tbody>${dailyRows}</tbody></table></section>
      <section class="iea-goals-panel"><h2 class="iea-history-title">Conquistas recentes</h2><div class="iea-history">${(currentData.history || []).length ? currentData.history.map(row => `<div class="iea-history-row"><div><p>${esc(row.message)}</p><small>${row.achievement_type === "daily" ? "Meta diária" : "Meta mensal"} · ${esc(row.period_key)}</small></div><small>${esc(row.achieved_at)}</small></div>`).join("") : `<div class="iea-goals-empty" data-empty-state><span class="iea-empty-trophy"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"></path><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"></path></svg></span><strong>As metas alcançadas aparecerão aqui.</strong></div>`}</div></section>`;
  }

  function configMarkup() {
    const agents = currentData.agents || [];
    const selectedName = esc((currentData.user || {}).name || "atendente selecionada");
    const scopeDescription = applyToAll
      ? `Os valores abaixo substituirão as metas de ${number(agents.length)} colaboradores operacionais.`
      : `Os valores abaixo serão salvos somente para ${selectedName}.`;
    const cards = (currentData.items || []).map(item => {
      const visual = METRIC_VISUALS[item.metric_key] || METRIC_VISUALS.attendances;
      const draft = configDraft && configDraft[item.metric_key];
      const monthly = draft ? draft.monthly_target : Number((item.monthly || {}).target || 0);
      const monthlyMinimum = draft ? draft.monthly_minimum : Number((item.monthly || {}).minimum || 0);
      const daily = draft ? draft.daily_target : Number((item.daily || {}).target || 0);
      const dailyMinimum = draft ? draft.daily_minimum : Number((item.daily || {}).minimum || 0);
      const reward = draft ? draft.reward_cents : Number(item.reward_cents || 0);
      const payoutThreshold = draft ? draft.payout_threshold_percent : Number(item.payout_threshold_percent || 75);
      const achievementBonus = draft ? draft.achievement_bonus_percent : Number(item.achievement_bonus_percent || 110);
      const message = draft ? draft.celebration_message : (item.celebration_message || "");
      const celebration = draft ? draft.celebration_enabled : item.celebration_enabled;
      return `<article class="iea-config-card" data-metric="${esc(item.metric_key)}" style="--metric:${visual.color};--metric-soft:${visual.soft}"><h3>${metricIcon(item.metric_key)}${esc(item.label)}</h3><div class="iea-config-grid">
        <label>Meta mensal<input class="iea-goals-field" data-monthly type="number" min="0" max="100000" step="1" value="${monthly}"></label>
        <label>Mínimo mensal<input class="iea-goals-field" data-monthly-minimum type="number" min="0" max="100000" step="1" value="${monthlyMinimum}"></label>
        <label>Meta diária<input class="iea-goals-field" data-daily type="number" min="0" max="10000" step="1" value="${daily}"></label>
        <label>Mínimo diário<input class="iea-goals-field" data-daily-minimum type="number" min="0" max="10000" step="1" value="${dailyMinimum}"></label>
        <label>Recompensa a 100% (R$)<input class="iea-goals-field" data-reward type="number" min="0" max="1000000" step="0.01" value="${moneyInput(reward)}"></label>
        <label>Começa a pagar em %<input class="iea-goals-field" data-payout-threshold type="number" min="0" max="100" step="1" value="${payoutThreshold}"></label>
        <label>Bônus a partir de 100%<input class="iea-goals-field" data-achievement-bonus type="number" min="100" max="200" step="1" value="${achievementBonus}"></label>
        <label class="iea-config-message">Mensagem personalizada<input class="iea-goals-field" data-message maxlength="180" value="${esc(message)}" placeholder="Opcional; o CRM inclui o resultado alcançado"></label>
        <label class="iea-goals-check"><input data-celebration type="checkbox" ${celebration ? "checked" : ""}> Comemorar</label>
      </div></article>`;
    }).join("");
    return `<section class="iea-goals-panel"><div class="iea-daily-head"><div><h2>Configurar ${esc(currentData.month_label)}</h2><p>Escolha se esta configuração vale para uma pessoa ou para toda a equipe.</p></div><button class="iea-goals-btn primary" data-save>${applyToAll ? `Aplicar a ${number(agents.length)} colaboradores` : "Salvar meta individual"}</button></div>
      <div class="iea-goals-scope"><div class="iea-goals-scope-copy"><strong>Quem receberá esta configuração?</strong><span>${scopeDescription}</span></div><div class="iea-goals-segment" role="group" aria-label="Escopo da configuração"><button type="button" class="${applyToAll ? "" : "on"}" data-scope="individual" aria-pressed="${!applyToAll}">Somente ${selectedName}</button><button type="button" class="${applyToAll ? "on" : ""}" data-scope="all" aria-pressed="${applyToAll}">Toda a equipe (${number(agents.length)})</button></div></div>
      <p class="iea-goals-help"><b>Meta</b> é o resultado desejado. <b>Mínimo</b> é o piso aceitável — por exemplo: meta diária 50 e mínimo diário 40. <b>Recompensa</b> é o valor-base ao atingir 100%; antes disso o pagamento começa no percentual definido e é proporcional. Use zero para desativar um indicador.</p>
      <div class="iea-goals-config">${cards}</div><div data-save-status role="status" aria-live="polite" style="margin-top:13px;font-size:13px"></div></section>`;
  }

  function bindCommon() {
    root.querySelector("[data-close]").onclick = closeGoals;
    root.querySelector("[data-month]").onchange = event => { configDraft = null; selectedMonth = event.target.value; loadGoals(); };
    const agent = root.querySelector("[data-agent]");
    if (agent) agent.onchange = event => { configDraft = null; applyToAll = false; selectedUserId = event.target.value; loadGoals(); };
    root.querySelectorAll("[data-tab]").forEach(button => {
      button.onclick = () => {
        if (activeTab === "config") configDraft = readConfigValues();
        activeTab = button.dataset.tab;
        render();
      };
    });
  }

  function readConfigValues() {
    const values = {};
    if (!root) return values;
    root.querySelectorAll("[data-metric]").forEach(card => {
      values[card.dataset.metric] = {
        monthly_target: Number(card.querySelector("[data-monthly]").value || 0),
        monthly_minimum: Number(card.querySelector("[data-monthly-minimum]").value || 0),
        daily_target: Number(card.querySelector("[data-daily]").value || 0),
        daily_minimum: Number(card.querySelector("[data-daily-minimum]").value || 0),
        reward_cents: Math.round(Number(card.querySelector("[data-reward]").value || 0) * 100),
        payout_threshold_percent: Number(card.querySelector("[data-payout-threshold]").value || 0),
        achievement_bonus_percent: Number(card.querySelector("[data-achievement-bonus]").value || 0),
        celebration_enabled: card.querySelector("[data-celebration]").checked,
        celebration_message: card.querySelector("[data-message]").value.trim()
      };
    });
    return values;
  }

  function bindConfig() {
    root.querySelectorAll("[data-scope]").forEach(scope => {
      scope.onclick = () => { configDraft = readConfigValues(); applyToAll = scope.dataset.scope === "all"; render(); };
    });
    const button = root.querySelector("[data-save]");
    button.setAttribute("aria-label", "Salvar metas");
    button.onclick = async () => {
      const status = root.querySelector("[data-save-status]");
      const goals = readConfigValues();
      let validationError = "";
      Object.values(goals).forEach(values => {
        if (values.monthly_minimum > values.monthly_target || values.daily_minimum > values.daily_target) {
          validationError = "O mínimo não pode ser maior que a meta.";
        }
        if (values.reward_cents < 0 || values.payout_threshold_percent < 0 || values.payout_threshold_percent > 100 || values.achievement_bonus_percent < 100 || values.achievement_bonus_percent > 200) {
          validationError = "Confira os valores de recompensa e os percentuais de pagamento.";
        }
      });
      if (validationError) {
        status.textContent = validationError;
        status.style.color = "#bd2436";
        return;
      }
      button.disabled = true;
      status.textContent = "Salvando...";
      status.style.color = "#607386";
      try {
        currentData = await request("/api/crm/goals", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: selectedMonth, user_id: Number(selectedUserId), apply_to_all: applyToAll, goals })
        });
        configDraft = null;
        status.textContent = currentData.applied_scope === "all"
          ? `Metas aplicadas a ${number(currentData.applied_user_count)} colaboradores.`
          : "Metas salvas com sucesso.";
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
    notice.innerHTML = `<button type="button" aria-label="Fechar">×</button><h2>🎉 Meta alcançada!</h2>${achievements.map(item => `<p>${esc(item.message)}${Number(item.reward_cents || 0) ? ` <b>Recompensa: ${money(item.reward_cents)}.</b>` : ""}</p>`).join("")}`;
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
    const item = document.createElement("button");
    item.dataset.ieaGoalsNav = "1";
    item.type = "button";
    item.title = "Metas";
    item.style.cssText = "width:56px;min-height:58px;border:0;padding:0;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:transparent;color:rgba(255,255,255,.72);text-decoration:none;font:700 9.5px Manrope,system-ui,sans-serif;gap:5px;margin:2px 0;cursor:pointer";
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
