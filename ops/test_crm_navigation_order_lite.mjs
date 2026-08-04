import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const script = await readFile(new URL("../app/public/crm-navigation-order-lite.js", import.meta.url), "utf8");
const operationsScript = await readFile(new URL("../app/public/crm-operations-bridge.js", import.meta.url), "utf8");
const html = await readFile(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");
assert.match(html, /crm-navigation-order-lite\.js\?v=20260803-native-order-v4/);
assert.match(script, /iea-navigation-order-lite/);
assert.doesNotMatch(html, /crm-navigation-order\.js/);

const itemStyle = "display:flex;flex-direction:column;align-items:center;width:60px;min-height:58px;color:white";
const icon = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8"></circle></svg>`;
const item = (tag, id, label, attributes = "") => `<${tag} data-id="${id}" ${attributes} style="${itemStyle}">${icon}<span>${label}</span></${tag}>`;
const fixture = `<!doctype html><style>body{margin:0}aside{width:80px;display:flex;flex-direction:column;align-items:center;background:#102f4d}button{padding:0;border:0;background:transparent}</style><aside>
    ${item("div", "inbox", "Inbox")}${item("div", "filas", "Filas")}
    ${item("div", "funil", "Funil")}${item("div", "gestao", "Gestao")}
    ${item("div", "pacientes", "Pacientes", "data-iea-patients-nav")}${item("div", "campanhas", "Campanhas")}
    ${item("button", "controle", "Controle", "data-iea-patient-control")}${item("div", "integracao", "Integra")}
    ${item("div", "configuracao", "Config")}${item("button", "metas", "Metas", "data-iea-goals-nav")}
  </aside><script>window.opens=0;window.IEACrmGoals={open:()=>window.opens++}</script>`;
const executablePath = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  const page = await browser.newPage();
  page.on("pageerror", error => { throw error; });
  await page.setContent(fixture);
  await page.addScriptTag({ content: script });
  await page.waitForFunction(() => Array.from(document.querySelectorAll("aside > [data-id]"))
    .map(node => node.dataset.id).join("|") === "inbox|funil|filas|metas|pacientes|controle|gestao|campanhas|integracao|configuracao");
  const result = await page.locator("aside > [data-id]").evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.id, style: node.getAttribute("style") })));
  assert.deepEqual(result.map(item => item.id), ["inbox", "funil", "filas", "metas", "pacientes", "controle", "gestao", "campanhas", "integracao", "configuracao"]);
  result.forEach(item => assert.equal(item.style, itemStyle));
  await page.evaluate(() => {
    window.fetch = async url => {
      if (String(url).includes("/api/crm/permissions")) {
        return {
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({ feature_scope_enabled: false, allowed_features: [] })
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    };
  });
  await page.addScriptTag({ content: operationsScript });
  await page.waitForFunction(() => Array.from(document.querySelectorAll("aside > [data-id]"))
    .every(node => getComputedStyle(node).display === "flex"));
  const alignment = await page.locator("aside > [data-id]").evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    const itemRect = node.getBoundingClientRect();
    const iconRect = node.querySelector(":scope > svg").getBoundingClientRect();
    const labelRect = node.querySelector(":scope > span").getBoundingClientRect();
    return {
      id: node.dataset.id,
      display: style.display,
      direction: style.flexDirection,
      alignment: style.alignItems,
      centerDelta: Math.abs((itemRect.left + itemRect.width / 2) - (iconRect.left + iconRect.width / 2)),
      iconAboveLabel: iconRect.bottom <= labelRect.top
    };
  }));
  alignment.forEach(item => {
    assert.equal(item.display, "flex", `${item.id} must preserve the flex layout after permissions render`);
    assert.equal(item.direction, "column", `${item.id} must keep the icon above the label`);
    assert.equal(item.alignment, "center", `${item.id} must center its children`);
    assert.ok(item.centerDelta <= 1, `${item.id} icon must be horizontally centered`);
    assert.equal(item.iconAboveLabel, true, `${item.id} icon must remain above its label`);
  });
  if (process.env.CRM_SIDEBAR_SCREENSHOT) {
    await page.screenshot({ path: process.env.CRM_SIDEBAR_SCREENSHOT, fullPage: true });
  }
  await page.getByRole("button", { name: "Metas" }).click();
  assert.equal(await page.evaluate(() => window.opens), 1, "Metas must open after reordering");
  const mutations = await page.evaluate(async () => {
    let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(document.querySelector("aside"), { childList: true });
    await new Promise(resolve => setTimeout(resolve, 180));
    observer.disconnect();
    return count;
  });
  assert.equal(mutations, 0, "the sidebar must settle without a mutation loop");
  console.log("crm-navigation-order-lite-e2e-ok");
} finally {
  await browser.close();
}
