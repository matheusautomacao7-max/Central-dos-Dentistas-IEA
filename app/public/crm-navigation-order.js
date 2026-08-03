(function () {
  "use strict";

  // CRM_NAVIGATION_COMPACT_RAIL_V3
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
    descendants(item, "span,div,p,small,strong,label").forEach((node) => {
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
    const navigationAnchor = event.target && event.target.closest && event.target.closest("a");
    if (item.tagName === "A" || (navigationAnchor && item.contains(navigationAnchor))) event.preventDefault();

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
    return descendants(item, "span,div,p,small,strong,label").find((node) =>
      !node.children.length && accepted.includes(normalized(node.textContent))
    );
  }

  function descendants(root, selector) {
    const result = [];
    const visit = (container) => {
      Array.from(container && container.children || []).forEach((child) => {
        if (child.matches(selector)) result.push(child);
        visit(child);
        if (child.shadowRoot) visit(child.shadowRoot);
      });
    };
    visit(root);
    return result;
  }

  function navigationTextLeaves(item) {
    return descendants(item, "span,div,p,small,strong,label")
      .filter((node) => !node.children.length && normalized(node.textContent));
  }

  function visibleNavigationSurface(item) {
    if (!item) return null;
    // O runtime do bundle pode inserir <sc-if>/<sc-scope> entre o <aside>
    // e o div clicável. Procurar apenas o primeiro filho estiliza o wrapper e
    // deixa ícone/texto reais com a aparência padrão (preta e desalinhada).
    const candidates = [item, ...descendants(item, "a,button,div,[role='button'],[role='tab']")];
    return candidates.find((candidate) =>
      candidate.matches("a,button,div,[role='button'],[role='tab']") &&
      candidate.querySelector("svg") &&
      navigationTextLeaves(candidate).length > 0
    ) || candidates.find((candidate) => candidate.matches("a,button,div,[role='button'],[role='tab']")) || item;
  }

  function setImportantStyle(element, property, value) {
    if (!element) return;
    const cssProperty = property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    if (element.style.getPropertyValue(cssProperty) === value &&
        element.style.getPropertyPriority(cssProperty) === "important") return;
    element.style.setProperty(cssProperty, value, "important");
  }

  // Visibilidade vem das permissões. Por isso `display` nunca pode ser
  // importante: um item ocultado pelo CRM precisa continuar oculto.
  function setLayoutStyle(element, property, value) {
    if (!element) return;
    const cssProperty = property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    if (element.style.getPropertyValue(cssProperty) === value &&
        element.style.getPropertyPriority(cssProperty) === "") return;
    element.style.setProperty(cssProperty, value);
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

  function useCompleteOperationalLabels(items) {
    const patients = items.get("pacientes");
    const patientLabel = patients && leafWithLabel(patients, ["contatos", "pacientes"]);
    if (patientLabel && patientLabel.textContent !== "Pacientes") patientLabel.textContent = "Pacientes";
    if (patients) {
      patients.title = "Pacientes";
      patients.setAttribute("aria-label", "Pacientes");
    }
  }

  function normalizeNavigationItem(item, key) {
    if (!item) return;
    item.dataset.ieaNavigationKey = key;
    const important = {
      width: "74px", minWidth: "74px", maxWidth: "74px", minHeight: "54px", height: "auto", margin: "0px auto",
      padding: "7px 3px", boxSizing: "border-box", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: "4px", textAlign: "center",
      position: "relative", flex: "0 0 auto", overflow: "hidden", color: "rgba(255,255,255,.76)",
    };
    const surface = visibleNavigationSurface(item);
    if (surface.style.display !== "none") setLayoutStyle(surface, "display", "flex");
    Object.entries(important).forEach(([property, value]) => setImportantStyle(surface, property, value));
    descendants(item, "svg").forEach(icon => {
      setImportantStyle(icon, "display", "block");
      setImportantStyle(icon, "margin", "0px auto");
      setImportantStyle(icon, "flex", "0 0 auto");
      setImportantStyle(icon, "color", "rgba(255,255,255,.76)");
    });
    const labelAliases = {
      inbox: ["inbox"], filas: ["filas", "fila"], funil: ["funil"], metas: ["metas"],
      pacientes: ["pacientes", "contatos"], controle: ["controle"], gestao: ["gestao"],
      campanhas: ["campanhas"], integracao: ["integra", "integracao", "integrações"],
      configuracao: ["config", "configuracao"],
    };
    const labels = navigationTextLeaves(item);
    const preferredLabel = leafWithLabel(item, labelAliases[key] || [key]);
    if (preferredLabel && !labels.includes(preferredLabel)) labels.push(preferredLabel);
    labels.forEach((label) => {
      label.dataset.ieaNavigationLabel = key;
      setImportantStyle(label, "display", "block");
      setImportantStyle(label, "width", "68px");
      setImportantStyle(label, "maxWidth", "68px");
      setImportantStyle(label, "margin", "0px");
      setImportantStyle(label, "textAlign", "center");
      setImportantStyle(label, "fontSize", label.textContent.trim().length > 8 ? "8.25px" : "9.5px");
      setImportantStyle(label, "lineHeight", "1.15");
      setImportantStyle(label, "whiteSpace", "nowrap");
      setImportantStyle(label, "overflow", "hidden");
      setImportantStyle(label, "textOverflow", "clip");
      setImportantStyle(label, "overflowWrap", "normal");
      setImportantStyle(label, "wordBreak", "keep-all");
      setImportantStyle(label, "color", "rgba(255,255,255,.76)");
    });
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

    useCompleteOperationalLabels(items);
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
