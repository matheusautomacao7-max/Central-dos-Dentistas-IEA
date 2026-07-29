import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error("Template do CRM não encontrado.");
let template = JSON.parse(match[1]);

const replace = (from, to, label) => {
  if (template.includes(to)) return;
  if (!template.includes(from)) throw new Error(`Trecho não encontrado: ${label}`);
  template = template.replace(from, to);
};

replace(
  "stage:'Lead',owner:item.professional||'Sem responsável',tags:[],value:''",
  "stage:item.stage||'Paciente',owner:item.professional||'Sem responsável',tags:item.channels||[],value:'',isNew:!!item.is_new",
  "tags dos contatos",
);

replace(
  "snoozed:false,tags:[],msgs:[],ci:index%this.avatarColors.length",
  "snoozed:false,tags:[item.channel_name||item.instance_name].filter(Boolean),msgs:[],ci:index%this.avatarColors.length",
  "tag automática da conversa",
);

replace(
  "channelTabs:[{id:'all',label:'Todos os canais',color:'#8696a0'}].map(ct=>{const on=S.channelFilter===ct.id;",
  "channelTabs:[{id:'all',label:'Todos os canais',color:'#8696a0'},...Array.from(new Map(this.convData.map(c=>[c.channel,{id:c.channel,label:(this.channelDefs[c.channel]||{}).name||c.channel,color:(this.channelDefs[c.channel]||{}).color||'#8696a0'}])).values())].map(ct=>{const on=S.channelFilter===ct.id;",
  "filtros reais de canal",
);

const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(file, source.replace(match[1], serialized), "utf8");
console.log("Tags e filtros de canal adicionados ao CRM.");
