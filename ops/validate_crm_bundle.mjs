import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");
const templateMatch = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!templateMatch) throw new Error("Template do CRM não encontrado.");

const template = JSON.parse(templateMatch[1]);
const logicMatch = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (!logicMatch) throw new Error("Lógica do componente não encontrada.");

new Function(`class DCLogic {}; ${logicMatch[1]}; return Component;`);

const forbidden = [
  "Marina Alves", "Carlos Mendes", "Juliana Ramos", "Pedro Santos",
  "Fernanda Costa", "Rafael Oliveira", "Ana Souza", "Bruno Lima",
  "suaempresa.com", "Black Friday",
];
const leftovers = forbidden.filter(value => template.includes(value));
if (leftovers.length) throw new Error(`Dados fictícios restantes: ${leftovers.join(", ")}`);
if (!template.includes("CRM_REAL_CONTACTS_V1") && !template.includes("CRM_REALTIME_V4")) {
  throw new Error("Integração de contatos reais ausente.");
}
if (!template.includes("CRM_START_CONVERSATION_V1")) throw new Error("Início de conversa ausente.");
if (!template.includes("CRM_START_CONVERSATION_STABLE_V2")) throw new Error("Fluxo estável de abertura de conversa ausente.");
if (!template.includes("CRM_CONVERSATION_ID_NORMALIZED_V3")) throw new Error("Normalização do ID da conversa ausente.");

if (!template.includes("CRM_REUSABLE_TAGS_V1")) throw new Error("Reusable tag selector missing.");
if (!template.includes("CRM_AUDIO_RECORDING_V1")) throw new Error("CRM audio recording missing.");
console.log(JSON.stringify({ logic: "ok", fakeData: 0, realContacts: true, reusableTags: true }));
