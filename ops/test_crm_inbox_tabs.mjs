import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const script = await readFile(new URL("../app/public/crm-team-channel-bridge.js", import.meta.url), "utf8");
const html = await readFile(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");
assert.match(script, /data-iea-inbox-tabs/);
assert.match(script, /data-iea-inbox-tab/);
assert.match(html, /crm-team-channel-bridge\.js\?v=20260803-inbox-tabs-v5/);

const fixture = `<!doctype html><html><body>
    <div id="tabs" style="display:flex;width:360px;overflow:hidden">
      <div role="tab" style="border:1px solid #e9edef">Recentes</div>
      <div role="tab" style="border:1px solid #25d366;color:#15a34a">Fila (10)</div>
      <div role="tab" style="border:1px solid #e9edef">Meus atendimentos</div>
    </div>
  </body></html>`;
const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  const page = await browser.newPage({ viewport: { width: 420, height: 200 } });
  await page.setContent(fixture);
  await page.addScriptTag({ content: script });
  await page.locator("#tabs[data-iea-inbox-tabs]").waitFor();
  await page.waitForFunction(() => document.querySelectorAll("[data-iea-inbox-tab]").length === 4);
  const tabs = await page.locator("#tabs [data-iea-inbox-tab]").evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return { text: node.textContent.trim(), height: node.getBoundingClientRect().height, radius: style.borderRadius, active: node.dataset.ieaActive };
  }));
  assert.equal(tabs.length, 4);
  assert.ok(tabs.every((tab) => Math.abs(tab.height - 40) <= 0.5));
  assert.ok(tabs.every((tab) => tab.radius === "12px"));
  assert.equal(tabs.find((tab) => tab.text.startsWith("Fila")).active, "true");
  assert.equal(tabs.find((tab) => tab.text === "Time").active, "false");
  console.log("crm-inbox-tabs-e2e-ok");
} finally {
  await browser.close();
}
