import fs from "node:fs";
const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error("Template do CRM não encontrado.");
let template = JSON.parse(match[1]);
const substitutions = new Map([
  ["this.fireToast('Atendimento transferido')", "this.fireToast('Conecte o primeiro canal para habilitar transferências')"],
  ["this.fireToast('Conversa adiada')", "this.fireToast('Conecte o primeiro canal para habilitar o adiamento')"],
  ["this.fireToast('Novo QR code gerado')", "this.fireToast('O QR Code será gerado pela Evolution após configurar o canal')"],
]);
for (const [from, to] of substitutions) template = template.replaceAll(from, to);
const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(file, source.replace(match[1], serialized), "utf8");
console.log("Controles pendentes do CRM agora informam seu estado real.");
