import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/public/crm-whatsapp.html', import.meta.url), 'utf8');
const match = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error('Template interno não encontrado');
const template = JSON.parse(match[1]);
const logicMatch = template.match(/<script type="text\/x-dc"[^>]*>\s*([\s\S]*?)\s*<\/script>/);
if (!logicMatch) throw new Error('Lógica do CRM não encontrada');
new Function(logicMatch[1]);
const markers = [
  ['id="crmMessageViewport"'],
  ['addTag:()=>this.addTag()', 'addTag:()=>this.openTagPicker()'],
  ['const waiting=this.convData.filter'],
  ["label:'Resolvidos'"],
];
for (const alternatives of markers) {
  if (!alternatives.some(marker => template.includes(marker))) {
    throw new Error(`Marcador ausente: ${alternatives.join(' ou ')}`);
  }
}
console.log('Template e lógica do CRM válidos');
