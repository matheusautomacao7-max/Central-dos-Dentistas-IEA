(function () {
  "use strict";
  if (window.__ieaAccessibilityBridgeInstalled) return;
  window.__ieaAccessibilityBridgeInstalled = true;

  document.documentElement.lang = "pt-BR";
  var style = document.createElement("style");
  style.id = "iea-crm-accessibility";
  style.textContent = [
    ":where(button,a,input,select,textarea,[role='button'],[tabindex]):focus-visible{outline:3px solid #2563eb!important;outline-offset:2px!important}",
    "@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}",
    ".iea-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}"
  ].join("");
  document.head.appendChild(style);

  var currentDialog = null;
  var restoreFocus = null;
  var scheduled = false;

  function textOf(element) {
    return String(element && (element.getAttribute("aria-label") || element.textContent) || "")
      .replace(/\s+/g, " ").trim();
  }

  function labelButtons(root) {
    root.querySelectorAll("button").forEach(function (button) {
      if (button.textContent.trim() === "×") {
        button.setAttribute("aria-label", "Fechar janela");
        return;
      }
      if (textOf(button)) return;
      var title = button.getAttribute("title");
      if (title) {
        button.setAttribute("aria-label", title);
        return;
      }
      var styleText = String(button.getAttribute("style") || "").toLowerCase();
      var parentText = textOf(button.parentElement).toLowerCase();
      if (parentText.indexOf("digite uma mensagem") >= 0 || button.parentElement && button.parentElement.querySelector("input[placeholder*='mensagem' i]")) {
        button.setAttribute("aria-label", "Enviar mensagem");
      } else if (styleText.indexOf("239,68,68") >= 0 || styleText.indexOf("#ef4444") >= 0) {
        button.setAttribute("aria-label", "Cancelar gravação de áudio");
      } else if (parentText.match(/\d+:\d+/) && (styleText.indexOf("#25d366") >= 0 || styleText.indexOf("37,211,102") >= 0)) {
        button.setAttribute("aria-label", "Enviar áudio gravado");
      }
    });
  }

  function labelFields(root) {
    root.querySelectorAll("input,select,textarea").forEach(function (field) {
      if (field.getAttribute("aria-label") || field.getAttribute("aria-labelledby")) return;
      var placeholder = field.getAttribute("placeholder");
      var previous = field.previousElementSibling;
      var label = placeholder || textOf(previous);
      if (label) field.setAttribute("aria-label", label.slice(0, 120));
    });
  }

  function findDialog() {
    return Array.from(document.body.querySelectorAll("div")).find(function (element) {
      var css = String(element.getAttribute("style") || "").replace(/\s+/g, "").toLowerCase();
      return css.indexOf("position:fixed") >= 0 && css.indexOf("inset:0") >= 0 &&
        css.indexOf("align-items:center") >= 0 && element.firstElementChild;
    }) || null;
  }

  function configureDialog(overlay) {
    var dialog = overlay && overlay.firstElementChild;
    if (!dialog) return;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
    var heading = dialog.querySelector("h1,h2,h3,[style*='font-size:20px'],[style*='font-size:18px']");
    if (heading) {
      if (!heading.id) heading.id = "iea-dialog-title-" + Math.random().toString(36).slice(2, 9);
      dialog.setAttribute("aria-labelledby", heading.id);
    } else if (!dialog.getAttribute("aria-label")) {
      dialog.setAttribute("aria-label", "Janela do CRM");
    }
    if (currentDialog !== dialog) {
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      currentDialog = dialog;
      var initial = dialog.querySelector("input:not([type='hidden']),select,textarea,button,[tabindex='0']");
      window.setTimeout(function () { (initial || dialog).focus({ preventScroll: true }); }, 0);
    }
  }

  function enhance() {
    scheduled = false;
    labelButtons(document);
    labelFields(document);
    var overlay = findDialog();
    if (overlay) {
      configureDialog(overlay);
    } else if (currentDialog) {
      currentDialog = null;
      if (restoreFocus && restoreFocus.isConnected) restoreFocus.focus({ preventScroll: true });
      restoreFocus = null;
    }
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(enhance);
  }

  document.addEventListener("keydown", function (event) {
    if (!currentDialog || !currentDialog.isConnected) return;
    if (event.key === "Escape") {
      var close = Array.from(currentDialog.querySelectorAll("button")).find(function (button) {
        return /^(cancelar|fechar|×)/i.test(textOf(button));
      });
      if (close) {
        event.preventDefault();
        close.click();
      }
      return;
    }
    if (event.key !== "Tab") return;
    var focusable = Array.from(currentDialog.querySelectorAll(
      "button:not([disabled]),a[href],input:not([disabled]):not([type='hidden']),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])"
    )).filter(function (element) { return element.offsetParent !== null; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });

  new MutationObserver(scheduleEnhance).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  scheduleEnhance();
})();
