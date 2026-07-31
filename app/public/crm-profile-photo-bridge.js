/*
 * Camada visual leve para avatares do CRM.
 * O template principal \u00e9 um bundle e pode ser atualizado sem perder este comportamento.
 */
(function () {
  'use strict';

  var photoByName = new Map();
  var photoByPhone = new Map();
  var refreshInFlight = false;
  var decorateTimer = null;
  var lastRefreshAt = 0;
  var visibleObserver = null;

  function normalize(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  }

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function inboxVisible() {
    if (document.hidden) return false;
    return Array.from(document.querySelectorAll('h1,h2')).some(function (node) {
      return normalize(node.textContent) === 'conversas';
    });
  }

  function loadAvatar(avatar, photoUrl) {
    if (!avatar || !photoUrl || avatar.dataset.ieaProfilePhoto === photoUrl) return;
    var image = new Image();
    image.decoding = 'async';
    image.onload = function () {
      avatar.dataset.ieaProfilePhoto = photoUrl;
      avatar.style.backgroundImage = 'url("' + photoUrl.replace(/"/g, '%22') + '")';
      avatar.style.backgroundPosition = 'center';
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundRepeat = 'no-repeat';
      avatar.style.color = 'transparent';
      avatar.style.textShadow = 'none';
    };
    image.src = photoUrl;
  }

  function setAvatar(avatar, photoUrl) {
    if (!avatar || !photoUrl || avatar.dataset.ieaProfilePhoto === photoUrl) return;
    avatar.dataset.ieaPendingPhoto = photoUrl;
    if (!visibleObserver) {
      visibleObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          visibleObserver.unobserve(entry.target);
          loadAvatar(entry.target, entry.target.dataset.ieaPendingPhoto);
        });
      }, { rootMargin: '180px 0px' });
    }
    visibleObserver.observe(avatar);
  }

  function isAvatar(element) {
    if (!element || !['DIV', 'SPAN'].includes(element.tagName)) return false;
    var style = window.getComputedStyle(element);
    var radius = String(style.borderRadius || '');
    var width = Number.parseFloat(style.width || '0');
    var height = Number.parseFloat(style.height || '0');
    return (radius.indexOf('%') >= 0 || radius.indexOf('999') >= 0 || radius.indexOf('50') >= 0) &&
      width >= 24 && width <= 130 && height >= 24 && height <= 130;
  }

  function decoratePhotosNow() {
    if (!photoByName.size || !inboxVisible()) return;
    // Elementos de texto sem filhos cobrem os nomes da lista, cabeçalho e
    // painel lateral sem caminhar por todos os contêineres da aplicação.
    var textNodes = document.querySelectorAll('span, strong, h2, h3, p');
    textNodes.forEach(function (label) {
      if (label.children.length) return;
      var labelText = normalize(label.textContent);
      var phone = digits(label.textContent);
      var photoUrl = photoByName.get(labelText) || (phone.length >= 8 ? photoByPhone.get(phone.slice(-8)) : '');
      if (!photoUrl) return;
      // Já resolvido para esta mesma URL: pula a varredura cara dos pais.
      if (label.dataset.ieaPhotoResolved === photoUrl) return;
      label.dataset.ieaPhotoResolved = photoUrl;
      var parent = label.parentElement;
      for (var level = 0; parent && level < 5; level += 1, parent = parent.parentElement) {
        var children = Array.from(parent.querySelectorAll('div, span'));
        var avatar = children.find(isAvatar);
        if (avatar) {
          setAvatar(avatar, photoUrl);
          break;
        }
      }
    });
  }

  function decoratePhotos() {
    // Uma tela com muitos cartões dispara dezenas de mutações de DOM por
    // segundo (poll de outros bridges, re-render do bundle etc.). Sem essa
    // fila por quadro de animação, cada mutação individual disparava um novo
    // varredura completa da página — essa era a causa da lentidão percebida
    // com listas grandes (ex.: funil com 140+ cartões).
    if (decorateTimer) window.clearTimeout(decorateTimer);
    decorateTimer = window.setTimeout(function () {
      decorateTimer = null;
      decoratePhotosNow();
    }, 160);
  }

  async function refreshPhotos() {
    if (refreshInFlight || !inboxVisible() || Date.now() - lastRefreshAt < 45000) return;
    refreshInFlight = true;
    try {
      var response = await fetch('/api/crm/conversations?view=active', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      var data = await response.json();
      window.__ieaCrmConversationItems = data.items || [];
      window.__ieaCrmConversationItemsAt = Date.now();
      (data.items || []).forEach(function (item) {
        if (item.name && item.contact_id) {
          var url = item.profile_picture_url || ('/api/crm/contacts/' + item.contact_id + '/profile-photo');
          photoByName.set(normalize(item.name), url);
          var phone = digits(item.phone);
          if (phone.length >= 8) photoByPhone.set(phone.slice(-8), url);
        }
      });
      lastRefreshAt = Date.now();
      decoratePhotos();
    } catch (_) {
      // O CRM continua normalmente, apenas preserva as iniciais enquanto a foto n\u00e3o estiver dispon\u00edvel.
    } finally {
      refreshInFlight = false;
    }
  }

  var observer = new MutationObserver(function () { decoratePhotos(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refreshPhotos();
  window.setInterval(refreshPhotos, 90000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshPhotos();
  });
}());
