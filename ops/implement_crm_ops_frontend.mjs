import fs from 'node:fs';

const file='app/public/crm-whatsapp.html';
const source=fs.readFileSync(file,'utf8');
const match=source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if(!match) throw new Error('template bundle not found');
let t=JSON.parse(match[2]);
const rep=(a,b,label)=>{if(!t.includes(a))throw new Error(`missing ${label}`);t=t.replace(a,b)};

rep("integrationLogs:[], syncStatus:{running:false,phase:'Pronto para sincronizar'}, allowedFeatures:",
    "integrationLogs:[], integrationHealth:[], quickReplyItems:[], resolutionReason:'', scheduledDate:'', scheduledTime:'', quickTitle:'', quickContent:'', quickCategory:'Geral', syncStatus:{running:false,phase:'Pronto para sincronizar'}, allowedFeatures:", 'state');

rep("    this.loadTags();\n    this.loadAgents();", "    this.loadTags();\n    this.loadQuickReplies();\n    this.loadIntegrationHealth(true);\n    this.loadAgents();", 'mount loads');
rep("if(this.state.screen==='integracoes'){this.loadIntegrationLogs(true);this.loadSyncStatus(true);}",
    "if(this.state.screen==='integracoes'){this.loadIntegrationLogs(true);this.loadSyncStatus(true);this.loadIntegrationHealth(true);}", 'timer health');

rep("  async loadMetrics(silent=false){", `  async loadQuickReplies(silent=false){try{const r=await fetch('/api/crm/quick-replies');const d=await this.readJsonResponse(r);if(!r.ok)throw new Error(d.error||'Falha ao carregar respostas rápidas');this.setState({quickReplyItems:d.items||[]});}catch(e){if(!silent)this.fireToast(e.message);}}
  async createQuickReply(){const S=this.state,title=(S.quickTitle||'').trim(),content=(S.quickContent||'').trim();if(!title||!content)return this.fireToast('Informe título e mensagem');try{const r=await fetch('/api/crm/quick-replies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,content,category:S.quickCategory||'Geral'})});const d=await this.readJsonResponse(r);if(!r.ok)throw new Error(d.error||'Falha ao salvar');await this.loadQuickReplies(true);this.setState({quickTitle:'',quickContent:'',quickCategory:'Geral'});this.fireToast('Resposta rápida compartilhada');}catch(e){this.fireToast(e.message);}}
  async deleteQuickReply(id){try{const r=await fetch('/api/crm/quick-replies/'+id,{method:'DELETE'});const d=await this.readJsonResponse(r);if(!r.ok)throw new Error(d.error||'Falha ao excluir');await this.loadQuickReplies(true);}catch(e){this.fireToast(e.message);}}
  async loadIntegrationHealth(silent=false){try{const r=await fetch('/api/crm/integrations/health');const d=await this.readJsonResponse(r);if(!r.ok)throw new Error(d.error||'Falha no monitor');this.setState({integrationHealth:d.items||[]});}catch(e){if(!silent)this.fireToast(e.message);}}
  async scheduleReturn(){const S=this.state,id=S.activeConvId;if(!id||!S.scheduledDate||!S.scheduledTime)return this.fireToast('Escolha data e horário');try{const r=await fetch('/api/crm/conversations/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({scheduled_return_at:S.scheduledDate+'T'+S.scheduledTime})});const d=await this.readJsonResponse(r);if(!r.ok)throw new Error(d.error||'Falha ao programar retorno');this.setState({modal:null,scheduledDate:'',scheduledTime:''});this.fireToast('Retorno programado; a conversa voltará à fila automaticamente');await Promise.all([this.loadConversations(true),this.loadMetrics(true)]);}catch(e){this.fireToast(e.message);}}
  async loadMetrics(silent=false){`, 'new methods');

rep("  async resolveConversation(){const id=this.state.activeConvId;if(!id)return;try{const response=await fetch(`/api/crm/conversations/${id}/resolve`,{method:'POST'});const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao resolver');this.fireToast('Conversa resolvida e contabilizada para você');await Promise.all([this.loadConversations(true),this.loadMetrics(true),this.loadAgents(true)]);}catch(error){this.fireToast(error.message||'Falha ao resolver conversa');}}",
`  async resolveConversation(){const id=this.state.activeConvId,reason=this.state.resolutionReason;if(!id)return;if(!reason)return this.fireToast('Selecione o motivo da resolução');try{const response=await fetch(\`/api/crm/conversations/\${id}/resolve\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao resolver');this.setState({modal:null,resolutionReason:''});this.fireToast('Conversa resolvida: '+reason);await Promise.all([this.loadConversations(true),this.loadMetrics(true),this.loadAgents(true)]);}catch(error){this.fireToast(error.message||'Falha ao resolver conversa');}}`, 'resolve method');

rep("resolveConv:()=>this.resolveConversation()", "resolveConv:()=>this.setState({modal:'resolve',resolutionReason:''})", 'resolve open');
rep("modalTransfer:S.modal==='transfer',modalQr:S.modal==='qr',modalSchedule:S.modal==='schedule'",
    "modalTransfer:S.modal==='transfer',modalQr:S.modal==='qr',modalResolve:S.modal==='resolve',modalSchedule:S.modal==='schedule'", 'modal flag');
rep("openSearch:()=>this.setState({modal:'search',newSearchQuery:''}),openTransfer:open('transfer'),openSchedule:open('schedule'),openQuick:open('quick')",
    "openSearch:()=>this.setState({modal:'search',newSearchQuery:''}),openTransfer:open('transfer'),openSchedule:()=>this.setState({modal:'schedule',scheduledDate:'',scheduledTime:''}),openQuick:open('quick')", 'open schedule');
rep("confirmSchedule:()=>{this.setState({modal:null});this.fireToast('Conecte o primeiro canal para habilitar o adiamento');}",
    "confirmSchedule:()=>this.scheduleReturn()", 'confirm schedule');

rep("const quickManage=[];", `const quickManage=(S.quickReplyItems||[]).map(q=>({id:q.id,title:q.title,content:q.content,category:q.category,pick:()=>{this.setState({draft:q.content,modal:null});},remove:()=>this.deleteQuickReply(q.id)}));`, 'quick list');
rep("quickReplies:[],", "quickReplies:(S.quickReplyItems||[]).slice(0,8).map(q=>({text:q.title,pick:()=>this.setState({draft:q.content})})),", 'quick chips');

rep("const slaRows=[{p:'alta',value:'15'},{p:'media',value:'60'},{p:'baixa',value:'240'}].map(s=>({label:this.prio[s.p].label,value:s.value,chipStyle:this.prioChip(s.p)}));",
`const slaRows=(this.crmChannels||[]).map(ch=>({label:ch.display_name||ch.instance_name,value:String(ch.sla_minutes||60),chipStyle:'background:var(--chip);color:var(--chipT);font-size:12px;font-weight:800;padding:5px 10px;border-radius:16px',onChange:e=>this.updateChannelSync(ch.id,{sla_minutes:Number(e.target.value||60)})}));`, 'sla rows');
rep("<input value=\"{{ s.value }}\" style=", "<input value=\"{{ s.value }}\" sc-camel-on-change=\"{{ s.onChange }}\" style=", 'sla onChange');
rep("SLA por prioridade", "SLA configurável por canal", 'sla title');

const scheduleStart=t.indexOf('  <sc-if value="{{ modalSchedule }}">');
const quickStart=t.indexOf('  <sc-if value="{{ modalQuick }}">',scheduleStart);
if(scheduleStart<0||quickStart<0)throw new Error('schedule modal boundaries');
const scheduleModal=`  <sc-if value="{{ modalResolve }}">
  <div sc-camel-on-click="{{ closeModal }}" style="{{ overlay }}"><div sc-camel-on-click="{{ stop }}" style="{{ modalCard }}">
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:800">Resolver atendimento</h2>
    <p style="margin:0 0 18px;color:var(--text2);font-size:13px">O motivo é obrigatório e ficará registrado no histórico.</p>
    <label style="font-size:12px;font-weight:800;color:var(--text2)">MOTIVO DA RESOLUÇÃO</label>
    <select sc-camel-on-change="{{ onResolutionReason }}" value="{{ resolutionReason }}" style="width:100%;margin-top:8px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font:inherit">
      <option value="">Selecione...</option><option>Agendou</option><option>Desistiu</option><option>Sem resposta</option><option>Informação fornecida</option><option>Contato interno</option><option>Outro</option>
    </select>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px"><button sc-camel-on-click="{{ closeModal }}" style="{{ cancelBtn }}">Cancelar</button><button sc-camel-on-click="{{ confirmResolve }}" style="{{ primaryBtn }}">Confirmar resolução</button></div>
  </div></div></sc-if>

  <sc-if value="{{ modalSchedule }}">
  <div sc-camel-on-click="{{ closeModal }}" style="{{ overlay }}"><div sc-camel-on-click="{{ stop }}" style="{{ modalCard }}">
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:800">Programar retorno</h2>
    <p style="margin:0 0 18px;color:var(--text2);font-size:13.5px">A conversa sai da fila agora e reaparece automaticamente no momento escolhido.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label style="font-size:12px;font-weight:800;color:var(--text2)">DATA</label><input type="date" value="{{ scheduledDate }}" sc-camel-on-change="{{ onScheduledDate }}" style="width:100%;margin-top:7px;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font:inherit"></div><div><label style="font-size:12px;font-weight:800;color:var(--text2)">HORÁRIO</label><input type="time" value="{{ scheduledTime }}" sc-camel-on-change="{{ onScheduledTime }}" style="width:100%;margin-top:7px;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font:inherit"></div></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px"><button sc-camel-on-click="{{ closeModal }}" style="{{ cancelBtn }}">Cancelar</button><button sc-camel-on-click="{{ confirmSchedule }}" style="{{ primaryBtn }}">Programar retorno</button></div>
  </div></div></sc-if>

`;
t=t.slice(0,scheduleStart)+scheduleModal+t.slice(quickStart);

const quickModalStart=t.indexOf('  <sc-if value="{{ modalQuick }}">');
const quickModalEnd=t.indexOf('  <sc-if value="{{ modalSearch }}">',quickModalStart);
if(quickModalStart<0||quickModalEnd<0)throw new Error('quick modal boundaries');
const quickModal=`  <sc-if value="{{ modalQuick }}">
  <div sc-camel-on-click="{{ closeModal }}" style="{{ overlay }}"><div sc-camel-on-click="{{ stop }}" style="{{ modalCard }};max-width:620px">
    <h2 style="margin:0 0 5px;font-size:20px;font-weight:800">Respostas rápidas compartilhadas</h2><p style="margin:0 0 16px;color:var(--text2);font-size:13px">Cadastre uma vez e toda a equipe poderá usar.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input value="{{ quickTitle }}" sc-camel-on-input="{{ onQuickTitle }}" placeholder="Título: Localização" style="padding:11px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font:inherit"><input value="{{ quickCategory }}" sc-camel-on-input="{{ onQuickCategory }}" placeholder="Categoria" style="padding:11px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font:inherit"></div>
    <textarea value="{{ quickContent }}" sc-camel-on-input="{{ onQuickContent }}" placeholder="Mensagem completa..." style="width:100%;min-height:90px;margin-top:10px;padding:11px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);font:inherit"></textarea>
    <div style="display:flex;justify-content:flex-end;margin:10px 0 16px"><button sc-camel-on-click="{{ createQuick }}" style="{{ primaryBtn }}">+ Salvar modelo</button></div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto"><sc-for list="{{ quickManage }}" as="q"><div style="display:flex;gap:12px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:12px"><div sc-camel-on-click="{{ q.pick }}" style="flex:1;cursor:pointer"><strong>{{ q.title }}</strong><div style="font-size:11px;color:var(--text3);margin:2px 0">{{ q.category }}</div><div style="font-size:13px;color:var(--text2)">{{ q.content }}</div></div><button sc-camel-on-click="{{ q.remove }}" style="border:none;background:#fee2e2;color:#b91c1c;border-radius:8px;padding:7px 9px;cursor:pointer">Excluir</button></div></sc-for></div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px"><button sc-camel-on-click="{{ closeModal }}" style="{{ cancelBtn }}">Fechar</button></div>
  </div></div></sc-if>

`;
t=t.slice(0,quickModalStart)+quickModal+t.slice(quickModalEnd);

rep("overlay,modalCard,transferAgents,qrCells,quickManage,searchResults,snoozeOpts:['1 hora','3 horas','Amanhã 9h','Segunda 9h'],",
    "overlay,modalCard,transferAgents,qrCells,quickManage,searchResults,resolutionReason:S.resolutionReason,onResolutionReason:e=>this.setState({resolutionReason:e.target.value}),confirmResolve:()=>this.resolveConversation(),scheduledDate:S.scheduledDate,scheduledTime:S.scheduledTime,onScheduledDate:e=>this.setState({scheduledDate:e.target.value}),onScheduledTime:e=>this.setState({scheduledTime:e.target.value}),quickTitle:S.quickTitle,quickContent:S.quickContent,quickCategory:S.quickCategory,onQuickTitle:e=>this.setState({quickTitle:e.target.value}),onQuickContent:e=>this.setState({quickContent:e.target.value}),onQuickCategory:e=>this.setState({quickCategory:e.target.value}),createQuick:()=>this.createQuickReply(),", 'modal bindings');

// Monitor cards inside integrations, immediately before event log.
const logHeading='<h2 style="margin:0 0 16px;font-size:18px;font-weight:800">Eventos & automações (log)</h2>';
if(t.includes(logHeading)){
  t=t.replace(logHeading,`<h2 style="margin:0 0 12px;font-size:18px;font-weight:800">Monitor de integrações</h2><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:20px"><sc-for list="{{ healthItems }}" as="h"><div style="border:1px solid var(--line);border-radius:11px;padding:12px;background:var(--panel)"><div style="display:flex;justify-content:space-between;gap:8px"><strong>{{ h.name }}</strong><span style="{{ h.style }}">{{ h.label }}</span></div><div style="font-size:12px;color:var(--text2);margin-top:6px">{{ h.message }}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">{{ h.last }}</div></div></sc-for></div>${logHeading}`);
}
rep("kpis,volumeBars,agentRows,reportRows,contacts,contactsCount:this.contactsData.length,channels,integrations,logs,flowNodes",
    "kpis,volumeBars,agentRows,reportRows,contacts,contactsCount:this.contactsData.length,channels,integrations,logs,healthItems:(S.integrationHealth||[]).map(h=>({name:h.name,message:h.message,last:h.last_event_at||'Sem evento',label:h.status==='online'?'Online':h.status==='error'?'Falha':'Atenção',style:h.status==='online'?conn:h.status==='error'?off:'background:#fff5e6;color:#b26a00;font-size:11px;font-weight:800;padding:4px 9px;border-radius:20px'})),flowNodes", 'health binding');

const serialized=JSON.stringify(t).replaceAll('</script>','<\\/script>');
fs.writeFileSync(file,source.slice(0,match.index)+match[1]+serialized+match[3]+source.slice(match.index+match[0].length));
console.log('CRM_OPS_FRONTEND_V1');
