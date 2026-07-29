import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const opening = '<script type="__bundler/template">';
const start = source.indexOf(opening);
const end = source.lastIndexOf("</script>");
if (start < 0 || end < 0 || end <= start) throw new Error("Template não encontrado");
const jsonStart = start + opening.length;
const template = JSON.parse(source.slice(jsonStart, end).trim());
const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.slice(0, jsonStart) + serialized + source.slice(end));
console.log("crm-template-serialization-repaired");
