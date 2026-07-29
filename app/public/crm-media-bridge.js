/* Reprodutor resiliente para os audios do WhatsApp dentro da conversa.
   Não abre mais sozinho: fica como um botão flutuante discreto que mostra
   quantos áudios a conversa aberta tem; a lista só aparece quando o
   atendente clica no botão. */
(function () {
  'use strict';
  if (window.__ieaCrmMediaBridgeInstalled) return;
  window.__ieaCrmMediaBridgeInstalled = true;

  var lastConversationId = null;
  var currentAudioItems = [];
  var trayOpen = false;
  var originalFetch = window.fetch.bind(window);

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  }

  function formatDuration(value) {
    var seconds = Math.max(0, Math.round(Number(value) || 0));
    if (!seconds) return '';
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function removeTray() {
    var current = document.querySelector('[data-iea-audio-tray]');
    if (current) current.remove();
  }

  function removeButton() {
    var current = document.querySelector('[data-iea-audio-button]');
    if (current) current.remove();
  }

  function renderButton() {
    removeButton();
    if (!currentAudioItems.length) return;
    var button = document.createElement('button');
    button.dataset.ieaAudioButton = '1';
    button.type = 'button';
    button.title = 'Áudios desta conversa';
    button.textContent = '🔊 ' + currentAudioItems.length;
    button.style.cssText = [
      'position:fixed', 'z-index:2147483000', 'right:18px', 'bottom:78px',
      'padding:8px 14px', 'border:1px solid #d8e2e8', 'border-radius:999px',
      'background:#ffffff', 'box-shadow:0 6px 18px rgba(7,29,49,.16)',
      'font-family:inherit', 'font-size:13px', 'font-weight:700', 'color:#173653',
      'cursor:pointer'
    ].join(';');
    button.addEventListener('click', function () {
      trayOpen = !trayOpen;
      if (trayOpen) renderTray(); else removeTray();
    });
    document.body.appendChild(button);
  }

  function renderTray() {
    removeTray();
    if (!trayOpen || !currentAudioItems.length) return;

    var tray = document.createElement('section');
    tray.dataset.ieaAudioTray = '1';
    tray.style.cssText = [
      'position:fixed', 'z-index:2147483000', 'left:calc(50% - 230px)',
      'bottom:78px', 'width:min(460px,calc(100vw - 30px))',
      'max-height:170px', 'overflow:auto', 'padding:10px 12px',
      'border:1px solid #d8e2e8', 'border-radius:14px', 'background:#ffffff',
      'box-shadow:0 12px 30px rgba(7,29,49,.18)', 'font-family:inherit'
    ].join(';');
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px';
    var title = document.createElement('div');
    title.textContent = 'Áudios desta conversa';
    title.style.cssText = 'font-size:12px;font-weight:800;color:#173653';
    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '✕';
    closeButton.title = 'Fechar';
    closeButton.style.cssText = 'border:none;background:none;font-size:14px;color:#60758b;cursor:pointer;line-height:1';
    closeButton.addEventListener('click', function () {
      trayOpen = false;
      removeTray();
    });
    header.appendChild(title);
    header.appendChild(closeButton);
    tray.appendChild(header);

    currentAudioItems.forEach(function (item) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:7px 0';
      var player = document.createElement('audio');
      player.controls = true;
      player.preload = 'metadata';
      player.src = item.media_url;
      player.style.cssText = 'flex:1;min-width:0;height:32px';
      player.addEventListener('error', function () {
        hint.textContent = 'Não foi possível carregar este áudio.';
        hint.style.color = '#b34040';
      });
      var hint = document.createElement('small');
      hint.textContent = [item.sender_name || (item.direction === 'out' ? 'Enviado por você' : 'Recebido'), formatDuration(item.duration_seconds)].filter(Boolean).join(' · ');
      hint.style.cssText = 'display:block;min-width:86px;font-size:10px;color:#60758b';
      row.appendChild(player);
      row.appendChild(hint);
      tray.appendChild(row);
    });
    document.body.appendChild(tray);
  }

  function setAudioItems(messages) {
    currentAudioItems = (messages || []).filter(function (item) {
      return item && item.message_type === 'audio' && item.media_url;
    });
    renderButton();
    if (trayOpen) renderTray(); else removeTray();
  }

  window.fetch = function () {
    var args = arguments;
    return originalFetch.apply(null, args).then(function (response) {
      var url = String(args[0] || '');
      var match = url.match(/\/api\/crm\/conversations\/(\d+)\/messages(?:\?|$)/);
      if (!match || !response || !response.ok) return response;
      var conversationId = match[1];
      response.clone().json().then(function (payload) {
        if (conversationId !== lastConversationId) {
          // Conversa trocou: fecha a bandeja aberta da conversa anterior.
          trayOpen = false;
        }
        lastConversationId = conversationId;
        setAudioItems(payload.items || []);
      }).catch(function () { /* resposta nao e JSON: a conversa segue normal */ });
      return response;
    });
  };

  function conversationVisibleInHeader(name) {
    var wanted = normalize(name);
    if (!wanted) return false;
    return Array.from(document.querySelectorAll('h1,h2,h3,strong,div,span')).some(function (node) {
      if (normalize(node.textContent) !== wanted) return false;
      var rect = node.getBoundingClientRect();
      /* A conversa aberta fica no cabeçalho central; a lista fica abaixo. */
      return rect.top >= 0 && rect.top < 115 && rect.width > 40;
    });
  }

  async function refreshCurrentConversationAudio() {
    try {
      /* Inclui fila e meus atendimentos: o áudio pode estar em qualquer
         uma dessas visões, não somente em atendimentos ativos. */
      var responses = await Promise.all(['active', 'queue', 'mine', 'internal'].map(function (view) {
        return originalFetch('/api/crm/conversations?view=' + view, { headers: { Accept: 'application/json' } });
      }));
      var payloads = await Promise.all(responses.map(function (response) {
        return response.ok ? response.json() : { items: [] };
      }));
      var seen = {};
      var conversations = [];
      payloads.forEach(function (payload) {
        (payload.items || []).forEach(function (item) {
          if (!seen[item.id]) { seen[item.id] = true; conversations.push(item); }
        });
      });
      var current = conversations.find(function (item) { return conversationVisibleInHeader(item.name); });
      if (!current) {
        // Nenhuma conversa aberta no momento (ex.: tela de lista): some com o botão.
        lastConversationId = null;
        trayOpen = false;
        setAudioItems([]);
        return;
      }
      if (String(current.id) === String(lastConversationId)) return;
      trayOpen = false;
      lastConversationId = current.id;
      var messagesResponse = await originalFetch('/api/crm/conversations/' + current.id + '/messages', { headers: { Accept: 'application/json' } });
      if (!messagesResponse.ok) return;
      var messages = (await messagesResponse.json()).items || [];
      setAudioItems(messages);
    } catch (_) {
      /* O chat continua utilizável mesmo se uma sincronização estiver em andamento. */
    }
  }

  window.setInterval(refreshCurrentConversationAudio, 2500);
  window.setTimeout(refreshCurrentConversationAudio, 700);
}());
