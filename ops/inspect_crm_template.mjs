import fs from "node:fs";
const source=fs.readFileSync(new URL("../app/public/crm-whatsapp.html",import.meta.url),"utf8");
const open='<script type="__bundler/template">';
const start=source.indexOf(open)+open.length;
const end=source.indexOf('</script>',start);
const template=JSON.parse(source.slice(start,end).trim());
for(const needle of process.argv.slice(2)){
  console.log(`--- ${needle}`);
  let position=-1;
  let found=0;
  while((position=template.indexOf(needle,position+1))>=0){
    found+=1;
    console.log(`MATCH ${found} @ ${position}`);
    console.log(template.slice(Math.max(0,position-300),position+700));
  }
  if(!found)console.log('NOT FOUND');
}
