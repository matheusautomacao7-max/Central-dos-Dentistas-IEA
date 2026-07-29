import fs from 'node:fs';
const file='app/public/crm-whatsapp.html',src=fs.readFileSync(file,'utf8');
const m=src.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);if(!m)throw Error('bundle');let t=JSON.parse(m[2]);
const r=(a,b,n)=>{if(!t.includes(a))throw Error('missing '+n);t=t.replace(a,b)};
r("metrics:{active:0,waiting:0,in_service:0,mine:0,resolved_today:0,resolved_by_me_today:0,unread:0}, volume:[]",
  "metrics:{active:0,waiting:0,in_service:0,mine:0,resolved_today:0,resolved_by_me_today:0,unread:0}, performanceAgents:[], volume:[]",'perf state');
r("const d=await r.json(),next={summary:d.summary||{},volume:d.volume||[]}","const d=await r.json(),next={summary:d.summary||{},volume:d.volume||[],agents:d.agents||[]}",'metrics data');
r("this.setState({metrics:next.summary,volume:next.volume})","this.setState({metrics:next.summary,volume:next.volume,performanceAgents:next.agents})",'metrics state');
r("rawLast:item.last_message_at||'',queueEnteredAt:item.queue_entered_at||item.last_message_at||item.created_at||'',lastDirection",
  "rawLast:item.last_message_at||'',queueEnteredAt:item.queue_entered_at||item.last_message_at||item.created_at||'',slaMinutes:Number(item.sla_minutes||60),slaOverdue:Number(item.sla_overdue||0)!==0,journeyCount:Number(item.journey_count||1),scheduledReturnAt:item.scheduled_return_at||'',resolutionReason:item.resolution_reason||'',lastDirection",'conversation sla');
r("limit=this.slaLimit(c.prio),remaining=limit-elapsed", "limit=Math.max(1,c.slaMinutes||60)*60000,remaining=limit-elapsed",'queue sla');
r("const kpis=[{label:'Conversas ativas'", "const kpis=[{label:'SLA atrasado',value:String(metrics.overdue||0),delta:(metrics.avg_first_response_minutes||0)+' min de 1ª resposta',deltaStyle:dstyle(!Number(metrics.overdue||0))},{label:'Conversas ativas'",'supervisor kpi');
r("const agents=(S.agents||[]).map((a,index)=>", "const perfById=new Map((S.performanceAgents||[]).map(a=>[String(a.id),a])); const agents=(S.agents||[]).map((a,index)=>",'perf map');
r("resolved:Number(a.resolved_today||0),scopeEnabled", "resolved:Number(a.resolved_today||0),avg:Number(perfById.get(String(a.id))?.avg_first_response_minutes||0),scopeEnabled",'agent avg');
r("const reportRows=agentRows.map(a=>({name:a.name,initials:a.initials,avatarStyle:a.avatarStyle,handled:a.active,resolved:a.resolved,avg:'—'",
  "const reportRows=agentRows.map(a=>({name:a.name,initials:a.initials,avatarStyle:a.avatarStyle,handled:a.active,resolved:a.resolved,avg:(agents.find(x=>x.name===a.name)?.avg||0)+' min'",'report avg');

const heading='<h2 style="margin:0 0 12px;font-size:15px;font-weight:800;color:var(--text2)">Eventos &amp; automações (log)</h2>';
if(!t.includes(heading))throw Error('monitor heading');
t=t.replace(heading,`<h2 style="margin:0 0 12px;font-size:18px;font-weight:800">Monitor de integrações</h2><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:22px"><sc-for list="{{ healthItems }}" as="h"><div style="border:1px solid var(--line);border-radius:11px;padding:12px;background:var(--panel)"><div style="display:flex;justify-content:space-between;gap:8px"><strong>{{ h.name }}</strong><span style="{{ h.style }}">{{ h.label }}</span></div><div style="font-size:12px;color:var(--text2);margin-top:6px">{{ h.message }}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">{{ h.last }}</div></div></sc-for></div>${heading}`);

const out=JSON.stringify(t).replaceAll('</script>','<\\/script>');fs.writeFileSync(file,src.slice(0,m.index)+m[1]+out+m[3]+src.slice(m.index+m[0].length));console.log('CRM_OPS_FRONTEND_V2');
