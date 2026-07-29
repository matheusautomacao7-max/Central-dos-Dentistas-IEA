import fs from 'node:fs';
const f='app/public/crm-whatsapp.html',s=fs.readFileSync(f,'utf8'),m=s.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);if(!m)throw Error('bundle');let t=JSON.parse(m[2]);
const rep=(a,b,n)=>{if(!t.includes(a))throw Error('missing '+n);t=t.replace(a,b)};

rep("performanceAgents:[], volume:[]", "performanceAgents:[], managerMetrics:{}, managerPerformanceAgents:[], managerVolume:[], managerPeriod:'today', managerChannelId:'0', managerStart:'', managerEnd:'', volume:[]", 'manager state');

const marker='  async loadConversations(silent=false,forcedView=null,forcedSearch=null){';
if(!t.includes(marker))throw Error('load conversations marker');
const managerMethods=`  async loadManagerMetrics(silent=false){
    const S=this.state,params=new URLSearchParams({period:S.managerPeriod||'today',channel_id:S.managerChannelId||'0'});
    if(S.managerPeriod==='custom'){if(!S.managerStart||!S.managerEnd){if(!silent)this.fireToast('Selecione a data inicial e final');return;}params.set('start',S.managerStart);params.set('end',S.managerEnd);}
    try{const r=await fetch('/api/crm/metrics?'+params.toString());const d=await this.readJsonResponse(r);if(!r.ok)throw new Error(d.error||'Falha ao filtrar indicadores');this.setState({managerMetrics:d.summary||{},managerVolume:d.volume||[],managerPerformanceAgents:d.agents||[]});}catch(e){if(!silent)this.fireToast(e.message||'Não foi possível carregar o período');}
  }
  updateManagerFilter(patch){this.setState(patch);setTimeout(()=>this.loadManagerMetrics(false),0);}
  exportManagerReport(){const S=this.state,m=S.managerMetrics||{},rows=[['Indicador','Valor'],['Período',S.managerPeriod],['Início',S.managerStart||''],['Fim',S.managerEnd||''],['SLA atrasado',m.overdue||0],['Conversas ativas',m.active||0],['Não lidas',m.unread||0],['Na fila',m.waiting||0],['Resolvidas',m.resolved_today||0],[],['Atendente','Ativos','Resolvidos','Média 1ª resposta (min)'],...(S.managerPerformanceAgents||[]).map(a=>[a.name,a.active||0,a.resolved_today||0,a.avg_first_response_minutes||0])];const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\\n'),blob=new Blob(['\\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gestao-crm-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);}
`;
t=t.replace(marker,managerMethods+marker);

rep("    this.loadMetrics();\n    this.loadConversations", "    this.loadMetrics();\n    this.loadManagerMetrics(true);\n    this.loadConversations", 'manager mount');
rep("this.loadConversations(true);this.loadMetrics(true);if(this.state.screen==='funil'||this.state.screen==='supervisor')this.loadPipeline();",
    "this.loadConversations(true);this.loadMetrics(true);if(this.state.screen==='supervisor')this.loadManagerMetrics(true);if(this.state.screen==='funil'||this.state.screen==='supervisor')this.loadPipeline();", 'manager timer');

const chips=`        <div style="display:flex;gap:6px;margin-top:9px;overflow-x:auto">
          <sc-for list="{{ channelTabs }}" as="ct">
            <div sc-camel-on-click="{{ ct.onClick }}" style="{{ ct.style }}"><span style="width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:{{ ct.color }}"></span>{{ ct.label }}</div>
          </sc-for>
        </div>`;
const selector=`        <button sc-camel-on-click="{{ openChannelSelector }}" style="margin-top:9px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 12px;color:var(--text);font:inherit;font-size:13px;font-weight:700;cursor:pointer"><span style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:{{ selectedChannelColor }}"></span>{{ selectedChannelLabel }}</span><span>Selecionar canal ▾</span></button>`;
rep(chips,selector,'inbox channel chips');

const oldManager=`      <div><h1 style="margin:0;font-size:24px;font-weight:800">Visão do gestor</h1><p style="margin:6px 0 0;color:var(--text2);font-size:14px">Desempenho da operação · últimas 24h</p></div>
      <div style="display:flex;gap:8px">
        <sc-raw-select style="{{ selectStyle }}"><option>Últimas 24h</option><option>Últimos 7 dias</option><option>Este mês</option></sc-raw-select>
        <sc-raw-select style="{{ selectStyle }}"><option>Todos os canais</option><option>Vendas</option><option>Suporte</option><option>Financeiro</option></sc-raw-select>
        <button style="{{ exportBtn }}" style-hover="background:#1da851">`;
const newManager=`      <div><h1 style="margin:0;font-size:24px;font-weight:800">Visão do gestor</h1><p style="margin:6px 0 0;color:var(--text2);font-size:14px">{{ managerSubtitle }}</p></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        <sc-raw-select value="{{ managerPeriod }}" sc-camel-on-change="{{ onManagerPeriod }}" style="{{ selectStyle }}"><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="custom">Selecionar período</option></sc-raw-select>
        <sc-if value="{{ managerCustom }}"><input type="date" value="{{ managerStart }}" sc-camel-on-change="{{ onManagerStart }}" style="{{ selectStyle }}"><input type="date" value="{{ managerEnd }}" sc-camel-on-change="{{ onManagerEnd }}" style="{{ selectStyle }}"><button sc-camel-on-click="{{ applyManagerPeriod }}" style="{{ selectStyle }}">Aplicar</button></sc-if>
        <sc-raw-select value="{{ managerChannelId }}" sc-camel-on-change="{{ onManagerChannel }}" style="{{ selectStyle }}"><sc-for list="{{ managerChannelOptions }}" as="mc"><option value="{{ mc.id }}">{{ mc.label }}</option></sc-for></sc-raw-select>
        <button sc-camel-on-click="{{ exportManager }}" style="{{ exportBtn }}" style-hover="background:#1da851">`;
rep(oldManager,newManager,'manager filters html');

rep("const metrics=S.metrics||{}", "const metrics=S.managerMetrics||S.metrics||{}", 'manager metrics source');
rep("{label:'Resolvidas hoje',value:String(resolved)", "{label:(S.managerPeriod==='today'?'Resolvidas hoje':'Resolvidas no período'),value:String(resolved)", 'resolved label');
rep("const labels=['09h','10h','11h','12h','13h','14h','15h','16h','17h'],volumeMap=new Map((S.volume||[]).map(v=>[String(v.hour).padStart(2,'0'),Number(v.total||0)])),maxVolume=Math.max(1,...volumeMap.values());\n    const volumeBars=labels.map(label=>({h:Math.max(2,Math.round((volumeMap.get(label.slice(0,2))||0)/maxVolume*100))+'%',label}));",
`const volumeSource=S.managerVolume||[],labels=volumeSource.length?volumeSource.map(v=>v.label):['Sem dados'],volumeMap=new Map(volumeSource.map(v=>[v.label,Number(v.total||0)])),maxVolume=Math.max(1,...volumeMap.values());
    const volumeBars=labels.map(label=>({h:Math.max(2,Math.round((volumeMap.get(label)||0)/maxVolume*100))+'%',label}));`, 'volume period');
rep("const perfById=new Map((S.performanceAgents||[]).map(a=>[String(a.id),a]))", "const perfById=new Map((S.managerPerformanceAgents||[]).map(a=>[String(a.id),a]))", 'manager agent source');

const resolveModal='  <sc-if value="{{ modalResolve }}">';
if(!t.includes(resolveModal))throw Error('modal insertion');
const channelModal=`  <sc-if value="{{ modalChannelSelector }}"><div sc-camel-on-click="{{ closeModal }}" style="{{ overlay }}"><div sc-camel-on-click="{{ stop }}" style="{{ modalCard }};max-width:480px"><h2 style="margin:0 0 5px;font-size:20px;font-weight:800">Selecionar canal</h2><p style="margin:0 0 16px;color:var(--text2);font-size:13px">Escolha qual número deseja visualizar no Inbox.</p><div style="display:flex;flex-direction:column;gap:8px"><sc-for list="{{ channelModalOptions }}" as="ct"><button sc-camel-on-click="{{ ct.onClick }}" style="{{ ct.modalStyle }}"><span style="display:flex;align-items:center;gap:9px"><span style="width:9px;height:9px;border-radius:50%;background:{{ ct.color }}"></span>{{ ct.label }}</span><span>{{ ct.check }}</span></button></sc-for></div><div style="display:flex;justify-content:flex-end;margin-top:16px"><button sc-camel-on-click="{{ closeModal }}" style="{{ cancelBtn }}">Fechar</button></div></div></div></sc-if>

`;
t=t.replace(resolveModal,channelModal+resolveModal);

rep("modalTransfer:S.modal==='transfer',modalQr:S.modal==='qr',modalResolve:", "modalTransfer:S.modal==='transfer',modalQr:S.modal==='qr',modalChannelSelector:S.modal==='channelSelector',modalResolve:", 'modal channel flag');
rep("channelTabs:[{id:'all'", "channelTabs:[{id:'all'", 'channel tabs anchor');
// Add bindings beside channelTabs return expression.
const channelBinding="channelTabs:[{id:'all',label:'Todos os canais',color:'#8696a0'},...Array.from(new Map(this.convData.map(c=>[c.channel,{id:c.channel,label:(this.channelDefs[c.channel]||{}).name||c.channel,color:(this.channelDefs[c.channel]||{}).color||'#8696a0'}])).values())].map(ct=>{const on=S.channelFilter===ct.id;return{label:ct.label,color:ct.color,onClick:()=>this.setState({channelFilter:ct.id}),style:`display:flex;align-items:center;gap:6px;flex:0 0 auto;padding:5px 11px;border-radius:16px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ${on?'#25d366':'var(--line)'};background:${on?'rgba(37,211,102,.1)':'transparent'};color:${on?'#15a34a':'var(--text2)'}`};}),";
if(!t.includes(channelBinding))throw Error('channel binding exact');
const channelReplacement=channelBinding+"selectedChannelLabel:([{id:'all',label:'Todos os canais'},...Array.from(new Map(this.convData.map(c=>[c.channel,{id:c.channel,label:(this.channelDefs[c.channel]||{}).name||c.channel}])).values())].find(x=>x.id===S.channelFilter)||{label:'Todos os canais'}).label,selectedChannelColor:(this.channelDefs[S.channelFilter]||{color:'#8696a0'}).color,openChannelSelector:()=>this.setState({modal:'channelSelector'}),channelModalOptions:[{id:'all',label:'Todos os canais',color:'#8696a0'},...Array.from(new Map(this.convData.map(c=>[c.channel,{id:c.channel,label:(this.channelDefs[c.channel]||{}).name||c.channel,color:(this.channelDefs[c.channel]||{}).color||'#8696a0'}])).values())].map(ct=>({label:ct.label,color:ct.color,check:S.channelFilter===ct.id?'✓':'',onClick:()=>this.setState({channelFilter:ct.id,modal:null}),modalStyle:`display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 13px;border-radius:10px;border:1px solid ${S.channelFilter===ct.id?'#25d366':'var(--line)'};background:${S.channelFilter===ct.id?'rgba(37,211,102,.1)':'var(--panel)'};color:var(--text);font:inherit;font-weight:700;cursor:pointer`})),";
t=t.replace(channelBinding,channelReplacement);

rep("kpis,volumeBars,agentRows,reportRows,contacts", "managerPeriod:S.managerPeriod,managerCustom:S.managerPeriod==='custom',managerStart:S.managerStart,managerEnd:S.managerEnd,managerChannelId:S.managerChannelId,managerSubtitle:S.managerPeriod==='today'?'Desempenho da operação · hoje':S.managerPeriod==='7d'?'Desempenho da operação · últimos 7 dias':'Desempenho da operação · período selecionado',managerChannelOptions:[{id:'0',label:'Todos os canais'},...(this.crmChannels||[]).filter(c=>Number(c.active)!==0).map(c=>({id:String(c.id),label:c.display_name||c.instance_name}))],onManagerPeriod:e=>this.updateManagerFilter({managerPeriod:e.target.value}),onManagerChannel:e=>this.updateManagerFilter({managerChannelId:e.target.value}),onManagerStart:e=>this.setState({managerStart:e.target.value}),onManagerEnd:e=>this.setState({managerEnd:e.target.value}),applyManagerPeriod:()=>this.loadManagerMetrics(false),exportManager:()=>this.exportManagerReport(),kpis,volumeBars,agentRows,reportRows,contacts", 'manager bindings');

const out=JSON.stringify(t).replaceAll('</script>','<\\/script>');fs.writeFileSync(f,s.slice(0,m.index)+m[1]+out+m[3]+s.slice(m.index+m[0].length));console.log('CRM_MANAGER_FILTERS_CHANNEL_MODAL_V1');
