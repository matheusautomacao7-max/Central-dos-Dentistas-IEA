/*
 * Controles de operação do Inbox: seletor completo de canais e Time interno.
 * Mantido fora do bundle para não perder os controles quando o aplicativo-base
 * reconstrói a tela durante a navegação.
 */
(function () {
  'use strict';
  if (window.__ieaCrmTeamChannelBridgeInstalled) return;
  window.__ieaCrmTeamChannelBridgeInstalled = true;

  var observer;
  var hydrated = false;
  var internalItems = [];
  var selectedChannelId = '';
  var originalFetch = window.fetch.bind(window);

  window.fetch = function (input, options) {
    try {
      var rawUrl = typeof input === 'string' ? input : input.url;
      var url = new URL(rawUrl, window.location.origin);
      var method = String((options && options.method) || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
      if (selectedChannelId && method === 'GET' && url.origin === window.location.origin &&
          url.pathname === '/api/crm/conversations') {
        url.searchParams.set('channel_id', selectedChannelId);
        input = typeof input === 'string'
          ? url.pathname + url.search + url.hash
          : new Request(url.toString(), input);
      }
    } catch (error) {
      // Se a URL não puder ser analisada, preserva a requisição original.
    }
    return originalFetch(input, options);
  };

  function html(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  async function getJson(url) {
    var response = await fetch(url, { headers: { Accept: 'application/json' } });
    var body = await response.text();
    var data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (error) {
      data = {};
    }
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os dados.');
    return data;
  }

  async function postJson(url, payload) {
    var response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    var body = await response.text();
    var data = {};
    try {
      data = body ? JSON.parse(body) : {};
    } catch (error) {
      data = {};
    }
    if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a mensagem.');
    return data;
  }

  function closeModal() {
    var overlay = document.querySelector('[data-iea-inbox-overlay]');
    if (overlay) overlay.remove();
  }

  function ensureStyles() {
    if (document.getElementById('iea-inbox-modal-styles')) return;
    var style = document.createElement('style');
    style.id = 'iea-inbox-modal-styles';
    style.textContent = [
      '@keyframes ieaModalIn{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}',
      '@keyframes ieaOverlayIn{from{opacity:0}to{opacity:1}}',
      '[data-iea-inbox-overlay]{animation:ieaOverlayIn .15s ease-out}',
      '[data-iea-inbox-overlay] section{animation:ieaModalIn .18s cubic-bezier(.2,.8,.2,1)}',
      '.iea-modal-close{border:none;background:var(--surface2,#eef1f4);border-radius:10px;width:34px;height:34px;font-size:17px;line-height:1;cursor:pointer;color:var(--text3,#7c8b9a);display:flex;align-items:center;justify-content:center;transition:background .15s ease,color .15s ease;flex:0 0 auto}',
      '.iea-modal-close:hover{background:#e2e7eb;color:var(--text,#11243d)}',
      '.iea-channel-card{display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;border:1px solid var(--line,#e6eaee);border-radius:13px;background:var(--panel,#fff);color:var(--text,#11243d);cursor:pointer;font:inherit;transition:border-color .15s ease,box-shadow .15s ease,transform .1s ease}',
      '.iea-channel-card:hover{border-color:#25d366;box-shadow:0 6px 18px rgba(17,36,61,.08);transform:translateY(-1px)}',
      '.iea-channel-card:active{transform:translateY(0)}',
      '.iea-channel-avatar{flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#fff}',
      '.iea-channel-info{min-width:0;flex:1}',
      '.iea-channel-name{display:block;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.iea-channel-meta{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:12px;color:var(--text3,#7c8b9a)}',
      '.iea-status-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto}',
      '.iea-team-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line,#e6eaee);border-radius:13px;padding:14px;background:var(--panel,#fff);transition:border-color .15s ease,box-shadow .15s ease,transform .1s ease}',
      '.iea-team-row:hover{border-color:#25d366;box-shadow:0 6px 18px rgba(17,36,61,.08);transform:translateY(-1px)}',
      '.iea-team-chat{display:flex;flex-direction:column;min-height:420px;max-height:62vh}',
      '.iea-team-messages{flex:1;min-height:280px;overflow:auto;display:flex;flex-direction:column;gap:9px;padding:4px 2px 14px}',
      '.iea-team-message{max-width:82%;padding:9px 11px;border-radius:12px;background:#f1f4f6;align-self:flex-start;font-size:13px;line-height:1.45;overflow-wrap:anywhere}',
      '.iea-team-message.is-out{background:#dcf8e6;align-self:flex-end}',
      '.iea-team-message audio{display:block;width:min(330px,100%);height:36px}',
      '.iea-team-message img{display:block;max-width:280px;max-height:240px;border-radius:9px;object-fit:contain}',
      '.iea-team-message-meta{display:block;margin-top:5px;font-size:10px;color:#718194;text-align:right}',
      '.iea-team-composer{display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--line,#e6eaee)}',
      '.iea-team-composer input{flex:1;min-width:0;padding:11px 13px;border:1px solid var(--line,#dbe3ea);border-radius:12px;font:inherit;outline:none}',
      '.iea-team-composer input:focus{border-color:#25d366;box-shadow:0 0 0 3px rgba(37,211,102,.12)}',
      '.iea-team-send{border:0;border-radius:12px;padding:0 18px;background:#18a957;color:#fff;font-weight:800;cursor:pointer}',
      '.iea-team-back{border:0;background:transparent;color:#167a48;font-weight:800;cursor:pointer;padding:0 0 12px}',
      /* Tabs do inbox: superfÃ­cie leve, estado ativo claro e rolagem discreta
         em larguras menores, sem cortar o Ãºltimo filtro. */
      '[data-iea-inbox-tabs]{display:flex!important;align-items:stretch!important;gap:6px!important;min-width:0!important;padding:2px 0 5px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;overscroll-behavior-x:contain}',
      '[data-iea-inbox-tabs]::-webkit-scrollbar{display:none}',
      '[data-iea-inbox-tabs] [data-iea-inbox-tab]{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:38px!important;max-height:38px!important;flex:0 0 auto!important;gap:5px!important;padding:0 13px!important;border:1px solid transparent!important;border-radius:12px!important;background:transparent!important;color:var(--text2,#667781)!important;font:700 12px/1.15 Manrope,system-ui,sans-serif!important;letter-spacing:-.08px!important;white-space:nowrap!important;box-shadow:none!important;cursor:pointer!important;transition:background .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease!important}',
      '[data-iea-inbox-tabs] [data-iea-inbox-tab]:hover{background:var(--panel2,#f3f6f8)!important;color:var(--text,#11243d)!important}',
      '[data-iea-inbox-tabs] [data-iea-inbox-tab][data-iea-active="true"]{border-color:#22c55e!important;background:#ecfdf3!important;color:#168448!important;box-shadow:inset 0 0 0 1px rgba(34,197,94,.06)!important}',
      '[data-iea-inbox-tabs] [data-iea-inbox-tab]:focus-visible{outline:3px solid rgba(37,211,102,.28)!important;outline-offset:2px!important}',
      '[data-iea-inbox-tabs] [data-iea-team-button]{border-color:#dbe4f0!important;background:#f7f9fc!important;color:#49627c!important}',
      '[data-iea-inbox-tabs] [data-iea-team-button]:hover{border-color:#b8c8d9!important;background:#eef3f8!important;color:#233d57!important}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function modal(title, subtitle, content) {
    closeModal();
    ensureStyles();
    var overlay = document.createElement('div');
    overlay.dataset.ieaInboxOverlay = '1';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(10,20,32,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px';
    var section = document.createElement('section');
    section.style.cssText = 'width:min(680px,96vw);max-height:82vh;overflow:auto;background:var(--panel,#fff);color:var(--text,#11243d);border-radius:18px;box-shadow:0 30px 90px rgba(8,18,32,.32),0 2px 6px rgba(8,18,32,.08)';
    var header = document.createElement('header');
    header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 22px 18px;border-bottom:1px solid var(--line,#eef1f4)';
    header.innerHTML = '<div><strong style="display:block;font-size:19px;letter-spacing:-.2px">' + html(title) + '</strong><small style="display:block;margin-top:6px;color:var(--text3,#7c8b9a);line-height:1.5;font-size:13px">' + html(subtitle) + '</small></div>';
    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'iea-modal-close';
    closeButton.dataset.ieaClose = '1';
    closeButton.textContent = '×';
    header.appendChild(closeButton);
    var body = document.createElement('div');
    body.style.cssText = 'padding:18px 22px 22px';
    body.dataset.ieaModalContent = '1';
    section.appendChild(header);
    section.appendChild(body);
    overlay.appendChild(section);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) closeModal(); });
    closeButton.onclick = closeModal;
    body.appendChild(content);
    document.body.appendChild(overlay);
  }

  function channelAvatarColor(seed) {
    var palette = ['#25d366', '#5148bf', '#1c8fb0', '#d97b2f', '#c2447a', '#3a8f5d'];
    var hash = 0;
    for (var i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }

  async function openChannels() {
    var box = document.createElement('div');
    box.innerHTML = '<div data-iea-channels style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"></div>';
    modal('Canais do CRM', 'Selecione um canal para filtrar as conversas. Os canais ocultos pela largura da tela aparecem todos aqui.', box);
    var holder = box.querySelector('[data-iea-channels]');
    try {
      var data = await getJson('/api/crm/channels');
      var all = buildChannelCard('Todos os canais', '', '#25d366', true);
      all.onclick = function () { clickOriginalChannel(['Todos os canais'], ''); closeModal(); };
      holder.appendChild(all);
      (data.items || []).forEach(function (channel) {
        var label = channel.display_name || channel.instance_name;
        var card = buildChannelCard(label, channel.phone || channel.instance_name || '', channelAvatarColor(label), !!channel.sync_enabled);
        card.onclick = function () {
          clickOriginalChannel([label, channel.instance_name, channel.phone], channel.id);
          closeModal();
        };
        holder.appendChild(card);
      });
    } catch (error) {
      holder.innerHTML = '<p style="color:#b4232f">' + html(error.message) + '</p>';
    }
  }

  function buildChannelCard(name, meta, avatarColor, active) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'iea-channel-card';
    var avatar = document.createElement('span');
    avatar.className = 'iea-channel-avatar';
    avatar.style.background = avatarColor;
    avatar.textContent = (name || '?').trim().charAt(0).toUpperCase();
    var info = document.createElement('span');
    info.className = 'iea-channel-info';
    var title = document.createElement('span');
    title.className = 'iea-channel-name';
    title.textContent = name;
    var metaRow = document.createElement('span');
    metaRow.className = 'iea-channel-meta';
    var dot = document.createElement('span');
    dot.className = 'iea-status-dot';
    dot.style.background = active ? '#1c9f5a' : '#b7c0c9';
    var metaText = document.createElement('span');
    metaText.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    metaText.textContent = meta || (active ? 'Sincronização ativa' : 'Sincronização pausada');
    metaRow.appendChild(dot);
    metaRow.appendChild(metaText);
    info.appendChild(title);
    info.appendChild(metaRow);
    card.appendChild(avatar);
    card.appendChild(info);
    return card;
  }

  function normalized(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  function clickOriginalChannel(labels, channelId) {
    labels = (Array.isArray(labels) ? labels : [labels]).filter(Boolean).map(normalized);
    selectedChannelId = String(channelId || '');
    var element = Array.from(document.querySelectorAll('[data-iea-channel-pill]')).find(function (item) {
      var candidates = [
        item.dataset.ieaChannelLabel,
        item.dataset.channelId,
        item.dataset.id,
        item.textContent
      ].map(normalized);
      return (channelId && candidates.includes(normalized(channelId))) ||
        labels.some(function (label) {
          return candidates.some(function (candidate) {
            return candidate === label || candidate.indexOf(label) >= 0 || label.indexOf(candidate) >= 0;
          });
        });
    });
    if (element) {
      element.dataset.ieaChannelBypass = '1';
      element.click();
      window.setTimeout(function () { delete element.dataset.ieaChannelBypass; }, 0);
      return;
    }
    document.dispatchEvent(new CustomEvent('iea:channel-filter', {
      detail: { channelId: channelId || '', labels: labels }
    }));
    var viewButtons = Array.from(document.querySelectorAll('button,[role=button]')).filter(function (item) {
      var label = normalized(item.textContent);
      return label === 'recentes' || label.indexOf('fila') === 0 || label === 'meus atendimentos';
    });
    var activeView = viewButtons.find(function (item) {
      return item.getAttribute('aria-selected') === 'true' ||
        item.getAttribute('aria-pressed') === 'true' ||
        /(^|\s)(active|selected)(\s|$)/i.test(String(item.className || ''));
    });
    if (activeView || viewButtons[0]) {
      (activeView || viewButtons[0]).click();
    }
  }

  async function openTeam() {
    var box = document.createElement('div');
    box.innerHTML = '<div data-iea-team-list style="display:grid;gap:9px"></div>';
    modal('Time interno', 'Conversas marcadas como Contato interno da clínica. Elas não entram na fila externa, não exigem finalização e continuam disponíveis após o envio da mensagem.', box);
    var holder = box.querySelector('[data-iea-team-list]');
    try {
      var data = await getJson('/api/crm/conversations?view=internal');
      internalItems = data.items || [];
      if (!internalItems.length) {
        holder.innerHTML = '<div style="padding:22px;text-align:center;border:1px dashed var(--line,#dbe3ea);border-radius:10px;color:var(--text3,#63758a)">Nenhuma conversa interna ativa no momento.</div>';
        return;
      }
      internalItems.forEach(function (item) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'iea-team-row';
        row.innerHTML = '<div><strong style="display:block">' + html(item.name || 'Contato interno') + '</strong><small style="display:block;margin-top:4px;color:var(--text3,#63758a)">' + html(item.phone || '') + ' · ' + html(item.channel_name || '') + '</small><small style="display:block;margin-top:5px;color:var(--text2,#63758a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:410px">' + html(item.snippet || 'Sem mensagem recente') + '</small></div><span style="font-size:12px;font-weight:800;color:#167a48;background:#e7f7ee;padding:5px 9px;border-radius:20px;flex:0 0 auto">TIME</span>';
        row.onclick = function () { openTeamConversation(item); };
        holder.appendChild(row);
      });
    } catch (error) {
      holder.innerHTML = '<p style="color:#b4232f">' + html(error.message) + '</p>';
    }
  }

  function renderTeamMessage(item) {
    var bubble = document.createElement('div');
    bubble.className = 'iea-team-message' + (item.direction === 'out' ? ' is-out' : '');
    if (item.message_type === 'audio' && item.media_url) {
      var audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = item.media_url;
      bubble.appendChild(audio);
    } else if (item.message_type === 'image' && item.media_url) {
      var image = document.createElement('img');
      image.src = item.media_url;
      image.alt = item.text || 'Imagem';
      image.style.cssText = 'display:block;max-width:100%;max-height:260px;border-radius:9px';
      bubble.appendChild(image);
    } else {
      var text = document.createElement('div');
      text.textContent = item.text || '[' + (item.message_type || 'mensagem') + ']';
      bubble.appendChild(text);
    }
    var meta = document.createElement('small');
    meta.className = 'iea-team-message-meta';
    var when = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';
    meta.textContent = [item.sender_name || '', when].filter(Boolean).join(' - ');
    bubble.appendChild(meta);
    return bubble;
  }

  async function loadTeamMessages(item, holder) {
    holder.innerHTML = '<div style="padding:24px;text-align:center;color:#63758a">Carregando conversa...</div>';
    try {
      var data = await getJson('/api/crm/conversations/' + item.id + '/messages');
      var messages = data.items || [];
      holder.innerHTML = '';
      if (!messages.length) {
        holder.innerHTML = '<div style="padding:24px;text-align:center;color:#63758a">Nenhuma mensagem nesta conversa.</div>';
        return;
      }
      messages.forEach(function (message) {
        holder.appendChild(renderTeamMessage(message));
      });
      holder.scrollTop = holder.scrollHeight;
    } catch (error) {
      holder.innerHTML = '<p style="color:#b4232f">' + html(error.message) + '</p>';
    }
  }

  function openTeamConversation(item) {
    var box = document.createElement('div');
    box.className = 'iea-team-chat';
    box.innerHTML = '<button type="button" class="iea-team-back">&larr; Voltar ao time</button><div class="iea-team-messages" data-iea-team-messages></div><form class="iea-team-composer"><input type="text" autocomplete="off" placeholder="Digite uma mensagem para o colaborador"><button type="submit" class="iea-team-send">Enviar</button></form>';
    modal(item.name || 'Contato interno', [item.phone || '', item.channel_name || ''].filter(Boolean).join(' - '), box);
    var holder = box.querySelector('[data-iea-team-messages]');
    var form = box.querySelector('form');
    var input = form.querySelector('input');
    var send = form.querySelector('button');
    box.querySelector('.iea-team-back').onclick = openTeam;
    loadTeamMessages(item, holder);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (!text || send.disabled) return;
      send.disabled = true;
      send.textContent = 'Enviando...';
      try {
        await postJson('/api/crm/conversations/' + item.id + '/messages', { text: text });
        input.value = '';
        await loadTeamMessages(item, holder);
        input.focus();
      } catch (error) {
        window.alert(error.message);
      } finally {
        send.disabled = false;
        send.textContent = 'Enviar';
      }
    });
  }

  function addControls() {
    ensureStyles();
    /* O bundle pode renderizar os filtros como button ou como elemento com role=button. */
    var candidates = Array.from(document.querySelectorAll('button,[role="button"]'));
    var allButton = candidates.find(function (button) { return button.textContent.trim() === 'Todos os canais'; });
    var recentButton = candidates.find(function (button) { return button.textContent.trim() === 'Recentes'; });
    var anchor = allButton || recentButton;
    if (!anchor) return;
    if (allButton && allButton.dataset.ieaChannelPill !== '1') {
      allButton.dataset.ieaChannelPill = '1';
      allButton.dataset.ieaChannelLabel = 'Todos os canais';
      allButton.addEventListener('click', function (event) {
        if (allButton.dataset.ieaChannelBypass === '1') return;
        event.preventDefault(); event.stopImmediatePropagation(); openChannels();
      }, true);
    }
    var container = anchor.parentElement;
    container.dataset.ieaInboxTabs = '1';
    Array.from(container.querySelectorAll('button,[role="button"]')).forEach(function (button) {
      if (!button.dataset.ieaChannelPill) {
        button.dataset.ieaChannelPill = '1';
        button.dataset.ieaChannelLabel = button.textContent.trim();
      }
      button.dataset.ieaInboxTab = '1';
      button.dataset.ieaActive = isActiveInboxTab(button) ? 'true' : 'false';
    });
    if (!container.querySelector('[data-iea-team-button]')) {
      var team = document.createElement('button');
      team.type = 'button'; team.dataset.ieaTeamButton = '1'; team.textContent = 'Time';
      team.dataset.ieaInboxTab = '1';
      team.dataset.ieaActive = 'false';
      team.style.cssText = 'display:flex;align-items:center;gap:6px;flex:0 0 auto;padding:5px 11px;border-radius:16px;font-size:12px;font-weight:800;cursor:pointer;border:1px solid #6c63ff;background:#f4f1ff;color:#5148bf';
      team.onclick = openTeam;
      // Fica antes de "Todos os canais" para nunca ser escondido pelo
      // overflow horizontal dos filtros de canal.
      if (allButton && allButton.parentElement === container) {
        container.insertBefore(team, allButton);
      } else {
        anchor.insertAdjacentElement('afterend', team);
      }
    }
  }

  function isActiveInboxTab(button) {
    var source = String(button.getAttribute('style') || '') + ' ' + String(button.className || '');
    return /#25d366|#16a34a|37\s*,\s*211\s*,\s*102|21\s*,\s*163\s*,\s*74/i.test(source);
  }

  /*
   * O bundle do CRM recria os filtros como elementos diferentes conforme a
   * largura da tela (em alguns casos nem sao <button>). Por isso o atalho
   * principal tambem e tratado por delegacao no documento. Assim o clique em
   * "Todos os canais" sempre abre o seletor, independente do layout atual.
   */
  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button,[role="button"],div,span') : null;
    if (!target || target.dataset.ieaChannelBypass === '1') return;
    var label = String(target.textContent || '').replace(/\s+/g, ' ').trim();
    if (label === 'Todos os canais') {
      event.preventDefault();
      event.stopImmediatePropagation();
      openChannels();
    }
  }, true);

  var bootScheduled = false;
  function boot() {
    bootScheduled = false;
    addControls();
    if (!hydrated) hydrated = true;
  }
  function scheduleBoot() {
    if (bootScheduled || document.hidden) return;
    bootScheduled = true;
    window.requestAnimationFrame(boot);
  }
  observer = new MutationObserver(scheduleBoot);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(scheduleBoot, 300);
}());
