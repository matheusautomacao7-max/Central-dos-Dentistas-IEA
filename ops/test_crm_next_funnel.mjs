import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const sourceHtml = await readFile(new URL("../app/public/crm-next.html", import.meta.url), "utf8");
const html = sourceHtml.replace("<head>", '<head><base href="https://crm.test/">');
const scriptPath = fileURLToPath(new URL("../app/public/crm-next.js", import.meta.url));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const page = await browser.newPage();

await page.route("**/api/auth/status", (route) => route.fulfill({ json: { authenticated: true, user: { name: "Teste CRC" } } }));
await page.route("**/api/crm/conversations?view=workspace", (route) => route.fulfill({ json: { items: [] } }));
await page.route("**/api/crm/conversations?view=operational", (route) => route.fulfill({ json: { items: [
  { id: 1, name: "Paciente novo", channel_name: "iea", pipeline_stage: "Novo", status: "Aberta", assigned_to: null },
  { id: 2, name: "Paciente em atendimento", channel_name: "Orto", pipeline_stage: "Em atendimento", status: "Aberta", assigned_to: "Atendente CRC" },
  { id: 3, name: "Paciente resolvido", channel_name: "iea", pipeline_stage: "Resolvido", status: "Resolvida", assigned_to: "Atendente CRC" },
] } }));
await page.route("**/api/crm/conversations?view=active", (route) => route.fulfill({ json: { items: [] } }));

await page.setContent(html);
await page.addScriptTag({ path: scriptPath });
await page.getByRole("button", { name: "Funil" }).click();
await page.waitForFunction(() => document.querySelectorAll(".funnel-card").length === 3);
assert.equal(await page.locator("#funnel-screen").getAttribute("hidden"), null);
assert.equal(await page.locator("#inbox-screen").isVisible(), false);
assert.equal(await page.locator(".funnel-card").count(), 3);
assert.match(await page.locator("#funnel-status").textContent(), /3 atendimentos carregados/);
await browser.close();
console.log("crm-next-funnel-ok");
