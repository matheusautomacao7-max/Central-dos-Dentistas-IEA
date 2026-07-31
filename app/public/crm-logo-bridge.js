(function () {
  'use strict';

  var CRM_LOGO_SRC = '/assets/crm-logo-3d.png';
  var applyScheduled = false;

  function applyCrmLogo() {
    document.querySelectorAll('aside img[alt="Instituto Eduardo Ayub"]').forEach(function (image) {
      var container = image.parentElement;

      if (!container || image.dataset.crmLogo3d === 'true') return;

      image.src = CRM_LOGO_SRC;
      image.dataset.crmLogo3d = 'true';
      image.style.width = '56px';
      image.style.height = '56px';
      image.style.objectFit = 'cover';
      image.style.transform = 'scale(1.58)';
      image.style.transformOrigin = 'center';

      container.style.overflow = 'hidden';
      container.style.borderRadius = '14px';
    });
  }

  function scheduleApplyCrmLogo() {
    if (applyScheduled || document.hidden) return;
    applyScheduled = true;
    window.requestAnimationFrame(function () {
      applyScheduled = false;
      applyCrmLogo();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCrmLogo, { once: true });
  } else {
    applyCrmLogo();
  }

  new MutationObserver(scheduleApplyCrmLogo).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) scheduleApplyCrmLogo();
  });
})();
