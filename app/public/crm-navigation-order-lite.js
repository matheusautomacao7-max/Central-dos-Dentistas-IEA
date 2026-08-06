(function () {
  "use strict";
  if (window.__IEA_CRM_NAVIGATION_ORDER_LITE__) return;
  window.__IEA_CRM_NAVIGATION_ORDER_LITE__ = true;

  const operational = ["inbox", "funil", "filas", "metas", "pacientes", "controle"];
  const admin = ["gestao", "campanhas", "integracao", "configuracao"];
  const aliases = {
    inbox: "inbox", funil: "funil", filas: "filas", fila: "filas", metas: "metas",
    pacientes: "pacientes", contatos: "pacientes", controle: "controle", gestao: "gestao",
    campanhas: "campanhas", integra: "integracao", integracao: "integracao",
    configuracao: "configuracao", config: "configuracao",
  };

  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  let sidebarCached = null;
  let scheduleQueued = false;
  let observedSidebar = null;
  let lastSignature = "";
  let goalsSidebarHandler = null;

  function keyOf(item) {
    if (!(item instanceof HTMLElement)) return "";
    if (item.matches("[data-iea-goals-nav]") || item.querySelector("[data-iea-goals-nav]")) return "metas";
    if (item.matches("[data-iea-patient-control]") || item.querySelector("[data-iea-patient-control]")) return "controle";
    if (item.matches("[data-iea-patients-nav]") || item.querySelector("[data-iea-patients-nav]")) return "pacientes";
    const labels = [item.title, item.getAttribute("aria-label"), item.textContent]
      .map(normalize).filter(Boolean);
    return labels.map(label => aliases[label]).find(Boolean) || "";
  }

  function sidebar() {
    if (sidebarCached && sidebarCached.isConnected) return sidebarCached;
    const found = Array.from(document.querySelectorAll("aside")).find((item) =>
      Array.from(item.children).some((child) => keyOf(child) === "inbox")
    );
    sidebarCached = found || null;
    return sidebarCached;
  }

  function sidebarSignature(aside) {
    if (!aside) return "";
    return Array.from(aside.children).map((child) => keyOf(child) || "").join("|");
  }

  function arrange() {
    const aside = sidebar();
    if (!aside) return;
    const signature = sidebarSignature(aside);
    if (signature === lastSignature) return;
    lastSignature = signature;

    const items = new Map();
    for (const child of Array.from(aside.children)) {
      const key = keyOf(child);
      if (key && !items.has(key)) items.set(key, child);
    }
    if (!items.has("inbox")) return;

    const desired = [...operational, ...admin].filter((key) => items.has(key));
    const current = signature.split("|").filter(Boolean);
    if (current.join("|") === desired.join("|")) return;

    const first = Array.from(aside.children).find((item) => keyOf(item));
    if (!first) return;

    const marker = document.createComment("iea-navigation-order-lite");
    aside.insertBefore(marker, first);
    desired.forEach((key) => {
      const item = items.get(key);
      if (item) aside.insertBefore(item, marker);
    });
    marker.remove();
  }

  function handleGoalsClick(event) {
    if (!event.target.closest("[data-iea-goals-nav]")) return;
    if (!window.IEACrmGoals || typeof window.IEACrmGoals.open !== "function") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.IEACrmGoals.open();
  }

  const sidebarObserver = new MutationObserver(scheduleArrange);
  function observeSidebar() {
    const aside = sidebar();
    if (!aside || aside === observedSidebar) return;
    if (sidebarObserver) sidebarObserver.disconnect();
    if (observedSidebar && goalsSidebarHandler) {
      observedSidebar.removeEventListener("click", goalsSidebarHandler, true);
    }
    observedSidebar = aside;
    if (!goalsSidebarHandler) goalsSidebarHandler = handleGoalsClick;
    observedSidebar.addEventListener("click", goalsSidebarHandler, true);
    sidebarObserver.observe(aside, { childList: true, subtree: true });
  }

  function scheduleArrange() {
    if (scheduleQueued) return;
    scheduleQueued = true;
    requestAnimationFrame(() => {
      scheduleQueued = false;
      observeSidebar();
      arrange();
    });
  }

  const rootObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
        if (!(node instanceof Element)) continue;
        if (node.matches("aside") || node.querySelector("aside")) {
          scheduleArrange();
          return;
        }
      }
      if (mutation.target instanceof Element && mutation.target.matches("aside")) {
        scheduleArrange();
        return;
      }
    }
  });

  rootObserver.observe(document.body, { childList: true });
  scheduleArrange();
})();
