import assert from "node:assert/strict";
import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const bridge = await readFile(new URL("../app/public/crm-collaborator-profile.js", import.meta.url), "utf8");
let achievements = [];
const profilePayload = () => ({
  profile: {
    id: 7, name: "Matheus Henrique", email: "matheuscrc@instituto.local",
    crm_access_level: "admin", service_sector: "CRC", photo_url: null,
    stats: {active_count:0,resolved_month:14,attendances_month:22,first_consultations:8,recoveries:5}
  },
  achievements,
  can_manage: true,
  collaborators: [{id:7,name:"Matheus Henrique",crm_access_level:"admin"},{id:8,name:"Isabela Cristina",crm_access_level:"attendant"}]
});

const pageHtml = `<!doctype html><html><body data-omtheme="light" style="margin:0;background:var(--bg,#f0f2f5)">
  <aside style="width:80px;height:100vh;display:flex;flex-direction:column;align-items:center;background:#122b46">
    <div style="flex:1"></div>
    <div id="theme" style="width:44px;height:38px;cursor:pointer"><svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3"></path></svg></div>
    <div id="avatar" style="width:44px;height:44px;cursor:pointer">MH</div>
  </aside><script src="/crm-collaborator-profile.js"></script></body></html>`;

const server = http.createServer(async (request, response) => {
  if (request.url === "/crm-collaborator-profile.js") {
    response.writeHead(200, {"Content-Type":"text/javascript; charset=utf-8"});
    return response.end(bridge);
  }
  if (request.url === "/api/auth/status") {
    response.writeHead(200, {"Content-Type":"application/json"});
    return response.end(JSON.stringify({authenticated:true,user:{id:7,name:"Matheus Henrique",role:"crc",crm_access_level:"admin"}}));
  }
  if (request.url.startsWith("/api/crm/profile/achievements") && request.method === "POST") {
    let raw = ""; for await (const chunk of request) raw += chunk;
    const item = JSON.parse(raw);
    achievements = [{id:1,source:"manual",title:item.title,description:item.description,icon_key:item.icon_key,accent_color:item.accent_color,awarded_at:"2026-08-02 15:00:00",awarded_by:"Matheus Henrique"}];
    response.writeHead(201, {"Content-Type":"application/json"});
    return response.end(JSON.stringify({created:true,achievement:achievements[0]}));
  }
  if (request.url.startsWith("/api/crm/profile")) {
    response.writeHead(200, {"Content-Type":"application/json"});
    return response.end(JSON.stringify(profilePayload()));
  }
  response.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
  response.end(pageHtml);
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean).find(existsSync);
const browser = await chromium.launch({headless:true,...(executablePath ? {executablePath} : {})});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const theme = page.getByRole("button", {name:"Alternar modo noturno"});
  await theme.waitFor(); await theme.click();
  await page.waitForFunction(() => document.body.dataset.omtheme === "dark");
  assert.equal(await page.evaluate(() => localStorage.getItem("iea.crm.theme")), "dark");

  await page.getByRole("button", {name:"Abrir meu perfil e conquistas"}).click();
  await page.getByRole("heading", {name:"Matheus Henrique"}).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 1);
  assert.equal(await page.getByText("Administrador do CRM", {exact:true}).count(), 1);
  assert.equal(await page.getByText("22", {exact:true}).count(), 1);
  assert.equal(await page.getByText("Este perfil ainda não possui conquistas.").count(), 1);

  await page.getByRole("button", {name:"+ Criar conquista"}).click();
  await page.getByLabel("Título da conquista").fill("Excelência no atendimento");
  await page.getByLabel("Mensagem de reconhecimento").fill("Destaque pelo cuidado com os pacientes.");
  await page.getByLabel("Símbolo").selectOption("medal");
  await page.getByRole("button", {name:"Publicar conquista"}).click();
  await page.getByRole("heading", {name:"Excelência no atendimento"}).waitFor();
  assert.equal(await page.getByText("Destaque criado por Matheus Henrique", {exact:false}).count(), 1);

  await page.setViewportSize({width:390,height:844});
  const box = await page.getByRole("dialog").boundingBox();
  assert.equal(Math.round(box.width), 390);
  assert.equal(Math.round(box.height), 844);
  console.log("crm-collaborator-profile-e2e-ok");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
