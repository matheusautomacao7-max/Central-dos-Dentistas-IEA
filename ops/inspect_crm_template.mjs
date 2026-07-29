import fs from "node:fs";
const source=fs.readFileSync(new URL("../app/public/crm-whatsapp.html",import.meta.url),"utf8");
const open='<script type="__bundler/template">';
const start=source.indexOf(open)+open.length;
const end=source.indexOf('</script>',start);
const template=JSON.parse(source.slice(start,end).trim());
for(const needle of process.argv.slice(2)){
  console.log(`--- ${needle}`);
  let position=template.indexOf(needle);
  console.log(position<0?'NOT FOUND':template.slice(Math.max(0,position-300),position+700));
}
