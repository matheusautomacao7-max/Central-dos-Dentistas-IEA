import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const navigationScript = await readFile(new URL("../app/public/crm-navigation-order.js", import.meta.url), "utf8");
const resolutionScript = await readFile(new URL("../app/public/crm-resolution-flow.js", import.meta.url), "utf8");
const operationsScript = await readFile(new URL("../app/public/crm-operations-bridge.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");

assert.match(htmlSource, /crm-navigation-order\.js\?v=20260803-sidebar-stability-v2/);
assert.match(htmlSource, /crm-resolution-flow\.js\?v=20260802-spa-navigation-v1/);
assert.ok(htmlSource.lastIndexOf("crm-navigation-order.js") > htmlSource.lastIndexOf("crm-goals.js"));
assert.match(resolutionScript, /<circle cx="12" cy="7" r="4"><\/circle><path d="M20 21a8 8 0 0 0-16 0"><\/path>/);
assert.match(resolutionScript, /style="display:block;flex:0 0 22px;margin:0 auto"/);
assert.doesNotMatch(resolutionScript, /<circle cx="9" cy="7" r="3"><\/circle>/);

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/crm-navigation-order.js")) {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(navigationScript);
  }
  if (request.url.startsWith("/crm-resolution-flow.js")) {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(resolutionScript);
  }
  if (request.url.startsWith("/crm-operations-bridge.js")) {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(operationsScript);
  }
  if (request.url.startsWith("/api/crm/permissions")) {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ feature_scope_enabled: false, allowed_features: [] }));
  }
  if (request.url.startsWith("/api/admin/crm-channel-access")) {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ users: [], channels: [] }));
  }
  if (request.url.startsWith("/api/crm/patient-control")) {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ summary: {}, items: [], categories: [], outcomes: [] }));
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><body>
    <aside style="width:80px;display:flex;flex-direction:column">
      <div data-logo>Logo</div><div data-search>Busca</div>
      <a href="/reload?screen=inbox" data-nav><span>Inbox</span></a>
      <a href="/reload?screen=queue" data-nav><span>Filas</span></a>
      <a href="/reload?screen=funnel" data-nav><span>Funil</span></a>
      <a href="/reload?screen=management" data-nav><span>Gestão</span></a>
      <a href="/reload?screen=contacts" data-nav data-iea-patients-nav><span>Pacientes</span></a>
      <a href="/reload?screen=campaigns" data-nav><span>Campanhas</span></a>
      <a href="/reload?screen=integrations" data-nav><span>Integra</span></a>
      <a href="/reload?screen=settings" data-nav><span>Config</span></a>
      <button type="button" data-nav data-iea-goals-nav><span>Metas</span></button>
      <div style="flex:1"></div>
    </aside>
    <form action="/unexpected-reload"><button data-open-conversation>Abrir conversa</button></form>
    <script>
      window.clicks=0; window.goalsOpened=0;
      window.IEACrmGoals={open:()=>window.goalsOpened++};
      document.querySelectorAll('[data-nav]')[2].addEventListener('click',()=>window.clicks++);
    </script>
    <script src="/crm-resolution-flow.js?v=20260802-spa-navigation-v1"></script>
    <script src="/crm-operations-bridge.js?v=20260802-spa-navigation-v1"></script>
    <script src="/crm-navigation-order.js?v=20260802-spa-navigation-v1"></script>
  </body></html>`);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const installedBrowsers = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = installedBrowsers.find((path) => existsSync(path));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.locator("[data-iea-patient-control]").waitFor();
  await page.waitForFunction(() => document.querySelector("[data-iea-admin-navigation-divider]"));
  const order = await page.locator("aside > [data-nav], aside > [data-iea-patient-control], aside > [data-iea-admin-navigation-divider]").evaluateAll((nodes) =>
    nodes.map((node) => node.dataset.ieaAdminNavigationDivider ? "ADMIN" : node.textContent.trim())
  );
  assert.deepEqual(order, ["Inbox", "Funil", "Filas", "Metas", "Pacientes", "Controle", "ADMIN", "Gestão", "Campanhas", "Integração", "Configuração"]);

  const controlGeometry = await page.locator("[data-iea-patient-control]").evaluate((control) => {
    const item = control.getBoundingClientRect();
    const icon = control.querySelector("svg").getBoundingClientRect();
    return {
      deltaX: Math.abs((item.left + item.width / 2) - (icon.left + icon.width / 2)),
      width: icon.width,
      height: icon.height,
      label: control.getAttribute("aria-label"),
    };
  });
  assert.ok(controlGeometry.deltaX <= 0.5, `control icon must be centered; delta=${controlGeometry.deltaX}`);
  assert.deepEqual(controlGeometry, { deltaX: 0, width: 22, height: 22, label: "Controle" });

  const alignment = await page.locator("aside > [data-iea-navigation-key]").evaluateAll(nodes => nodes.map(node => {
    const item = node.getBoundingClientRect();
    const icon = node.querySelector("svg")?.getBoundingClientRect();
    const label = Array.from(node.querySelectorAll("span,div")).find(child => !child.children.length)?.getBoundingClientRect();
    const center = item.left + item.width / 2;
    return {
      key: node.dataset.ieaNavigationKey,
      iconDelta: icon ? Math.abs(center - (icon.left + icon.width / 2)) : 0,
      labelDelta: label ? Math.abs(center - (label.left + label.width / 2)) : 0,
    };
  }));
  alignment.forEach(item => {
    assert.ok(item.iconDelta <= 0.5, `${item.key} icon must be centered`);
    assert.ok(item.labelDelta <= 0.5, `${item.key} label must be centered`);
  });

  await page.getByRole("button", { name: "Abrir conversa" }).click();
  assert.equal(new URL(page.url()).pathname, "/", "patient start actions must never submit the page");
  assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation").length), 1);

  const styleMutations = await page.evaluate(async () => {
    const aside = document.querySelector("aside");
    let count = 0;
    const observer = new MutationObserver(records => {
      count += records.filter(record => record.type === "attributes" && record.attributeName === "style").length;
    });
    observer.observe(aside, { attributes: true, subtree: true, attributeFilter: ["style"] });
    await new Promise(resolve => setTimeout(resolve, 250));
    observer.disconnect();
    return count;
  });
  assert.ok(styleMutations <= 2, `sidebar must settle instead of looping style mutations; received ${styleMutations}`);

  await page.getByText("Funil", { exact: true }).click();
  assert.equal(await page.evaluate(() => window.clicks), 1, "reordering must preserve existing event listeners");
  assert.equal(new URL(page.url()).pathname, "/", "sidebar navigation must not load another document");
  assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation").length), 1);

  for (const label of ["Inbox", "Filas", "Pacientes", "Gestão", "Campanhas", "Integração", "Configuração"]) {
    await page.getByText(label, { exact: true }).click();
    assert.equal(new URL(page.url()).pathname, "/", `${label} must keep SPA navigation`);
    assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation").length), 1);
  }

  await page.getByText("Metas", { exact: true }).click();
  assert.equal(await page.evaluate(() => window.goalsOpened), 1);
  await page.getByText("Controle", { exact: true }).click();
  await page.getByRole("heading", { name: "Controle de pacientes" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("screen"), "patient-control");
  assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation").length), 1);

  await page.locator("[data-iea-goals-nav]").evaluate((item) => {
    const legacy = document.createElement("a");
    legacy.href = "/central-crc/whatsapp?screen=goals";
    legacy.dataset.ieaGoalsNav = "1";
    legacy.innerHTML = "<span>Metas</span>";
    item.replaceWith(legacy);
  });
  await page.getByText("Metas", { exact: true }).click();
  assert.equal(await page.evaluate(() => window.goalsOpened), 2, "a remounted legacy link must still use SPA navigation");
  assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation").length), 1);

  await page.locator("aside > [data-nav]").evaluateAll((nodes) => {
    for (const node of nodes) {
      if (["Gestão", "Campanhas", "Integração", "Configuração"].includes(node.textContent.trim())) node.style.display = "none";
    }
    window.IEACrmNavigationOrder.maintain();
  });
  await page.waitForFunction(() => document.querySelector("[data-iea-admin-navigation-divider]").hidden);
  assert.equal(await page.locator("[data-iea-admin-navigation-divider]").isVisible(), false);
  console.log("crm-navigation-order-e2e-ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
