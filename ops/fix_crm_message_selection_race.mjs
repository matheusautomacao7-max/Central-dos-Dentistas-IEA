import fs from "node:fs";

const htmlFile = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(htmlFile, "utf8");
const templatePattern = /<script type="__bundler\/template">\s*("[\s\S]*?")\s*<\/script>/;
const match = source.match(templatePattern);
if (!match) throw new Error("Template embarcado do CRM não encontrado.");

let template = JSON.parse(match[1]);
const marker = "CRM_MESSAGE_SELECTION_GUARD_V1";
const alreadyApplied = template.includes(marker);

const before = `      const signature=combined.map(m=>\`\${m.id}:\${m.authorType}:\${m.type}:\${m.mediaUrl}\`).join('|');this.crmMessageCache.set(Number(id),combined);target.msgs=combined;if(signature===target.messageSignature){if(this.state.activeConvId!==id)this.setState({activeConvId:id});return;}
      target.messageSignature=signature;this.setState({activeConvId:id});
      setTimeout(()=>{const box=document.getElementById('crmMessageViewport');if(!box)return;if(forceBottom||nearBottom)box.scrollTop=box.scrollHeight;else box.scrollTop=oldTop+(box.scrollHeight-oldHeight);},0);`;
const after = `      const signature=combined.map(m=>\`\${m.id}:\${m.authorType}:\${m.type}:\${m.mediaUrl}\`).join('|');this.crmMessageCache.set(Number(id),combined);target.msgs=combined;const selectionStillActive=Number(this.state.activeConvId)===Number(id); // ${marker}
      if(signature===target.messageSignature)return;
      target.messageSignature=signature;if(!selectionStillActive)return;this.setState({activeConvId:id});
      setTimeout(()=>{if(Number(this.state.activeConvId)!==Number(id))return;const box=document.getElementById('crmMessageViewport');if(!box)return;if(forceBottom||nearBottom)box.scrollTop=box.scrollHeight;else box.scrollTop=oldTop+(box.scrollHeight-oldHeight);},0);`;

if (!alreadyApplied) {
  if (!template.includes(before)) throw new Error("Trecho vulnerável de loadMessages não encontrado.");
  template = template.replace(before, after);
}
// Uma tag script em HTML termina até dentro de texto JSON. Preserve as tags
// internas do template como <\/script>, como fazia o bundle original.
const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
const replacement = `<script type="__bundler/template">\n${serialized}\n</script>`;
fs.writeFileSync(htmlFile, source.replace(templatePattern, replacement), "utf8");
console.log(alreadyApplied ? "Template do CRM normalizado." : "Proteção contra troca tardia de conversa aplicada.");
