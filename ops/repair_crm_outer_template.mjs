import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const opener = '<script type="__bundler/template">';
const start = source.indexOf(opener);
const end = source.lastIndexOf("</script>");
if (start < 0 || end < 0 || end <= start) throw new Error("Envelope do template não encontrado");
const bodyStart = start + opener.length;
const body = source.slice(bodyStart, end).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.slice(0, bodyStart) + body + source.slice(end), "utf8");
console.log("crm-outer-template-repaired");
