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

  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
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
    return Array.from(document.querySelectorAll("aside")).find(aside =>
      Array.from(aside.children).some(item => keyOf(item) === "inbox")
    );
  }
  function arrange() {
    const aside = sidebar();
    if (!aside) return;
    const items = new Map();
    Array.from(aside.children).forEach(item => {
      const key = keyOf(item);
      if (key && !items.has(key)) items.set(key, item);
    });
    if (!items.has("inbox")) return;
    const first = Array.from(aside.children).find(item => keyOf(item));
    if (!first) return;
    const marker = document.createComment("iea-navigation-order-lite");
    aside.insertBefore(marker, first);
    [...operational, ...admin].forEach(key => {
      const item = items.get(key);
      if (item) aside.insertBefore(item, marker);
    });
    marker.remove();
  }
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; arrange(); });
  }
  // O botão de Metas é criado pelo módulo próprio. Ao ser reposicionado,
  // mantemos uma abertura delegada para não depender do listener do nó que o
  // runtime eventualmente recriar.
  document.addEventListener("click", event => {
    const goals = event.composedPath().find(node => node instanceof Element && node.matches("[data-iea-goals-nav]"));
    if (!goals || !window.IEACrmGoals || typeof window.IEACrmGoals.open !== "function") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.IEACrmGoals.open();
  }, true);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
