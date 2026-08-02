import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const navigationScript = await readFile(new URL("../app/public/crm-navigation-order.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");

assert.match(htmlSource, /crm-navigation-order\.js\?v=20260802-navigation-v1/);
assert.ok(htmlSource.lastIndexOf("crm-navigation-order.js") > htmlSource.lastIndexOf("crm-goals.js"));

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/crm-navigation-order.js")) {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(navigationScript);
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><body>
    <aside style="width:80px;display:flex;flex-direction:column">
      <div data-logo>Logo</div><div data-search>Busca</div>
      <div data-nav><span>Inbox</span></div>
      <div data-nav><span>Filas</span></div>
      <div data-nav><span>Funil</span></div>
      <div data-nav><span>Gestão</span></div>
      <div data-nav data-iea-patients-nav><span>Pacientes</span></div>
      <div data-nav><span>Campanhas</span></div>
      <div data-nav data-iea-patient-control><span>Controle</span></div>
      <div data-nav><span>Integra</span></div>
      <div data-nav><span>Config</span></div>
      <a data-nav data-iea-goals-nav><span>Metas</span></a>
      <div style="flex:1"></div>
    </aside>
    <script>window.clicks=0;document.querySelectorAll('[data-nav]')[2].addEventListener('click',()=>window.clicks++);</script>
    <script src="/crm-navigation-order.js?v=20260802-navigation-v1"></script>
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
  await page.waitForFunction(() => document.querySelector("[data-iea-admin-navigation-divider]"));
  const order = await page.locator("aside > [data-nav], aside > [data-iea-admin-navigation-divider]").evaluateAll((nodes) =>
    nodes.map((node) => node.dataset.ieaAdminNavigationDivider ? "ADMIN" : node.textContent.trim())
  );
  assert.deepEqual(order, ["Inbox", "Funil", "Filas", "Metas", "Pacientes", "Controle", "ADMIN", "Gestão", "Campanhas", "Integração", "Configuração"]);

  await page.getByText("Funil", { exact: true }).click();
  assert.equal(await page.evaluate(() => window.clicks), 1, "reordering must preserve existing event listeners");

  await page.locator("aside > [data-nav]").evaluateAll((nodes) => {
    for (const node of nodes) {
      if (["Gestão", "Campanhas", "Integração", "Configuração"].includes(node.textContent.trim())) node.style.display = "none";
    }
  });
  await page.waitForFunction(() => document.querySelector("[data-iea-admin-navigation-divider]").hidden);
  assert.equal(await page.locator("[data-iea-admin-navigation-divider]").isVisible(), false);
  console.log("crm-navigation-order-e2e-ok");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
