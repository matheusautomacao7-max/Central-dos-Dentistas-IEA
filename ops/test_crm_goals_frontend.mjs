import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";


const goalScript = await readFile(new URL("../app/public/crm-goals.js", import.meta.url), "utf8");
const goal = (metric_key, label, monthlyTarget, monthlyRealized, dailyTarget, dailyRealized) => ({
  metric_key, label, celebration_enabled: true, celebration_message: "",
  monthly: {
    target: monthlyTarget, realized: monthlyRealized,
    percentage: monthlyTarget ? monthlyRealized / monthlyTarget * 100 : 0,
    gap: Math.max(0, monthlyTarget - monthlyRealized),
    required_per_open_day: 2, reached: monthlyTarget > 0 && monthlyRealized >= monthlyTarget
  },
  daily: {
    target: dailyTarget, realized: dailyRealized,
    percentage: dailyTarget ? dailyRealized / dailyTarget * 100 : 0,
    gap: Math.max(0, dailyTarget - dailyRealized),
    reached: dailyTarget > 0 && dailyRealized >= dailyTarget
  }
});
const dashboard = {
  month: "2026-08", month_label: "Agosto 2026", can_configure: true,
  user: { id: 20, name: "Matheus Henrique", email: "matheus@example.test" },
  agents: [{ id: 20, name: "Matheus Henrique" }],
  schedule: {
    weekdays: "Segunda a sexta, 08h às 18h",
    saturday: "Sábado, 08h às 12h",
    remaining_open_days: 26
  },
  items: [
    goal("first_consultations", "Primeiras consultas", 40, 28, 6, 4),
    goal("recoveries", "Recuperação de pacientes", 20, 11, 3, 1),
    goal("attendances", "Atendimentos", 300, 224, 45, 31)
  ],
  conversion: {
    first_consultation: { converted: 18, opportunities: 27, percentage: 66.7 },
    recurring: { converted: 9, opportunities: 15, percentage: 60 }
  },
  history: []
};

const server = http.createServer(async (request, response) => {
  if (request.url === "/crm-goals.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(goalScript);
  }
  if (request.url.startsWith("/api/crm/goals")) {
    if (request.method === "POST") {
      for await (const _chunk of request) { /* consume request body */ }
      response.writeHead(200, { "Content-Type": "application/json" });
      return response.end(JSON.stringify({
        ...dashboard,
        achievements: [{
          metric_key: "first_consultations", achievement_type: "monthly",
          target: 40, realized: 40,
          message: "Parabéns, Matheus Henrique! Meta mensal de Primeiras consultas alcançada: 40 de 40."
        }]
      }));
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify(dashboard));
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><body style="margin:0"><aside style="width:80px;height:100vh;background:#122b46"><div><span>Inbox</span></div><div style="flex:1"></div></aside><h1>Conversas</h1><script src="/crm-goals.js"></script></body></html>`);
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.getByText("Metas", { exact: true }).click();
  await page.getByRole("heading", { name: "Metas individuais" }).waitFor();
  assert.equal(await page.getByText("Primeiras consultas", { exact: true }).count(), 2);
  assert.equal(await page.getByText("Conversão · Cliente recorrente", { exact: true }).count(), 1);
  assert.equal(await page.getByText("26 dias de expediente restantes", { exact: true }).count(), 1);

  await page.getByRole("button", { name: "Configuração" }).click();
  await page.getByRole("button", { name: "Salvar metas" }).click();
  await page.getByText("Metas salvas com sucesso.").waitFor();
  await page.getByRole("heading", { name: "🎉 Meta alcançada!" }).waitFor();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.IEACrmGoals.celebrate([{ message: "Meta acessível." }]));
  assert.equal(await page.locator(".iea-confetti").count(), 0);
  assert.equal(await page.getByText("Meta acessível.", { exact: true }).count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBox = await page.locator(".iea-goals-screen").boundingBox();
  assert.equal(Math.round(mobileBox.x), 0);
  assert.equal(Math.round(mobileBox.width), 390);
  console.log("crm-goals-frontend-e2e-ok");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
