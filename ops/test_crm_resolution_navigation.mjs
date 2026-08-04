import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find(candidate => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(String(error)));

await page.setContent(`<!doctype html><html><body>
  <aside>
    <div data-nav><span>Inbox</span></div>
    <div data-nav><span>Gestão</span></div>
    <div data-nav><div><span>Integra</span></div></div>
  </aside>
</body></html>`);
await page.addScriptTag({ path: fileURLToPath(new URL("../app/public/crm-resolution-flow.js", import.meta.url)) });
await page.locator("[data-iea-patient-control]").waitFor();
await page.waitForTimeout(250);

assert.deepEqual(errors, [], `o atalho Controle gerou exceções: ${errors.join(" | ")}`);
assert.equal(await page.locator("[data-iea-patient-control]").count(), 1);
assert.equal(
  await page.locator("[data-iea-patient-control]").evaluate(element => element.parentElement?.tagName),
  "ASIDE",
);

await browser.close();
console.log("crm-resolution-navigation-e2e-ok");
