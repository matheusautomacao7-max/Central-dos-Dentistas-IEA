(function () {
  "use strict";

  if (window.__IEA_CRM_NAVIGATION_ORDER_INSTALLED__) return;
  window.__IEA_CRM_NAVIGATION_ORDER_INSTALLED__ = true;

  const OPERATIONAL_ORDER = ["inbox", "funil", "filas", "metas", "pacientes", "controle"];
  const ADMIN_ORDER = ["gestao", "campanhas", "integracao", "configuracao"];
  const FULL_ORDER = [...OPERATIONAL_ORDER, ...ADMIN_ORDER];

  function normalized(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function exactLabels(item) {
    const values = [item.title, item.getAttribute("aria-label")];
    item.querySelectorAll("span,div").forEach((node) => {
      if (!node.children.length) values.push(node.textContent);
    });
    return values.map(normalized).filter(Boolean);
  }

  function navigationKey(item) {
    if (!(item instanceof HTMLElement)) return "";
    if (item.matches("[data-iea-goals-nav]") || item.querySelector("[data-iea-goals-nav]")) return "metas";
    if (item.matches("[data-iea-patient-control]") || item.querySelector("[data-iea-patient-control]")) return "controle";
    if (item.matches("[data-iea-patients-nav]") || item.querySelector("[data-iea-patients-nav]")) return "pacientes";

    const labels = exactLabels(item);
    const aliases = {
      inbox: "inbox",
      funil: "funil",
      filas: "filas",
      fila: "filas",
      metas: "metas",
      pacientes: "pacientes",
      contatos: "pacientes",
      controle: "controle",
      gestao: "gestao",
      campanhas: "campanhas",
      integracao: "integracao",
      integracoes: "integracao",
      integra: "integracao",
      configuracao: "configuracao",
      config: "configuracao",
    };
    for (const label of labels) {
      if (aliases[label]) return aliases[label];
    }
    return "";
  }

  function directNavigationItem(target) {
    const aside = target && target.closest && target.closest("aside");
    if (!aside) return null;
    let item = target;
    while (item && item.parentElement !== aside) item = item.parentElement;
    return item && item.parentElement === aside ? item : null;
  }

  function updateScreenUrl(screen) {
    const url = new URL(window.location.href);
    if (screen) url.searchParams.set("screen", screen);
    else url.searchParams.delete("screen");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function handleNavigation(event) {
    const actionButton = event.target && event.target.closest && event.target.closest("button");
    if (actionButton) {
      const actionLabel = normalized(actionButton.textContent);
      // Os botões do bundle legado não declaram type="button". Caso algum
      // deles seja remontado dentro de um <form>, o clique submete a página e
      // parece um recarregamento completo do CRM. Cancelamos apenas a ação
      // padrão; o handler SPA original continua recebendo o clique.
      if (["conversar", "abrir conversa", "cancelar"].includes(actionLabel)) {
        event.preventDefault();
      }
    }
    const item = directNavigationItem(event.target);
    const key = navigationKey(item);
    if (!key) return;

    // The CRM sidebar is SPA navigation. A legacy anchor may still appear
    // during a render, but it must never load a new document.
    if (item.tagName === "A") event.preventDefault();

    if (key === "metas" && window.IEACrmGoals && window.IEACrmGoals.open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.IEACrmGoals.open();
      return;
    }
    if (key === "controle" && window.IEACrmOperations && window.IEACrmOperations.openControl) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.IEACrmOperations.openControl();
      updateScreenUrl("patient-control");
      return;
    }

    updateScreenUrl("");
  }

  function leafWithLabel(item, accepted) {
    return Array.from(item.querySelectorAll("span,div")).find((node) =>
      !node.children.length && accepted.includes(normalized(node.textContent))
    );
  }

  function setImportantStyle(element, property, value) {
    if (!element) return;
    const cssProperty = property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    if (element.style.getPropertyValue(cssProperty) === value &&
        element.style.getPropertyPriority(cssProperty) === "important") return;
    element.style.setProperty(cssProperty, value, "important");
  }

  function useCompleteAdminLabels(items) {
    const integration = items.get("integracao");
    const integrationLabel = integration && leafWithLabel(integration, ["integra", "integracao", "integracoes"]);
    if (integrationLabel && integrationLabel.textContent !== "Integração") integrationLabel.textContent = "Integração";
    if (integration) {
      integration.title = "Integração";
      integration.setAttribute("aria-label", "Integração");
    }

    const settings = items.get("configuracao");
    const settingsLabel = settings && leafWithLabel(settings, ["config", "configuracao"]);
    if (settingsLabel && settingsLabel.textContent !== "Configuração") settingsLabel.textContent = "Configuração";
    if (settings) {
      settings.title = "Configuração";
      settings.setAttribute("aria-label", "Configuração");
    }
  }

  function normalizeNavigationItem(item, key) {
    if (!item) return;
    item.dataset.ieaNavigationKey = key;
    const important = {
      width: "64px", minHeight: "54px", height: "auto", margin: "0px auto",
      padding: "7px 3px", boxSizing: "border-box", alignItems: "center",
      justifyContent: "center", gap: "4px", textAlign: "center",
      position: "relative", flex: "0 0 auto",
    };
    Object.entries(important).forEach(([property, value]) => setImportantStyle(item, property, value));
    item.querySelectorAll("svg").forEach(icon => {
      setImportantStyle(icon, "display", "block");
      setImportantStyle(icon, "margin", "0px auto");
      setImportantStyle(icon, "flex", "0 0 auto");
    });
    const label = leafWithLabel(item, [key, key === "integracao" ? "integração" : "", key === "configuracao" ? "configuração" : ""]);
    if (label) {
      setImportantStyle(label, "display", "block");
      setImportantStyle(label, "width", "100%");
      setImportantStyle(label, "margin", "0px");
      setImportantStyle(label, "textAlign", "center");
      setImportantStyle(label, "fontSize", "9.5px");
      setImportantStyle(label, "lineHeight", "1.15");
      setImportantStyle(label, "whiteSpace", "normal");
      setImportantStyle(label, "overflowWrap", "normal");
      setImportantStyle(label, "wordBreak", "normal");
    }
  }

  function adminDivider(aside) {
    let divider = aside.querySelector(":scope > [data-iea-admin-navigation-divider]");
    if (divider) return divider;
    divider = document.createElement("div");
    divider.dataset.ieaAdminNavigationDivider = "1";
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-label", "Navegação administrativa");
    divider.title = "Administração";
    divider.textContent = "ADMIN";
    divider.style.cssText = "width:52px;min-height:15px;display:flex;align-items:center;justify-content:center;margin:5px 0 1px;border-top:1px solid rgba(255,255,255,.18);padding-top:5px;color:rgba(255,255,255,.5);font:800 7px/1 Manrope,system-ui,sans-serif;letter-spacing:.12em;cursor:default;flex:0 0 auto";
    return divider;
  }

  function isDisplayed(item) {
    return Boolean(item && !item.hidden && item.style.display !== "none" && getComputedStyle(item).display !== "none");
  }

  function reorder(aside) {
    const children = Array.from(aside.children);
    const items = new Map();
    children.forEach((item) => {
      const key = navigationKey(item);
      if (key && !items.has(key)) items.set(key, item);
    });
    if (!items.has("inbox")) return;

    useCompleteAdminLabels(items);
    aside.dataset.ieaNavigationRail = "1";
    setImportantStyle(aside, "overflowX", "hidden");
    items.forEach((item, key) => normalizeNavigationItem(item, key));
    const divider = adminDivider(aside);
    const hasVisibleAdmin = ADMIN_ORDER.some((key) => isDisplayed(items.get(key)));
    const dividerDisplay = hasVisibleAdmin ? "flex" : "none";
    // `hidden` sozinho pode perder para o display inline do divisor durante
    // uma atualização concorrente do runtime. O display importante é a fonte
    // visual de verdade; o atributo continua garantindo acessibilidade.
    setImportantStyle(divider, "display", dividerDisplay);
    if (divider.hidden !== !hasVisibleAdmin) divider.hidden = !hasVisibleAdmin;

    const existingNavigation = Array.from(aside.children)
      .map((item) => item === divider ? "admin-divider" : navigationKey(item))
      .filter(Boolean);
    const desiredNavigation = [
      ...OPERATIONAL_ORDER.filter((key) => items.has(key)),
      ...(items.size && ADMIN_ORDER.some((key) => items.has(key)) ? ["admin-divider"] : []),
      ...ADMIN_ORDER.filter((key) => items.has(key)),
    ];
    if (existingNavigation.join("|") === desiredNavigation.join("|")) return;

    const firstNavigation = Array.from(aside.children).find((item) => navigationKey(item));
    if (!firstNavigation) return;
    const marker = document.createComment("iea-navigation-order");
    aside.insertBefore(marker, firstNavigation);
    OPERATIONAL_ORDER.forEach((key) => {
      const item = items.get(key);
      if (item) aside.insertBefore(item, marker);
    });
    if (ADMIN_ORDER.some((key) => items.has(key))) aside.insertBefore(divider, marker);
    ADMIN_ORDER.forEach((key) => {
      const item = items.get(key);
      if (item) aside.insertBefore(item, marker);
    });
    marker.remove();
  }

  function findNavigationAside() {
    return Array.from(document.querySelectorAll("aside")).find((aside) =>
      Array.from(aside.children).some((item) => navigationKey(item) === "inbox")
    );
  }

  let scheduled = false;
  let observedAside = null;
  const permissionObserver = new MutationObserver(maintainOrder);
  function observePermissionChanges(aside) {
    if (observedAside === aside) return;
    permissionObserver.disconnect();
    observedAside = aside;
    permissionObserver.observe(aside, {
      attributes: true,
      subtree: true,
      attributeFilter: ["style", "hidden"],
    });
  }

  function maintainOrder() {
    if (scheduled || document.hidden) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const aside = findNavigationAside();
      if (aside) {
        observePermissionChanges(aside);
        reorder(aside);
      }
    });
  }

  new MutationObserver(maintainOrder).observe(document.body, {
    childList: true,
    subtree: true,
  });
  document.addEventListener("click", handleNavigation, true);
  maintainOrder();
  window.IEACrmNavigationOrder = { maintain: maintainOrder, operational: OPERATIONAL_ORDER, admin: ADMIN_ORDER, full: FULL_ORDER };
})();
