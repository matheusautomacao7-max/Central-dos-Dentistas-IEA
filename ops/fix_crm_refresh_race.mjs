import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");
let template = JSON.parse(match[2]);
if (template.includes("CRM_REFRESH_RACE_FIXED_V9")) process.exit(0);

const timelineStart = "async loadTimeline(id,silent=true){try{const target=this.convData.find(c=>Number(c.id)===Number(id));if(!target)return;const response=await fetch";
const timelineReplacement = "async loadTimeline(id,silent=true){try{const response=await fetch";
if (!template.includes(timelineStart)) throw new Error("Início do histórico não encontrado");
template = template.replace(timelineStart, timelineReplacement);

const timelineData = "const data=await this.readJsonResponse(response);const labels={";
const timelineDataReplacement = "const data=await this.readJsonResponse(response),target=this.convData.find(c=>Number(c.id)===Number(id));if(!target)return;const labels={";
if (!template.includes(timelineData)) throw new Error("Resposta do histórico não encontrada");
template = template.replace(timelineData, timelineDataReplacement);

const messagesStart = "const target=this.convData.find(c=>c.id===id);if(!target)return;\n      const viewport=document.getElementById('crmMessageViewport'),nearBottom=!viewport||viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<90,oldTop=viewport?.scrollTop||0,oldHeight=viewport?.scrollHeight||0;\n      const current=target.msgs||[],afterId=incremental&&current.length?Math.max(...current.map(m=>Number(m.id)||0)):0;";
const messagesStartReplacement = "const initialTarget=this.convData.find(c=>c.id===id);if(!initialTarget)return;\n      const viewport=document.getElementById('crmMessageViewport'),nearBottom=!viewport||viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<90,oldTop=viewport?.scrollTop||0,oldHeight=viewport?.scrollHeight||0;\n      const snapshotMessages=initialTarget.msgs||[],afterId=incremental&&snapshotMessages.length?Math.max(...snapshotMessages.map(m=>Number(m.id)||0)):0;";
if (!template.includes(messagesStart)) throw new Error("Estado inicial das mensagens não encontrado");
template = template.replace(messagesStart, messagesStartReplacement);

const messagesData = "const data=await this.readJsonResponse(response),rows=data.items||[];if(incremental&&!rows.length)return;\n      const mapped=rows.map";
const messagesDataReplacement = "const data=await this.readJsonResponse(response),rows=data.items||[];if(incremental&&!rows.length)return;\n      const target=this.convData.find(c=>c.id===id);if(!target)return;const current=target.msgs||[]; // CRM_REFRESH_RACE_FIXED_V9\n      const mapped=rows.map";
if (!template.includes(messagesData)) throw new Error("Resposta das mensagens não encontrada");
template = template.replace(messagesData, messagesDataReplacement);

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.slice(0, match.index) + match[1] + serialized + match[3] + source.slice(match.index + match[0].length));
console.log("crm-refresh-race-v9-applied");
