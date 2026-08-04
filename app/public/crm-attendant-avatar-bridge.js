(function () {
  'use strict';

  var currentUser = null;
  var applyScheduled = false;

  function initialsFromName(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  function isVisible(element) {
    var rect = element.getBoundingClientRect();
    return rect.width >= 28 && rect.width <= 96 &&
      rect.height >= 28 && rect.height <= 96 &&
      rect.bottom > window.innerHeight * 0.55;
  }

  function findFooterAvatar() {
    if (!currentUser) return null;

    var aside = document.querySelector('aside');
    if (!aside) return null;

    var initials = initialsFromName(currentUser.name);
    var candidates = Array.from(aside.querySelectorAll('div, span')).filter(function (element) {
      return element.children.length === 0 &&
        (element.textContent || '').trim().toUpperCase() === initials &&
        isVisible(element);
    });

    return candidates.length ? candidates[candidates.length - 1] : null;
  }

  function applyAttendantPhoto() {
    if (!currentUser || !currentUser.photo_url) return;

    var avatar = findFooterAvatar();
    if (!avatar || avatar.dataset.attendantPhoto === currentUser.photo_url) return;

    avatar.dataset.attendantPhoto = currentUser.photo_url;
    avatar.style.backgroundImage = 'url("' + encodeURI(currentUser.photo_url) + '")';
    avatar.style.backgroundPosition = 'center';
    avatar.style.backgroundRepeat = 'no-repeat';
    avatar.style.backgroundSize = 'cover';
    avatar.style.color = 'transparent';
    avatar.style.textShadow = 'none';
  }

  function scheduleApply() {
    if (applyScheduled || document.hidden) return;
    applyScheduled = true;
    window.requestAnimationFrame(function () {
      applyScheduled = false;
      applyAttendantPhoto();
    });
  }

  function loadCurrentUser() {
    fetch('/api/auth/status', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Nao foi possivel carregar o perfil');
        return response.json();
      })
      .then(function (payload) {
        currentUser = payload && payload.user ? payload.user : null;
        scheduleApply();
      })
      .catch(function () {
        currentUser = null;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCurrentUser, { once: true });
  } else {
    loadCurrentUser();
  }

  new MutationObserver(scheduleApply).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) scheduleApply();
  });

  window.addEventListener('iea:crm-profile-photo-updated', function (event) {
    var detail = event && event.detail ? event.detail : {};
    if (!currentUser || Number(detail.userId) !== Number(currentUser.id) || !detail.photoUrl) return;
    currentUser.photo_url = detail.photoUrl;
    scheduleApply();
  });
})();
