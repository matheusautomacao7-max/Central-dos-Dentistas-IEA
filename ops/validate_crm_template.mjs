import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/public/crm-whatsapp.html', import.meta.url), 'utf8');
const match = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>\s*<script src="\/crm-evolution-bridge\.js">/);
if (!match) throw new Error('Template interno não encontrado');
const template = JSON.parse(match[1]);
const logicMatch = template.match(/<script type="text\/x-dc" data-dc-script="">\s*([\s\S]*?)\s*<\/script>/);
if (!logicMatch) throw new Error('Lógica do CRM não encontrada');
new Function(logicMatch[1]);
for (const marker of ['id="crmMessageViewport"', 'addTag:()=>this.addTag()', 'const waiting=this.convData.filter', "label:'Resolvidos'"]) {
  if (!template.includes(marker)) throw new Error(`Marcador ausente: ${marker}`);
}
console.log('Template e lógica do CRM válidos');
