/* Lia — assistente interna do CRM. Nesta fase ela responde apenas a partir da base oficial. */
(function () {
  'use strict';
  if (window.__ieaCrmLiaLoaded) return;
  window.__ieaCrmLiaLoaded = true;

  var state = { data: null, panel: null, body: null, manager: false };
  var SUGGESTIONS = [
    'Melhorar este script de atendimento',
    'Como funciona a meta de recuperação?',
    'Como conduzir uma objeção de preço?',
    'Como abordar um retorno sem tratamento?'
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }
  function icon(name) {
    var paths = {
      spark: '<path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Zm6.2 11.5.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8.8-2.7Z"/>',
      close: '<path d="m7 7 10 10M17 7 7 17"/>',
      back: '<path d="m14 6-6 6 6 6"/>',
      send: '<path d="m4 4 16 8-16 8 3-8-3-8Zm3 8h13"/>',
      edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4"/>',
      book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM4 19h16"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }
  function request(url, options) {
    options = options || {};
    options.credentials = 'same-origin';
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    return fetch(url, options).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) throw new Error(body.error || 'Não foi possível concluir esta ação agora.');
        return body;
      });
    });
  }
  function injectCss() {
    if (document.getElementById('iea-lia-css')) return;
    var style = document.createElement('style');
    style.id = 'iea-lia-css';
    style.textContent = [
      '.iea-lia-launcher{position:fixed;right:22px;bottom:24px;width:54px;height:54px;border:0;border-radius:50%;background:linear-gradient(135deg,#7828f5,#2563eb);color:#fff;box-shadow:0 13px 28px rgba(82,40,219,.33);display:grid;place-items:center;z-index:280;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}',
      '.iea-lia-launcher:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 17px 33px rgba(82,40,219,.42)}.iea-lia-launcher svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}',
      '.iea-lia-panel{position:fixed;right:0;top:0;bottom:0;width:min(410px,100vw);background:#fff;box-shadow:-18px 0 48px rgba(15,23,42,.17);z-index:300;transform:translateX(106%);opacity:0;pointer-events:none;transition:transform .26s cubic-bezier(.2,.8,.2,1),opacity .18s ease;display:flex;flex-direction:column;color:#13243d;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}.iea-lia-panel.is-open{transform:translateX(0);opacity:1;pointer-events:auto}',
      '.iea-lia-head{padding:18px 18px 15px;border-bottom:1px solid #e8edf5;display:flex;align-items:center;gap:11px}.iea-lia-avatar{width:39px;height:39px;display:grid;place-items:center;border-radius:13px;color:#fff;background:linear-gradient(135deg,#7c3aed,#2563eb);box-shadow:0 8px 18px rgba(89,61,221,.25)}.iea-lia-avatar svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.iea-lia-title{font-size:14px;font-weight:800;line-height:1.2}.iea-lia-title small{display:block;margin-top:3px;color:#66758d;font-size:11px;font-weight:500}.iea-lia-head-actions{margin-left:auto;display:flex;gap:6px}.iea-lia-icon-btn{width:34px;height:34px;border:1px solid #dce5f1;background:#fff;border-radius:10px;display:grid;place-items:center;color:#42536c;cursor:pointer}.iea-lia-icon-btn:hover{background:#f5f7fb}.iea-lia-icon-btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.iea-lia-body{flex:1;min-height:0;overflow-y:auto;padding:22px 18px 16px}.iea-lia-intro{border:1px solid #e5e6ff;background:linear-gradient(135deg,#faf8ff,#f7faff);border-radius:16px;padding:15px;color:#596981;font-size:13px;line-height:1.45}.iea-lia-section{margin-top:24px}.iea-lia-section h3{margin:0 0 11px;font-size:12px;text-transform:uppercase;letter-spacing:.055em;color:#4a5871}.iea-lia-suggestions{display:grid;gap:7px}.iea-lia-suggestion{width:100%;border:0;background:transparent;text-align:left;padding:9px 4px;color:#1e293b;font-weight:650;font-size:13px;cursor:pointer}.iea-lia-suggestion:before{content:"↳";margin-right:8px;color:#5b36db;font-size:16px}.iea-lia-suggestion:hover{color:#4f2ed2}',
      '.iea-lia-messages{display:grid;gap:12px}.iea-lia-message{max-width:92%;padding:12px 13px;border-radius:15px;font-size:13px;line-height:1.48;white-space:pre-wrap}.iea-lia-message.user{justify-self:end;color:#fff;background:linear-gradient(135deg,#5b31de,#2563eb);border-bottom-right-radius:5px}.iea-lia-message.assistant{background:#f4f6fb;color:#26364e;border-bottom-left-radius:5px}.iea-lia-source{margin-top:8px;display:inline-flex;align-items:center;gap:5px;border-radius:999px;background:#e9edff;color:#4d39a5;padding:4px 8px;font-size:10px;font-weight:750}.iea-lia-loading{color:#718096;font-size:12px;padding:9px 2px}.iea-lia-error{margin-top:12px;padding:10px 12px;background:#fff2f2;color:#b42318;border-radius:10px;font-size:12px}',
      '.iea-lia-form{padding:13px 14px 15px;border-top:1px solid #e8edf5;background:#fff;display:flex;gap:8px;align-items:flex-end}.iea-lia-form textarea{min-height:48px;max-height:110px;resize:none;flex:1;border:1px solid #d9e2ee;border-radius:12px;padding:13px;font:inherit;font-size:13px;outline:0;color:#27384f}.iea-lia-form textarea:focus{border-color:#6b4ce6;box-shadow:0 0 0 3px rgba(102,75,225,.12)}.iea-lia-send{width:43px;height:43px;border:0;border-radius:12px;background:#5d38df;color:#fff;display:grid;place-items:center;cursor:pointer}.iea-lia-send:disabled{opacity:.45;cursor:not-allowed}.iea-lia-send svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.iea-lia-manager-note{font-size:12px;color:#65758e;line-height:1.45;margin-bottom:15px}.iea-lia-new{width:100%;padding:11px;border:0;border-radius:11px;background:#eef1ff;color:#5332c9;font-weight:800;cursor:pointer}.iea-lia-list{display:grid;gap:9px;margin-top:13px}.iea-lia-article{width:100%;text-align:left;border:1px solid #e1e7f1;background:#fff;border-radius:12px;padding:12px;cursor:pointer}.iea-lia-article:hover{border-color:#bfb7f3;background:#fcfbff}.iea-lia-article strong{display:block;font-size:13px;color:#1d2e46}.iea-lia-article span{display:flex;gap:6px;align-items:center;margin-top:6px;font-size:11px;color:#70809a}.iea-lia-status{border-radius:999px;padding:2px 7px;background:#ecfdf3;color:#137a43;font-weight:800}.iea-lia-status.draft{background:#fff7e6;color:#aa6a00}.iea-lia-status.archived{background:#eef1f5;color:#667085}.iea-lia-field{display:grid;gap:6px;margin-bottom:13px}.iea-lia-field label{font-size:11px;font-weight:800;color:#465875}.iea-lia-field input,.iea-lia-field select,.iea-lia-field textarea{width:100%;box-sizing:border-box;border:1px solid #d9e2ee;border-radius:10px;padding:10px;font:inherit;font-size:13px;outline:0}.iea-lia-field textarea{height:215px;resize:vertical}.iea-lia-save{width:100%;border:0;border-radius:11px;padding:12px;color:#fff;background:#5b36db;font-weight:800;cursor:pointer}',
      '@media(max-width:700px){.iea-lia-launcher{right:16px;bottom:18px}.iea-lia-panel{width:100vw}.iea-lia-body{padding:18px 16px}}'
    ].join('');
    document.head.appendChild(style);
  }
  function ensurePanel() {
    injectCss();
    if (state.panel) return;
    var panel = document.createElement('aside');
    panel.className = 'iea-lia-panel';
    panel.setAttribute('aria-label', 'Lia, assistente interna do CRM');
    panel.innerHTML = '<div class="iea-lia-head"><div class="iea-lia-avatar">' + icon('spark') + '</div><div class="iea-lia-title">Lia <small>Assistente da recepção</small></div><div class="iea-lia-head-actions"><button class="iea-lia-icon-btn" data-lia-manage title="Gerenciar base oficial" aria-label="Gerenciar base oficial">' + icon('book') + '</button><button class="iea-lia-icon-btn" data-lia-close title="Fechar" aria-label="Fechar Lia">' + icon('close') + '</button></div></div><div class="iea-lia-body" data-lia-body></div>';
    document.body.appendChild(panel);
    state.panel = panel;
    state.body = panel.querySelector('[data-lia-body]');
    panel.querySelector('[data-lia-close]').addEventListener('click', close);
    panel.querySelector('[data-lia-manage]').addEventListener('click', showManager);
  }
  function close() { if (state.panel) state.panel.classList.remove('is-open'); }
  function loadKnowledge() {
    return request('/api/crm/lia/knowledge').then(function (data) { state.data = data; return data; });
  }
  function introMarkup() {
    return '<div class="iea-lia-intro"><strong>Como posso ajudar?</strong><br>Uso a base oficial do CRM para orientar scripts, metas e processos. Não envio mensagens nem altera atendimentos.</div>';
  }
  function showChat() {
    state.manager = false;
    var canManage = state.data && state.data.can_manage;
    state.panel.querySelector('[data-lia-manage]').style.display = canManage ? '' : 'none';
    state.body.innerHTML = introMarkup() + '<section class="iea-lia-section"><h3>Sugestões</h3><div class="iea-lia-suggestions">' + SUGGESTIONS.map(function (suggestion) { return '<button class="iea-lia-suggestion" data-lia-suggestion="' + esc(suggestion) + '">' + esc(suggestion) + '</button>'; }).join('') + '</div></section><section class="iea-lia-section"><div class="iea-lia-messages" data-lia-messages></div></section>';
    var form = document.createElement('form');
    form.className = 'iea-lia-form';
    form.innerHTML = '<textarea maxlength="2000" aria-label="Pergunta para Lia" placeholder="Descreva sua dúvida ou peça uma melhoria de script"></textarea><button class="iea-lia-send" type="submit" aria-label="Enviar pergunta">' + icon('send') + '</button>';
    state.panel.appendChild(form);
    state.body.querySelectorAll('[data-lia-suggestion]').forEach(function (button) { button.addEventListener('click', function () { ask(button.getAttribute('data-lia-suggestion')); }); });
    form.addEventListener('submit', function (event) { event.preventDefault(); ask(form.querySelector('textarea').value); });
  }
  function addMessage(kind, text, source) {
    var list = state.body.querySelector('[data-lia-messages]');
    if (!list) return null;
    var message = document.createElement('div');
    message.className = 'iea-lia-message ' + kind;
    message.textContent = text;
    if (source) {
      var chip = document.createElement('div');
      chip.className = 'iea-lia-source';
      chip.textContent = 'Base oficial · ' + source.title;
      message.appendChild(chip);
    }
    list.appendChild(message);
    state.body.scrollTop = state.body.scrollHeight;
    return message;
  }
  function ask(question) {
    var text = String(question || '').trim();
    if (text.length < 3) return;
    var form = state.panel.querySelector('.iea-lia-form');
    var input = form && form.querySelector('textarea');
    var send = form && form.querySelector('button');
    addMessage('user', text);
    if (input) input.value = '';
    if (send) send.disabled = true;
    var loading = document.createElement('div');
    loading.className = 'iea-lia-loading'; loading.textContent = 'Lia está consultando a base oficial…';
    state.body.querySelector('[data-lia-messages]').appendChild(loading);
    request('/api/crm/lia/ask', { method: 'POST', body: JSON.stringify({ question: text }) }).then(function (result) {
      loading.remove();
      addMessage('assistant', result.answer, result.sources && result.sources[0]);
    }).catch(function (error) {
      loading.remove();
      var message = document.createElement('div'); message.className = 'iea-lia-error'; message.textContent = error.message; state.body.appendChild(message);
    }).finally(function () { if (send) send.disabled = false; });
  }
  function showManager() {
    if (!state.data || !state.data.can_manage) return;
    state.manager = true;
    state.panel.querySelector('[data-lia-manage]').style.display = 'none';
    state.body.innerHTML = '<button class="iea-lia-suggestion" data-lia-back>' + icon('back') + ' Voltar para a Lia</button><section class="iea-lia-section"><h3>Base oficial da Lia</h3><p class="iea-lia-manager-note">Somente conteúdos ativos orientam a equipe. Você também controla o uso e orçamento da IA aqui.</p><button class="iea-lia-new" data-lia-settings>Configurar IA e limites</button><button class="iea-lia-new" style="margin-top:8px" data-lia-new>+ Adicionar conteúdo oficial</button><div class="iea-lia-list">' + (state.data.items || []).map(articleMarkup).join('') + '</div></section>';
    var oldForm = state.panel.querySelector('.iea-lia-form'); if (oldForm) oldForm.remove();
    state.body.querySelector('[data-lia-back]').addEventListener('click', showChat);
    state.body.querySelector('[data-lia-settings]').addEventListener('click', showSettings);
    state.body.querySelector('[data-lia-new]').addEventListener('click', function () { showEditor(null); });
    state.body.querySelectorAll('[data-lia-article]').forEach(function (button) { button.addEventListener('click', function () { showEditor((state.data.items || []).filter(function (item) { return String(item.id) === button.getAttribute('data-lia-article'); })[0]); }); });
  }
  function articleMarkup(item) {
    return '<button class="iea-lia-article" data-lia-article="' + esc(item.id) + '"><strong>' + esc(item.title) + '</strong><span>' + esc(item.category) + '<b class="iea-lia-status ' + esc(item.status) + '">' + (item.status === 'active' ? 'Ativo' : item.status === 'draft' ? 'Rascunho' : 'Arquivado') + '</b></span></button>';
  }
  function showEditor(item) {
    var categories = (state.data.categories || []).map(function (category) { return '<option' + (item && item.category === category ? ' selected' : '') + '>' + esc(category) + '</option>'; }).join('');
    state.body.innerHTML = '<button class="iea-lia-suggestion" data-lia-back>' + icon('back') + ' Voltar para conteúdos</button><section class="iea-lia-section"><h3>' + (item ? 'Editar conteúdo' : 'Novo conteúdo oficial') + '</h3><form data-lia-editor><div class="iea-lia-field"><label>Título</label><input name="title" maxlength="140" required value="' + esc(item && item.title) + '" placeholder="Ex.: Como responder à objeção de preço"></div><div class="iea-lia-field"><label>Categoria</label><select name="category">' + categories + '</select></div><div class="iea-lia-field"><label>Conteúdo oficial</label><textarea name="content" maxlength="12000" required placeholder="Escreva a orientação que a Lia poderá repassar à equipe.">' + esc(item && item.content) + '</textarea></div><div class="iea-lia-field"><label>Disponibilidade</label><select name="status"><option value="draft"' + (item && item.status === 'draft' ? ' selected' : '') + '>Rascunho — ainda não usar</option><option value="active"' + (!item || item.status === 'active' ? ' selected' : '') + '>Ativo — disponível à equipe</option><option value="archived"' + (item && item.status === 'archived' ? ' selected' : '') + '>Arquivado — manter histórico</option></select></div><button class="iea-lia-save" type="submit">Salvar conteúdo</button></form></section>';
    state.body.querySelector('[data-lia-back]').addEventListener('click', showManager);
    state.body.querySelector('[data-lia-editor]').addEventListener('submit', function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      var button = form.querySelector('button'); button.disabled = true; button.textContent = 'Salvando…';
      request('/api/crm/lia/knowledge', { method: 'POST', body: JSON.stringify({ id: item && item.id, title: form.title.value, category: form.category.value, content: form.content.value, status: form.status.value }) }).then(function () {
        return loadKnowledge();
      }).then(showManager).catch(function (error) { button.disabled = false; button.textContent = error.message; });
    });
  }
  function showSettings() {
    state.body.innerHTML = '<div class="iea-lia-loading">Carregando controles da Lia…</div>';
    request('/api/crm/lia/settings').then(function (settings) {
      var cost = Number(settings.usage_month && settings.usage_month.estimated_cost_usd || 0).toFixed(2);
      var modelOptions = (settings.models || []).map(function (model) { return '<option value="' + esc(model.id) + '"' + (model.id === settings.model ? ' selected' : '') + '>' + esc(model.label) + '</option>'; }).join('');
      state.body.innerHTML = '<button class="iea-lia-suggestion" data-lia-back>' + icon('back') + ' Voltar para conteúdos</button><section class="iea-lia-section"><h3>Configuração da IA</h3><p class="iea-lia-manager-note">A chave fica somente no servidor.</p><div class="iea-lia-intro"><strong>' + (settings.enabled ? 'Lia ativa' : 'Lia pausada') + '</strong><br>' + (settings.api_configured ? 'API configurada.' : 'Chave da API não encontrada no servidor.') + '<br>Uso do mês: ' + esc(settings.usage_month && settings.usage_month.requests || 0) + ' perguntas · US$ ' + esc(cost) + '</div><form data-lia-settings-form><div class="iea-lia-field"><label><input type="checkbox" name="enabled"' + (settings.enabled ? ' checked' : '') + '> Ativar respostas com IA</label></div><div class="iea-lia-field"><label><input type="checkbox" name="general_assistance"' + (settings.general_assistance ? ' checked' : '') + '> Permitir Assistência geral</label><p class="iea-lia-manager-note">Permite sugestões de scripts e dúvidas abertas quando não existir orientação oficial. A Lia nunca responde pacientes.</p></div><div class="iea-lia-field"><label>Modelo</label><select name="model">' + modelOptions + '</select></div><div class="iea-lia-field"><label>Perguntas por atendente/dia</label><input name="daily" type="number" min="1" max="500" value="' + esc(settings.daily_limit_per_user) + '"></div><div class="iea-lia-field"><label>Limite total por mês</label><input name="monthly" type="number" min="1" max="100000" value="' + esc(settings.monthly_limit_total) + '"></div><div class="iea-lia-field"><label>Teto mensal em US$</label><input name="budget" type="number" min="1" step="1" value="' + esc(Math.round(Number(settings.monthly_budget_cents) / 100)) + '"></div><div class="iea-lia-field"><label>Tamanho máximo da resposta</label><input name="output" type="number" min="80" max="1200" value="' + esc(settings.max_output_tokens) + '"></div><button class="iea-lia-save" type="submit">Salvar controles</button></form></section>';
      state.body.querySelector('[data-lia-back]').addEventListener('click', showManager);
      state.body.querySelector('[data-lia-settings-form]').addEventListener('submit', function (event) {
        event.preventDefault(); var form = event.currentTarget, button = form.querySelector('button'); button.disabled = true; button.textContent = 'Salvando…';
        request('/api/crm/lia/settings', { method: 'POST', body: JSON.stringify({ enabled: form.enabled.checked, general_assistance: form.general_assistance.checked, model: form.model.value, daily_limit_per_user: form.daily.value, monthly_limit_total: form.monthly.value, monthly_budget_cents: Number(form.budget.value) * 100, max_output_tokens: form.output.value }) }).then(showSettings).catch(function (error) { button.disabled = false; button.textContent = error.message; });
      });
      request('/api/crm/lia/usage').then(function (usage) {
        var rows = (usage.items || []).slice(0, 6);
        var audit = document.createElement('section'); audit.className = 'iea-lia-section';
        audit.innerHTML = '<h3>Últimas perguntas</h3><div class="iea-lia-list">' + (rows.length ? rows.map(function (item) { return '<div class="iea-lia-article"><strong>' + esc(item.user_name) + '</strong><span>' + esc(item.question_preview) + ' · US$ ' + esc(Number(item.estimated_cost_usd || 0).toFixed(4)) + '</span></div>'; }).join('') : '<p class="iea-lia-manager-note">Ainda não há perguntas consumindo a API neste mês.</p>') + '</div>';
        state.body.appendChild(audit);
      });
    }).catch(function (error) { state.body.innerHTML = '<div class="iea-lia-error">' + esc(error.message) + '</div>'; });
  }
  function open() {
    ensurePanel();
    state.panel.classList.add('is-open');
    loadKnowledge().then(showChat).catch(function (error) { state.body.innerHTML = '<div class="iea-lia-error">' + esc(error.message) + '</div>'; });
  }
  function mount() {
    injectCss();
    if (document.querySelector('[data-iea-lia-launcher]')) return;
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'iea-lia-launcher'; button.setAttribute('data-iea-lia-launcher', 'true');
    button.setAttribute('aria-label', 'Abrir Lia, assistente interna'); button.title = 'Abrir Lia'; button.innerHTML = icon('spark');
    button.addEventListener('click', open); document.body.appendChild(button);
  }
  window.IEACrmLia = { open: open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
