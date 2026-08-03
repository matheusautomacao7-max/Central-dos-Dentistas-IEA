import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const script = await readFile(new URL("../app/public/crm-navigation-order-lite.js", import.meta.url), "utf8");
const html = await readFile(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");
assert.match(html, /crm-navigation-order-lite\.js\?v=20260803-native-order-v2/);
assert.match(script, /iea-navigation-order-lite/);
assert.doesNotMatch(html, /crm-navigation-order\.js/);

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/lite.js")) return res.end(script);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><aside>
    <div data-id="inbox" style="color:white">Inbox</div><div data-id="filas" style="color:white">Filas</div>
    <div data-id="funil" style="color:white">Funil</div><div data-id="gestao" style="color:white">Gestão</div>
    <div data-id="pacientes" data-iea-patients-nav style="color:white">Pacientes</div><div data-id="campanhas" style="color:white">Campanhas</div>
    <button data-id="controle" data-iea-patient-control style="color:white">Controle</button><div data-id="integracao" style="color:white">Integra</div>
    <div data-id="configuracao" style="color:white">Config</div><button data-id="metas" data-iea-goals-nav style="color:white">Metas</button>
  </aside><script>window.opens=0;window.IEACrmGoals={open:()=>window.opens++}</script><script src="/lite.js"></script>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const executablePath = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForTimeout(50);
  const result = await page.locator("aside > [data-id]").evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.id, style: node.getAttribute("style") })));
  assert.deepEqual(result.map(item => item.id), ["inbox", "funil", "filas", "metas", "pacientes", "controle", "gestao", "campanhas", "integracao", "configuracao"]);
  result.forEach(item => assert.equal(item.style, "color:white"));
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
  await new Promise(resolve => server.close(resolve));
}
