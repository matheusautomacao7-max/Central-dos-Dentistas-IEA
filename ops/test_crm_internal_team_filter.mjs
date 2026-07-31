import fs from "node:fs";

const htmlSource = fs.readFileSync(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");
const templateMatch = htmlSource.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!templateMatch) throw new Error("Template do CRM não encontrado");
const template = JSON.parse(templateMatch[1]);
const serverSource = fs.readFileSync(new URL("../app/server.py", import.meta.url), "utf8");

const checks = {
  marker: template.includes("CRM_INTERNAL_TEAM_FILTER_V14"),
  centeredAvatar: template.includes('display:flex;justify-content:center;width:100%'),
  teamTab: template.includes('title="Contatos internos da clínica">Equipe</div>'),
  internalHandler: template.includes("filterInternos:()=>this.switchInbox('internal')"),
  internalSelectedStyle: template.includes("tabInternosStyle:this.tabStyle(S.inboxFilter==='internal')"),
  internalCardLabel: template.includes("c.isInternal?['Contato interno da equipe']"),
  serverFilter: serverSource.includes('view == "internal"') && serverSource.includes("ct.is_internal=1 AND cv.status<>'Resolvida'"),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`Falhas no filtro interno: ${failed.join(", ")}`);
console.log(JSON.stringify(checks));
