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

  function html(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  async function getJson(url) {
    var response = await fetch(url, { headers: { Accept: 'application/json' } });
    var body = await response.text();
    var data = body ? JSON.parse(body) : {};
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os dados.');
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
      '.iea-team-row{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line,#e6eaee);border-radius:13px;padding:14px;background:var(--panel,#fff);transition:box-shadow .15s ease}',
      '.iea-team-row:hover{box-shadow:0 6px 18px rgba(17,36,61,.06)}',
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
      all.onclick = function () { clickOriginalChannel('Todos os canais'); closeModal(); };
      holder.appendChild(all);
      (data.items || []).forEach(function (channel) {
        var label = channel.display_name || channel.instance_name;
        var card = buildChannelCard(label, channel.phone || channel.instance_name || '', channelAvatarColor(label), !!channel.sync_enabled);
        card.onclick = function () { clickOriginalChannel(label); closeModal(); };
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

  function clickOriginalChannel(label) {
    var element = Array.from(document.querySelectorAll('[data-iea-channel-pill]')).find(function (item) { return item.dataset.ieaChannelLabel === label; });
    if (element) {
      element.dataset.ieaChannelBypass = '1';
      element.click();
      window.setTimeout(function () { delete element.dataset.ieaChannelBypass; }, 0);
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
        var row = document.createElement('article');
        row.className = 'iea-team-row';
        row.innerHTML = '<div><strong style="display:block">' + html(item.name || 'Contato interno') + '</strong><small style="display:block;margin-top:4px;color:var(--text3,#63758a)">' + html(item.phone || '') + ' · ' + html(item.channel_name || '') + '</small><small style="display:block;margin-top:5px;color:var(--text2,#63758a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:410px">' + html(item.snippet || 'Sem mensagem recente') + '</small></div><span style="font-size:12px;font-weight:800;color:#167a48;background:#e7f7ee;padding:5px 9px;border-radius:20px;flex:0 0 auto">TIME</span>';
        holder.appendChild(row);
      });
    } catch (error) {
      holder.innerHTML = '<p style="color:#b4232f">' + html(error.message) + '</p>';
    }
  }

  function addControls() {
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
    Array.from(container.querySelectorAll('button,[role="button"]')).forEach(function (button) {
      if (!button.dataset.ieaChannelPill) {
        button.dataset.ieaChannelPill = '1';
        button.dataset.ieaChannelLabel = button.textContent.trim();
      }
    });
    if (!container.querySelector('[data-iea-team-button]')) {
      var team = document.createElement('button');
      team.type = 'button'; team.dataset.ieaTeamButton = '1'; team.textContent = 'Time interno';
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

  function boot() {
    addControls();
    if (!hydrated) hydrated = true;
  }
  observer = new MutationObserver(function () { window.requestAnimationFrame(boot); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(boot, 300);
}());
