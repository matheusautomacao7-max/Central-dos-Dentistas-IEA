(function () {
  "use strict";
  if (window.__ieaCollaboratorProfileInstalled) return;
  window.__ieaCollaboratorProfileInstalled = true;

  var THEME_KEY = "iea.crm.theme";
  var currentUser = null;
  var currentProfileId = null;
  var overlay = null;
  var scheduled = false;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() : "IEA";
  }

  function request(url, options) {
    return fetch(url, Object.assign({credentials:"same-origin", headers:{Accept:"application/json"}}, options || {}))
      .then(function (response) {
        return response.text().then(function (raw) {
          var data = {};
          try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
          if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
          return data;
        });
      });
  }

  function icon(name) {
    var paths = {
      trophy:'<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"></path><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"></path>',
      medal:'<circle cx="12" cy="8" r="5"></circle><path d="m8.5 12-2 9 5.5-3 5.5 3-2-9"></path>',
      star:'<path d="m12 2 3 6.1 6.7 1-4.8 4.7 1.1 6.7-6-3.2-6 3.2 1.1-6.7-4.8-4.7 6.7-1L12 2Z"></path>',
      heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"></path>',
      target:'<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>',
      sparkles:'<path d="m12 3-1.2 3.8L7 8l3.8 1.2L12 13l1.2-3.8L17 8l-3.8-1.2L12 3Z"></path><path d="m5 13-.8 2.2L2 16l2.2.8L5 19l.8-2.2L8 16l-2.2-.8L5 13ZM19 14l-.7 2.3L16 17l2.3.7L19 20l.7-2.3L22 17l-2.3-.7L19 14Z"></path>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.trophy) + '</svg>';
  }

  function injectStyle() {
    if (document.getElementById("iea-collaborator-profile-style")) return;
    var style = document.createElement("style");
    style.id = "iea-collaborator-profile-style";
    style.textContent = [
      ".iea-cp-trigger{cursor:pointer!important;outline:none}.iea-cp-trigger:focus-visible{box-shadow:0 0 0 3px #93c5fd!important}",
      ".iea-cp-overlay{--cp-bg:#f3f6fa;--cp-panel:#fff;--cp-soft:#f8fafc;--cp-text:#0f2740;--cp-muted:#64748b;--cp-line:#dbe4ee;position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:24px;background:rgba(6,19,32,.58);font-family:Manrope,system-ui,sans-serif}",
      "body[data-omtheme='dark'] .iea-cp-overlay{--cp-bg:#0b141a;--cp-panel:#111b21;--cp-soft:#182229;--cp-text:#e9edef;--cp-muted:#9aa9b2;--cp-line:#2a3942;background:rgba(0,0,0,.72)}",
      ".iea-cp-dialog{width:min(920px,96vw);max-height:min(860px,92vh);overflow:auto;border:1px solid var(--cp-line);border-radius:22px;background:var(--cp-bg);color:var(--cp-text);box-shadow:0 28px 90px rgba(3,15,27,.34)}",
      ".iea-cp-top{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid var(--cp-line);background:var(--cp-panel)}",
      ".iea-cp-top strong{font-size:17px}.iea-cp-close{width:42px;height:42px;border:1px solid var(--cp-line);border-radius:12px;background:var(--cp-soft);color:var(--cp-text);font-size:21px;cursor:pointer}",
      ".iea-cp-loading,.iea-cp-error{min-height:360px;display:grid;place-items:center;padding:40px;text-align:center;color:var(--cp-muted)}",
      ".iea-cp-body{padding:22px;display:grid;gap:18px}.iea-cp-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:132px minmax(0,1fr) 220px;align-items:start;gap:24px;padding:26px;border:1px solid var(--cp-line);border-radius:18px;background:var(--cp-panel)}",
      ".iea-cp-hero:before{content:'';position:absolute;inset:0 auto 0 0;width:5px;background:linear-gradient(#2563eb,#7c3aed)}.iea-cp-avatar{width:132px;height:164px;display:grid;place-items:center;overflow:hidden;border:1px solid color-mix(in srgb,#2563eb 24%,var(--cp-line));border-radius:18px;color:#fff;background:linear-gradient(145deg,#2563eb,#7c3aed);box-shadow:0 14px 30px rgba(37,99,235,.2);font-size:32px;font-weight:900}.iea-cp-avatar img{width:100%;height:100%;object-fit:cover;object-position:center top}",
      ".iea-cp-profile-main{min-width:0}.iea-cp-identity h1{margin:0 0 5px;font-size:25px}.iea-cp-identity p{margin:0;color:var(--cp-muted);font-size:13px}.iea-cp-role{display:inline-flex;margin-top:11px;padding:6px 10px;border-radius:999px;color:#1d4ed8;background:#dbeafe;font-size:11px;font-weight:800}body[data-omtheme='dark'] .iea-cp-role{color:#bfdbfe;background:#1e3a5f}",
      ".iea-cp-trophy-zone{margin-top:20px;padding-top:16px;border-top:1px solid var(--cp-line)}.iea-cp-trophy-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}.iea-cp-trophy-head strong{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--cp-muted)}.iea-cp-trophy-count{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:22px;padding:0 7px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-size:10px;font-weight:900}body[data-omtheme='dark'] .iea-cp-trophy-count{background:#28234a;color:#c4b5fd}.iea-cp-trophy-shelf{display:flex;align-items:flex-start;gap:10px;overflow:auto;padding:2px 2px 7px}.iea-cp-trophy{width:76px;flex:0 0 76px;display:grid;justify-items:center;gap:7px;text-align:center;color:var(--cp-text)}.iea-cp-trophy-icon{width:48px;height:48px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--accent) 22%,transparent);border-radius:15px;color:var(--accent);background:color-mix(in srgb,var(--accent) 11%,var(--cp-panel));box-shadow:0 6px 15px color-mix(in srgb,var(--accent) 13%,transparent)}.iea-cp-trophy-icon svg{width:25px;height:25px}.iea-cp-trophy b{width:100%;font-size:9.5px;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.iea-cp-trophy-empty{display:flex;align-items:center;gap:9px;color:var(--cp-muted);font-size:11px}.iea-cp-trophy-empty svg{width:25px;height:25px;color:#7c3aed}",
      ".iea-cp-picker{display:grid;gap:6px;min-width:210px}.iea-cp-picker label,.iea-cp-field label{color:var(--cp-muted);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.iea-cp-picker select,.iea-cp-field input,.iea-cp-field textarea,.iea-cp-field select{width:100%;min-height:42px;padding:10px 12px;border:1px solid var(--cp-line);border-radius:10px;color:var(--cp-text);background:var(--cp-soft);font:600 13px Manrope,system-ui}.iea-cp-field textarea{min-height:82px;resize:vertical}",
      ".iea-cp-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.iea-cp-stat{min-height:94px;padding:15px;border:1px solid var(--cp-line);border-radius:15px;background:var(--cp-panel)}.iea-cp-stat small{display:block;min-height:31px;color:var(--cp-muted);font-size:11px;line-height:1.35}.iea-cp-stat strong{display:block;margin-top:7px;font-size:25px}",
      ".iea-cp-section{padding:22px;border:1px solid var(--cp-line);border-radius:18px;background:var(--cp-panel)}.iea-cp-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.iea-cp-heading h2{margin:0;font-size:18px}.iea-cp-primary,.iea-cp-secondary{min-height:42px;padding:0 15px;border-radius:11px;font:800 12px Manrope,system-ui;cursor:pointer}.iea-cp-primary{border:0;color:#fff;background:#2563eb}.iea-cp-secondary{border:1px solid var(--cp-line);color:var(--cp-text);background:var(--cp-soft)}",
      ".iea-cp-form{display:grid;grid-template-columns:1fr 180px;gap:12px;margin:0 0 18px;padding:16px;border-radius:14px;background:var(--cp-soft)}.iea-cp-field.full{grid-column:1/-1}.iea-cp-form-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:9px}.iea-cp-status{grid-column:1/-1;min-height:18px;color:#16a34a;font-size:12px;font-weight:700}.iea-cp-status.error{color:#ef4444}",
      ".iea-cp-recognitions{display:grid;gap:11px}.iea-cp-recognition{display:grid;grid-template-columns:42px minmax(0,1fr);gap:13px;padding:15px;border:1px solid var(--cp-line);border-left:4px solid var(--accent);border-radius:14px;background:var(--cp-soft)}.iea-cp-recognition-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}.iea-cp-recognition-icon svg{width:21px;height:21px}.iea-cp-recognition h3{margin:0 0 4px;font-size:14px}.iea-cp-recognition p{margin:0;color:var(--cp-muted);font-size:12px;line-height:1.5}.iea-cp-recognition small{display:block;margin-top:8px;color:var(--cp-muted);font-size:10px}.iea-cp-empty{display:grid;justify-items:center;gap:9px;padding:34px;border:1px dashed var(--cp-line);border-radius:14px;color:var(--cp-muted);text-align:center}.iea-cp-empty svg{width:34px;height:34px;color:#7c3aed}",
      "@media(max-width:820px){.iea-cp-hero{grid-template-columns:118px minmax(0,1fr);gap:18px}.iea-cp-avatar{width:118px;height:148px}.iea-cp-picker{grid-column:1/-1}}",
      "@media(max-width:760px){.iea-cp-overlay{padding:0}.iea-cp-dialog{width:100%;height:100%;max-height:none;border:0;border-radius:0}.iea-cp-body{padding:14px}.iea-cp-hero{grid-template-columns:92px minmax(0,1fr);padding:18px;gap:14px}.iea-cp-avatar{width:92px;height:116px;font-size:23px}.iea-cp-identity h1{font-size:21px}.iea-cp-trophy-zone{grid-column:1/-1;margin-top:16px}.iea-cp-picker{grid-column:1/-1}.iea-cp-stats{grid-template-columns:repeat(2,1fr)}.iea-cp-form{grid-template-columns:1fr}.iea-cp-field.full,.iea-cp-form-actions,.iea-cp-status{grid-column:1}}",
      "@media(prefers-reduced-motion:reduce){.iea-cp-overlay *{scroll-behavior:auto!important;transition:none!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function formatDate(value) {
    if (!value) return "";
    var parsed = new Date(String(value).replace(" ", "T") + (String(value).includes("T") ? "" : "-04:00"));
    return isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"short",year:"numeric"}).format(parsed);
  }

  function profileMarkup(data) {
    var profile = data.profile || {};
    var stats = profile.stats || {};
    var role = profile.crm_access_level === "admin" ? "Administrador do CRM" : "Atendente do CRM";
    var photo = profile.photo_url ? '<img src="' + esc(profile.photo_url) + '" alt="Foto de ' + esc(profile.name) + '">' : esc(initials(profile.name));
    var picker = data.can_manage ? '<div class="iea-cp-picker"><label for="iea-cp-collaborator">Visualizar colaborador</label><select id="iea-cp-collaborator">' + (data.collaborators || []).map(function (item) {
      return '<option value="' + Number(item.id) + '"' + (Number(item.id) === Number(profile.id) ? ' selected' : '') + '>' + esc(item.name) + ' · ' + (item.crm_access_level === "admin" ? "Admin" : "Atendente") + '</option>';
    }).join("") + '</select></div>' : "";
    var statItems = [
      ["Atendimentos ativos", stats.active_count], ["Finalizados no mês", stats.resolved_month],
      ["Atendimentos no mês", stats.attendances_month], ["Primeiras consultas", stats.first_consultations],
      ["Recuperações", stats.recoveries]
    ];
    var trophyShelf = (data.achievements || []).map(function (item) {
      return '<div class="iea-cp-trophy" style="--accent:' + esc(item.accent_color || "#2563EB") + '" title="' + esc(item.title) + '"><span class="iea-cp-trophy-icon">' + icon(item.icon_key) + '</span><b>' + esc(item.title) + '</b></div>';
    }).join("");
    var recognitions = (data.achievements || []).map(function (item) {
      var meta = item.source === "manual" ? "Destaque criado por " + (item.awarded_by || "Gestão") : "Conquista automática de meta";
      return '<article class="iea-cp-recognition" style="--accent:' + esc(item.accent_color || "#2563EB") + '"><span class="iea-cp-recognition-icon">' + icon(item.icon_key) + '</span><div><h3>' + esc(item.title) + '</h3><p>' + esc(item.description || "Conquista reconhecida pelo Instituto Eduardo Ayub.") + '</p><small>' + esc(meta) + ' · ' + esc(formatDate(item.awarded_at)) + '</small></div></article>';
    }).join("");
    var form = data.can_manage ? '<form class="iea-cp-form" id="iea-cp-form" hidden><div class="iea-cp-field full"><label for="iea-cp-title">Título da conquista</label><input id="iea-cp-title" maxlength="80" required placeholder="Ex.: Excelência no atendimento"></div><div class="iea-cp-field full"><label for="iea-cp-description">Mensagem de reconhecimento</label><textarea id="iea-cp-description" maxlength="240" placeholder="Descreva por que esse colaborador merece o destaque."></textarea></div><div class="iea-cp-field"><label for="iea-cp-icon">Símbolo</label><select id="iea-cp-icon"><option value="trophy">Troféu</option><option value="medal">Medalha</option><option value="star">Estrela</option><option value="heart">Cuidado</option><option value="target">Meta</option><option value="sparkles">Destaque</option></select></div><div class="iea-cp-field"><label for="iea-cp-color">Cor</label><select id="iea-cp-color"><option value="#2563EB">Azul</option><option value="#7C3AED">Roxo</option><option value="#F59E0B">Laranja</option><option value="#16A34A">Verde</option><option value="#EF4444">Vermelho</option><option value="#0891B2">Turquesa</option></select></div><div class="iea-cp-status" id="iea-cp-status" role="status" aria-live="polite"></div><div class="iea-cp-form-actions"><button class="iea-cp-secondary" type="button" id="iea-cp-cancel">Cancelar</button><button class="iea-cp-primary" type="submit">Publicar conquista</button></div></form>' : "";
    return '<div class="iea-cp-body"><section class="iea-cp-hero"><div class="iea-cp-avatar">' + photo + '</div><div class="iea-cp-profile-main"><div class="iea-cp-identity"><h1>' + esc(profile.name) + '</h1><p>' + esc(profile.email) + ' · ' + esc(profile.service_sector || "CRC") + '</p><span class="iea-cp-role">' + esc(role) + '</span></div><div class="iea-cp-trophy-zone"><div class="iea-cp-trophy-head"><strong>Troféus em destaque</strong><span class="iea-cp-trophy-count">' + Number((data.achievements || []).length) + '</span></div><div class="iea-cp-trophy-shelf">' + (trophyShelf || '<div class="iea-cp-trophy-empty">' + icon("trophy") + '<span>Nenhuma conquista ainda.</span></div>') + '</div></div></div>' + picker + '</section><section class="iea-cp-stats">' + statItems.map(function (item) { return '<div class="iea-cp-stat"><small>' + esc(item[0]) + '</small><strong>' + Number(item[1] || 0) + '</strong></div>'; }).join("") + '</section><section class="iea-cp-section"><div class="iea-cp-heading"><div><h2>Mensagens de reconhecimento</h2></div>' + (data.can_manage ? '<button class="iea-cp-primary" id="iea-cp-add" type="button">+ Criar reconhecimento</button>' : '') + '</div>' + form + '<div class="iea-cp-recognitions">' + (recognitions || '<div class="iea-cp-empty">' + icon("trophy") + '<strong>Este perfil ainda não possui conquistas.</strong><span>As mensagens de reconhecimento aparecerão aqui.</span></div>') + '</div></section></div>';
  }

  function bindProfileActions(data) {
    var picker = document.getElementById("iea-cp-collaborator");
    if (picker) picker.addEventListener("change", function () { loadProfile(Number(picker.value)); });
    var add = document.getElementById("iea-cp-add");
    var form = document.getElementById("iea-cp-form");
    var cancel = document.getElementById("iea-cp-cancel");
    if (add) add.setAttribute("aria-label", "+ Criar conquista");
    if (add && form) add.addEventListener("click", function () { form.hidden = false; add.hidden = true; document.getElementById("iea-cp-title").focus(); });
    if (cancel && form && add) cancel.addEventListener("click", function () { form.hidden = true; add.hidden = false; form.reset(); });
    if (form) form.addEventListener("submit", function (event) {
      event.preventDefault();
      var submit = form.querySelector("button[type='submit']");
      var status = document.getElementById("iea-cp-status");
      submit.disabled = true; status.className = "iea-cp-status"; status.textContent = "Publicando reconhecimento…";
      request("/api/crm/profile/achievements", {method:"POST", headers:{Accept:"application/json","Content-Type":"application/json"}, body:JSON.stringify({
        user_id:Number((data.profile || {}).id), title:document.getElementById("iea-cp-title").value.trim(),
        description:document.getElementById("iea-cp-description").value.trim(), icon_key:document.getElementById("iea-cp-icon").value,
        accent_color:document.getElementById("iea-cp-color").value
      })}).then(function () { return loadProfile(Number((data.profile || {}).id)); }).catch(function (error) {
        status.className = "iea-cp-status error"; status.textContent = error.message; submit.disabled = false;
      });
    });
  }

  function loadProfile(userId) {
    currentProfileId = userId || (currentUser && currentUser.id);
    var content = overlay && overlay.querySelector("[data-iea-cp-content]");
    if (!content) return Promise.resolve();
    content.innerHTML = '<div class="iea-cp-loading"><div><strong>Carregando perfil…</strong><p>Buscando resultados e conquistas.</p></div></div>';
    return request("/api/crm/profile?user_id=" + encodeURIComponent(currentProfileId)).then(function (data) {
      content.innerHTML = profileMarkup(data);
      bindProfileActions(data);
    }).catch(function (error) {
      content.innerHTML = '<div class="iea-cp-error"><div><strong>Não foi possível abrir o perfil.</strong><p>' + esc(error.message) + '</p><button class="iea-cp-secondary" type="button" data-iea-cp-retry>Tentar novamente</button></div></div>';
      var retry = content.querySelector("[data-iea-cp-retry]");
      if (retry) retry.addEventListener("click", function () { loadProfile(currentProfileId); });
    });
  }

  function closeProfile() {
    if (!overlay) return;
    var trigger = document.querySelector("[data-iea-cp-trigger='true']");
    overlay.remove(); overlay = null;
    if (trigger) trigger.focus({preventScroll:true});
  }

  function openProfile() {
    if (!currentUser || overlay) return;
    injectStyle();
    overlay = document.createElement("div");
    overlay.className = "iea-cp-overlay";
    overlay.innerHTML = '<section class="iea-cp-dialog" role="dialog" aria-modal="true" aria-labelledby="iea-cp-dialog-title"><header class="iea-cp-top"><strong id="iea-cp-dialog-title">Perfil do colaborador</strong><button class="iea-cp-close" type="button" aria-label="Fechar perfil">×</button></header><div data-iea-cp-content></div></section>';
    document.body.appendChild(overlay);
    overlay.querySelector(".iea-cp-close").addEventListener("click", closeProfile);
    overlay.addEventListener("click", function (event) { if (event.target === overlay) closeProfile(); });
    overlay.querySelector(".iea-cp-close").focus({preventScroll:true});
    loadProfile(Number(currentUser.id));
  }

  function visibleFooterElement(element) {
    var rect = element.getBoundingClientRect();
    return rect.width >= 28 && rect.width <= 100 && rect.height >= 28 && rect.height <= 100 && rect.bottom > window.innerHeight * .55;
  }

  function findAvatar() {
    if (!currentUser) return null;
    var aside = document.querySelector("aside");
    if (!aside) return null;
    var tagged = aside.querySelector("[data-iea-cp-trigger='true']");
    if (tagged) return tagged;
    var expected = initials(currentUser.name);
    var candidates = Array.from(aside.querySelectorAll("div,span")).filter(function (element) {
      return element.children.length === 0 && String(element.textContent || "").trim().toUpperCase() === expected && visibleFooterElement(element);
    });
    if (candidates.length) return candidates[candidates.length - 1];

    // O bundle legado ainda desenha o rodapé com as iniciais fixas "AS".
    // Identifica o avatar pela geometria circular para não depender desse texto.
    var circular = Array.from(aside.querySelectorAll("div")).filter(function (element) {
      if (!visibleFooterElement(element)) return false;
      var style = window.getComputedStyle(element);
      var width = parseFloat(style.width || "0");
      var height = parseFloat(style.height || "0");
      var radius = parseFloat(style.borderTopLeftRadius || "0");
      return width >= 38 && width <= 48 && height >= 38 && height <= 48 && radius >= 18;
    });
    return circular.length ? circular[circular.length - 1] : null;
  }

  function findThemeButton() {
    var aside = document.querySelector("aside");
    if (!aside) return null;
    var svg = Array.from(aside.querySelectorAll("svg")).find(function (item) {
      return item.querySelector('path[d^="M21 12.79"]') || (item.querySelector("circle[cx='12'][cy='12'][r='5']") && item.querySelectorAll("line").length >= 4);
    });
    return svg ? svg.closest("div") : null;
  }

  function enhanceTheme() {
    var button = findThemeButton();
    if (!button || button.dataset.ieaThemeBound) return;
    button.dataset.ieaThemeBound = "true";
    button.setAttribute("role", "button"); button.setAttribute("tabindex", "0");
    button.setAttribute("aria-label", "Alternar modo noturno"); button.setAttribute("title", "Alternar modo noturno");
    button.addEventListener("click", function () {
      var next = document.body.getAttribute("data-omtheme") === "dark" ? "light" : "dark";
      window.setTimeout(function () {
        localStorage.setItem(THEME_KEY, next);
        if (document.body.getAttribute("data-omtheme") !== next) document.body.setAttribute("data-omtheme", next);
      }, 0);
    }, true);
    button.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); button.click(); } });
    var saved = localStorage.getItem(THEME_KEY);
    if ((saved === "dark" || saved === "light") && document.body.getAttribute("data-omtheme") !== saved) {
      button.click();
      window.setTimeout(function () { document.body.setAttribute("data-omtheme", saved); }, 0);
    }
  }

  function persistThemeAttribute() {
    var theme = document.body && document.body.getAttribute("data-omtheme");
    if (theme === "dark" || theme === "light") localStorage.setItem(THEME_KEY, theme);
  }

  function enhanceAvatar() {
    var avatar = findAvatar();
    if (!avatar || avatar.dataset.ieaCpBound) return;
    avatar.dataset.ieaCpBound = "true"; avatar.dataset.ieaCpTrigger = "true";
    avatar.classList.add("iea-cp-trigger"); avatar.setAttribute("role", "button"); avatar.setAttribute("tabindex", "0");
    avatar.setAttribute("aria-label", "Abrir meu perfil e conquistas"); avatar.setAttribute("title", "Abrir perfil");
    setFooterAvatarInitials(avatar, initials(currentUser.name));
  }

  function setFooterAvatarInitials(avatar, value) {
    if (!avatar || !value) return;
    // O indicador de presenÃ§a Ã© um filho do avatar. Substituir textContent
    // removeria esse indicador; trocamos somente o nÃ³ de texto legado ("AS").
    var textNode = Array.from(avatar.childNodes).find(function (node) {
      return node.nodeType === Node.TEXT_NODE && String(node.nodeValue || '').trim();
    });
    if (textNode) {
      textNode.nodeValue = value;
      return;
    }
    if (avatar.children.length === 0) {
      avatar.textContent = value;
      return;
    }
    var label = avatar.querySelector('[data-iea-cp-initials]');
    if (!label) {
      label = document.createElement('span');
      label.dataset.ieaCpInitials = 'true';
      label.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none';
      avatar.style.position = avatar.style.position || 'relative';
      avatar.insertBefore(label, avatar.firstChild);
    }
    label.textContent = value;
  }

  function clickedFooterAvatar(target) {
    if (!currentUser || !(target instanceof Element)) return null;
    var aside = target.closest("aside");
    if (!aside) return null;
    var element = target;
    while (element && element !== aside) {
      if (element.matches("div,span") && visibleFooterElement(element)) {
        var style = window.getComputedStyle(element);
        var width = parseFloat(style.width || "0");
        var height = parseFloat(style.height || "0");
        var radius = parseFloat(style.borderTopLeftRadius || "0");
        if (width >= 38 && width <= 48 && height >= 38 && height <= 48 && radius >= 18) return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  function interceptProfileTrigger(event) {
    var avatar = clickedFooterAvatar(event.target);
    if (!avatar) return;
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    enhanceAvatar();
    openProfile();
  }

  function enhance() { scheduled = false; injectStyle(); enhanceTheme(); enhanceAvatar(); }
  function schedule() { if (scheduled) return; scheduled = true; window.requestAnimationFrame(enhance); }

  document.addEventListener("click", interceptProfileTrigger, true);
  document.addEventListener("keydown", interceptProfileTrigger, true);
  document.addEventListener("keydown", function (event) { if (event.key === "Escape" && overlay) closeProfile(); });
  injectStyle();
  request("/api/auth/status").then(function (payload) { currentUser = payload && payload.user; schedule(); }).catch(function () {});
  new MutationObserver(persistThemeAttribute).observe(document.body, {attributes:true,attributeFilter:["data-omtheme"]});
  new MutationObserver(schedule).observe(document.documentElement, {childList:true,subtree:true});
  schedule();
})();
