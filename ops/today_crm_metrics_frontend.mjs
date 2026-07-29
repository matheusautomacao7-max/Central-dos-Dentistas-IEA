import fs from 'node:fs';
const f='app/public/crm-whatsapp.html',s=fs.readFileSync(f,'utf8'),m=s.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);if(!m)throw Error('bundle');let t=JSON.parse(m[2]);
const from="{label:'SLA atrasado',value:String(metrics.overdue||0),delta:(metrics.avg_first_response_minutes||0)+' min de 1ª resposta'";
const to="{label:'SLA atrasado hoje',value:String(metrics.overdue||0),delta:(metrics.avg_first_response_minutes||0)+' min de 1ª resposta hoje'";
if(!t.includes(from))throw Error('metric label');t=t.replace(from,to);
const out=JSON.stringify(t).replaceAll('</script>','<\\/script>');fs.writeFileSync(f,s.slice(0,m.index)+m[1]+out+m[3]+s.slice(m.index+m[0].length));console.log('CRM_TODAY_METRICS_V1');
