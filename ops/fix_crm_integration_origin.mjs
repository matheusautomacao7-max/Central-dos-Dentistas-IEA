import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error("Template do CRM não encontrado.");
let template = JSON.parse(match[1]);

const beforeEvolution = "event:item.event_type||'Evento Evolution',origin:item.instance_name||'Evolution',status:";
const afterEvolution = "event:item.event_type||'Evento Evolution',source:`Evolution · ${item.instance_name||'origem não informada'}`,status:";
if (!template.includes(beforeEvolution)) throw new Error("Mapeamento de origem Evolution não encontrado.");
template = template.replace(beforeEvolution, afterEvolution);

const beforeN8n = "event:item.flow_name?`${item.flow_name} · ${item.event_type}`:(item.event_type||'Evento n8n'),origin:item.channel_name?`n8n · ${item.channel_name}`:'n8n',status:";
const afterN8n = "event:item.flow_name?`${item.flow_name} · ${item.event_type}`:(item.event_type||'Evento n8n'),source:item.channel_name?`n8n · ${item.channel_name}`:'n8n · canal não associado',status:";
if (!template.includes(beforeN8n)) throw new Error("Mapeamento de origem n8n não encontrado.");
template = template.replace(beforeN8n, afterN8n);

const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(file, source.replace(match[1], serialized), "utf8");
console.log("CRM_INTEGRATION_ORIGIN_FIX_V1");
