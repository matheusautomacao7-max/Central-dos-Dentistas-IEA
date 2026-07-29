import fs from 'node:fs';
const f='app/public/crm-whatsapp.html',s=fs.readFileSync(f,'utf8'),m=s.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);if(!m)throw Error('bundle');let t=JSON.parse(m[2]);
const a="channelName:ach.name,typing:false,avatarStyle:";
if(!t.includes(a))throw Error('active mapping');t=t.replace(a,"channelName:ach.name,journeyLabel:(ac.journeyCount||1)+' canal'+((ac.journeyCount||1)>1?'s':''),typing:false,avatarStyle:");
const b='<span>{{ activeConv.channelName }}</span><span>·</span><span>{{ activeConv.phone }}</span><span>·</span><span style="color:#25d366;font-weight:700">{{ activeConv.owner }}</span>';
if(!t.includes(b))throw Error('header');t=t.replace(b,b+'<span>·</span><span title="Jornada consolidada do mesmo telefone">{{ activeConv.journeyLabel }}</span>');
const o=JSON.stringify(t).replaceAll('</script>','<\\/script>');fs.writeFileSync(f,s.slice(0,m.index)+m[1]+o+m[3]+s.slice(m.index+m[0].length));console.log('CRM_UNIFIED_JOURNEY_UI_V1');
