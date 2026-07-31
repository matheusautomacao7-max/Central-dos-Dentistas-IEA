import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");
const match = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error("Template do CRM não encontrado");
const template = JSON.parse(match[1]);
const server = fs.readFileSync(new URL("../app/server.py", import.meta.url), "utf8");

const checks = {
  marker: template.includes("CRM_COMPOSER_TOOLS_V15"),
  emojiAction: template.includes('sc-camel-on-click="{{ toggleEmojiPicker }}"'),
  emojiDialog: template.includes('role="dialog" aria-label="Selecionar emoji"'),
  emojiInsert: template.includes("insertEmoji(value)"),
  attachmentInput: template.includes('id="crmAttachmentInput" type="file"'),
  attachmentAction: template.includes('sc-camel-on-click="{{ openAttachmentPicker }}"'),
  attachmentUpload: template.includes("async sendAttachment(file)"),
  sizeLimit: template.includes("12*1024*1024"),
  imagePlayer: template.includes('<img src="{{ m.mediaUrl }}"'),
  videoPlayer: template.includes('<video src="{{ m.mediaUrl }}" controls'),
  documentLink: template.includes('Abrir arquivo</span>'),
  serverMediaRoute: server.includes("doc|docx|xls|xlsx|ppt|pptx|txt|zip|bin"),
  officeDocuments: server.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`Falhas no compositor: ${failed.join(", ")}`);
console.log(JSON.stringify(checks));
