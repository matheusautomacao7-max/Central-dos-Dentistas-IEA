import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const templateMatch = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!templateMatch) throw new Error("Template do CRM não encontrado.");

let template = JSON.parse(templateMatch[1]);
const replaceRequired = (from, to, label) => {
  if (!template.includes(from)) {
    if (template.includes(to)) return;
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  template = template.replace(from, to);
};

replaceRequired(
  '<span style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:9px;font-weight:800;border-radius:8px;min-width:15px;height:15px;display:flex;align-items:center;justify-content:center;padding:0 3px">6</span>',
  '',
  "contador fictício de notificações",
);

replaceRequired(
  'Arraste os cards entre as etapas · {{ contactsCount }} negócios ativos',
  'Funil ainda não configurado. Os pacientes permanecem somente em Contatos.',
  "descrição do funil",
);

replaceRequired(
  "const cards=this.contactsData.filter(c=>this.effStage(c)===col.id).map(c=>({initials:c.initials,avatarStyle:this.avatar(c.ci,34),name:c.name,company:c.company,value:c.value,tags:c.tags.map(t=>({label:t,style:this.tagStyle()})),onDragStart:()=>{this._drag=c.name;}}));",
  "const cards=[];",
  "dados reais no funil",
);

if (template.includes('>6</span>') && template.includes('top:-4px;right:-4px')) {
  throw new Error("O contador fictício de notificações ainda está presente.");
}
if (template.includes("const cards=this.contactsData.filter(c=>this.effStage(c)===col.id)")) {
  throw new Error("Os contatos reais ainda estão alimentando o funil.");
}

const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(file, source.replace(templateMatch[1], serialized), "utf8");
console.log("CRM ajustado: notificações fictícias removidas e funil desacoplado dos contatos.");
