import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";


const managementScript = await readFile(new URL("../app/public/crm-management-dashboard.js", import.meta.url), "utf8");
const evolutionScript = await readFile(new URL("../app/public/crm-evolution-bridge.js", import.meta.url), "utf8");
const crmHtml = await readFile(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");

assert.match(crmHtml, /crm-management-dashboard\.js\?v=20260803-live-management-v1/);
assert.match(crmHtml, /crm-evolution-bridge\.js\?v=20260803-campaign-header-v3/);

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname === "/crm-management-dashboard.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(managementScript);
  }
  if (url.pathname === "/crm-evolution-bridge.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(evolutionScript);
  }
  if (url.pathname === "/api/crm/channels") {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ items: [{ id: 9, display_name: "Canal IEA" }] }));
  }
  if (url.pathname === "/api/crm/metrics") {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({
      summary: {
        active: 7, in_service: 3, waiting: 4, unread: 2, unread_messages: 5,
        resolved_today: 6, avg_first_response_minutes: 12.5, avg_resolution_minutes: 73,
      },
      volume: [
        { bucket: "09", label: "09h", total: 3 },
        { bucket: "10", label: "10h", total: 6 },
      ],
      agents: [{
        id: 1, name: "Isabela Cristina", service_sector: "CRC", active: 2,
        resolved_today: 4, avg_first_response_minutes: 8,
      }],
    }));
  }
  if (url.pathname === "/api/crm/conversations") {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ items: [{
      id: 77, name: "Paciente Campanha", phone: "65999990000",
      campaign_name: "", automation_flow: "", tag_names: "Campanha: Confirmação de agenda",
    }] }));
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  if (url.pathname.includes("whatsapp")) {
    return response.end(`<!doctype html><html><body>
      <header style="display:flex;gap:8px"><strong>Paciente Campanha</strong><span>65999990000</span><span data-priority>Média</span></header>
      <script src="/crm-evolution-bridge.js"></script>
    </body></html>`);
  }
  response.end(`<!doctype html><html><body>
    <div style="flex:1;overflow-y:auto"><div><h1>Visão do gestor</h1><p>Legado</p></div></div>
    <script>const nativeFetch=window.fetch.bind(window);window.metricRequests=[];window.fetch=(input,init)=>{const url=typeof input==='string'?input:input.url;if(url.includes('/api/crm/metrics'))window.metricRequests.push(url);return nativeFetch(input,init)};</script>
    <script src="/crm-management-dashboard.js"></script>
  </body></html>`);
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const installedBrowsers = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = installedBrowsers.find(path => existsSync(path));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  const management = await browser.newPage();
  await management.goto(`http://127.0.0.1:${address.port}/management`);
  await management.locator("[data-management-kpis] .iea-management-card").first().waitFor();
  assert.equal(await management.locator("[data-management-kpis] .iea-management-card").first().locator("strong").textContent(), "7");
  assert.equal(await management.locator("[data-management-volume] .iea-management-bar").count(), 2);
  assert.equal(await management.locator("[data-management-agents] tr").count(), 1);
  assert.match(await management.locator("[data-management-agents]").textContent(), /Isabela Cristina/);
  await management.selectOption("[data-management-period]", "7d");
  await management.waitForFunction(() => window.metricRequests.some(url => url.includes("period=7d")));
  assert.equal(await management.evaluate(() => performance.getEntriesByType("navigation").length), 1);

  const campaign = await browser.newPage();
  await campaign.goto(`http://127.0.0.1:${address.port}/central-crc/whatsapp`);
  const badge = campaign.locator("header [data-crm-origin-badge]");
  await badge.waitFor();
  assert.equal(await badge.textContent(), "Campanha: Confirmação de agenda");
  assert.equal(await badge.evaluate(element => element.nextElementSibling?.textContent?.trim()), "Média");
  assert.equal(await badge.getAttribute("data-crm-origin-placement"), "before");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log("crm-management-campaign-ui-regression-ok");
