import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";


const goalScript = await readFile(new URL("../app/public/crm-goals.js", import.meta.url), "utf8");
const operationsScript = await readFile(new URL("../app/public/crm-operations-bridge.js", import.meta.url), "utf8");
const crmHtml = await readFile(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");
assert.match(crmHtml, /crm-goals\.js\?v=20260803-team-goals-minimum-v1/);
assert.match(goalScript, /first_consultations: \{ color: "#2563EB", soft: "#F5F9FF" \}/);
assert.match(goalScript, /recoveries: \{ color: "#7C3AED", soft: "#FAF7FF" \}/);
assert.match(goalScript, /attendances: \{ color: "#F59E0B", soft: "#FFF9F0" \}/);
assert.match(goalScript, /label: "Não configurada", color: "#94A3B8", text: "#64748B"/);
assert.match(goalScript, /label: "Atrasada", color: "#EF4444", text: "#DC2626"/);
assert.match(goalScript, /label: "Atenção", color: "#F59E0B", text: "#B45309"/);
assert.match(goalScript, /label: "Em andamento", color: "#2563EB", text: "#1D4ED8"/);
assert.match(goalScript, /label: "Meta alcançada", color: "#16A34A", text: "#15803D"/);
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
  agents: [{ id: 20, name: "Matheus Henrique" }, { id: 21, name: "Isabela Cristina" }],
  schedule: {
    weekdays: "Segunda a sexta, 08h às 18h",
    saturday: "Sábado, 08h às 12h",
    remaining_open_days: 26
  },
  items: [
    goal("first_consultations", "Primeiras consultas", 40, 16, 6, 4),
    goal("recoveries", "Recuperação de pacientes", 20, 16, 5, 4),
    goal("attendances", "Atendimentos", 300, 300, 45, 45)
  ],
  conversion: {
    first_consultation: { converted: 0, opportunities: 0, percentage: 0 },
    recurring: { converted: 12, opportunities: 15, percentage: 80 }
  },
  history: []
};

let lastGoalPost = null;
const server = http.createServer(async (request, response) => {
  if (request.url === "/crm-goals.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    return response.end(goalScript);
  }
  if (request.url === "/crm-operations-bridge.js") {
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
  if (request.url.startsWith("/api/crm/goals")) {
    if (request.method === "POST") {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      lastGoalPost = JSON.parse(raw);
      response.writeHead(200, { "Content-Type": "application/json" });
      return response.end(JSON.stringify({
        ...dashboard,
        applied_scope: lastGoalPost.apply_to_all ? "all" : "individual",
        applied_user_count: lastGoalPost.apply_to_all ? dashboard.agents.length : 1,
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
  response.end(`<!doctype html><html><body style="margin:0"><aside style="width:80px;height:100vh;background:#122b46"><div><span>Inbox</span></div><button type="button" data-sidebar-settings><span>Configuração</span></button><div style="flex:1"></div></aside><h1>Conversas</h1><script src="/crm-goals.js"></script><script src="/crm-operations-bridge.js"></script></body></html>`);
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
  assert.equal(new URL(page.url()).searchParams.get("screen"), "goals");
  assert.equal(await page.evaluate(() => performance.getEntriesByType("navigation").length), 1);
  await page.getByRole("heading", { name: "Metas individuais" }).waitFor();
  assert.equal(await page.getByText("Primeiras consultas", { exact: true }).count(), 2);
  assert.equal(await page.getByText("Conversão · Cliente recorrente", { exact: true }).count(), 1);
  assert.equal(await page.getByText("26 dias de expediente restantes", { exact: true }).count(), 1);
  assert.equal(await page.locator(".iea-goals-avatar").textContent(), "MH");
  assert.equal(await page.locator(".iea-goals-screen").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(243, 246, 250)");
  await page.evaluate(() => document.body.dataset.omtheme = "dark");
  assert.equal(await page.locator(".iea-goals-screen").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(11, 20, 26)");
  await page.evaluate(() => document.body.dataset.omtheme = "light");
  assert.equal(await page.getByRole("button", { name: "Voltar" }).locator("svg").count(), 1);
  assert.equal(await page.locator(".iea-goal-card .iea-metric-icon").count(), 3);
  assert.equal(await page.locator('[data-metric-card="first_consultations"]').getAttribute("data-performance"), "low");
  assert.equal(await page.locator('[data-metric-card="recoveries"]').getAttribute("data-performance"), "good");
  assert.equal(await page.locator('[data-metric-card="attendances"]').getAttribute("data-performance"), "reached");
  assert.equal(await page.locator('[data-metric-card="first_consultations"] .iea-goal-bar>i').evaluate(element => getComputedStyle(element).backgroundColor), "rgb(239, 68, 68)");
  assert.equal(await page.locator('[data-metric-card="recoveries"] .iea-goal-bar>i').evaluate(element => getComputedStyle(element).backgroundColor), "rgb(37, 99, 235)");
  assert.equal(await page.locator('[data-metric-card="attendances"] .iea-goal-bar>i').evaluate(element => getComputedStyle(element).backgroundColor), "rgb(22, 163, 74)");
  assert.equal(await page.locator('[data-conversion="first"]').getAttribute("data-performance"), "neutral");
  assert.equal(await page.locator('[data-conversion="first"]').evaluate(element => element.style.getPropertyValue("--tone")), "#94A3B8");
  assert.equal(await page.locator('[data-conversion="recurring"]').getAttribute("data-performance"), "good");
  assert.equal(await page.locator(".iea-radial").count(), 2);
  assert.equal(await page.locator('[data-daily-performance="attention"]').count(), 1);
  assert.equal(await page.locator('[data-daily-performance="good"]').count(), 1);
  assert.equal(await page.locator('[data-daily-performance="reached"]').count(), 1);
  assert.equal(await page.locator(".iea-mini-bar").count(), 3);
  assert.equal(await page.locator(".iea-days-card svg").count(), 1);
  assert.equal(await page.locator("[data-empty-state] .iea-empty-trophy").count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Acompanhamento" }).evaluate(element => getComputedStyle(element).backgroundColor), "rgb(37, 99, 235)");
  if (process.env.CRM_GOALS_SCREENSHOT) {
    const screen = page.locator(".iea-goals-screen");
    await screen.screenshot({ path: process.env.CRM_GOALS_SCREENSHOT });
    await screen.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await screen.screenshot({ path: process.env.CRM_GOALS_SCREENSHOT.replace(/\.png$/i, "-history.png") });
    await screen.evaluate(element => { element.scrollTop = 0; });
    await page.setViewportSize({ width: 390, height: 844 });
    await screen.screenshot({ path: process.env.CRM_GOALS_SCREENSHOT.replace(/\.png$/i, "-mobile.png") });
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  await page.getByRole("tab", { name: "Configuração" }).click();
  assert.equal(await page.locator(".iea-config-card").count(), 3);
  assert.equal(await page.getByRole("heading", { name: "Configuração e permissões" }).count(), 0);
  assert.equal(await page.getByLabel("Mínimo diário").count(), 3);
  const attendanceCard = page.locator('[data-metric="attendances"]');
  await attendanceCard.locator("[data-daily]").fill("50");
  await attendanceCard.locator("[data-daily-minimum]").fill("40");
  await page.getByRole("button", { name: "Toda a equipe (2)" }).click();
  assert.equal(await attendanceCard.locator("[data-daily]").inputValue(), "50", "trocar o escopo não pode apagar o formulário");
  if (process.env.CRM_GOALS_SCREENSHOT) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(".iea-goals-screen").screenshot({ path: process.env.CRM_GOALS_SCREENSHOT.replace(/\.png$/i, "-config.png") });
  }
  await page.getByRole("button", { name: "Salvar metas" }).click();
  await page.getByText("Metas aplicadas a 2 colaboradores.").waitFor();
  assert.equal(lastGoalPost.apply_to_all, true);
  assert.equal(lastGoalPost.goals.attendances.daily_target, 50);
  assert.equal(lastGoalPost.goals.attendances.daily_minimum, 40);
  await page.getByRole("heading", { name: "🎉 Meta alcançada!" }).waitFor();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.IEACrmGoals.celebrate([{ message: "Meta acessível." }]));
  assert.equal(await page.locator(".iea-confetti").count(), 0);
  assert.equal(await page.getByText("Meta acessível.", { exact: true }).count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBox = await page.locator(".iea-goals-screen").boundingBox();
  assert.equal(Math.round(mobileBox.x), 0);
  assert.equal(Math.round(mobileBox.width), 390);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator("[data-sidebar-settings]").click();
  await page.getByRole("heading", { name: "Configuração e permissões" }).waitFor();
  assert.equal(await page.locator(".iea-config-card").count(), 0);
  console.log("crm-goals-frontend-e2e-ok");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
