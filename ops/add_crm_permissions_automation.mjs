import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");
let template = JSON.parse(match[2]);
if (template.includes("CRM_PERMISSION_AUTOMATION_V1")) {
  console.log("crm-permission-automation-already-applied");
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  if (!template.includes(search)) throw new Error(`Trecho não encontrado: ${label}`);
  template = template.replace(search, replacement);
}

replaceOnce(
  "history:[],createdAt:item.created_at||item.last_message_at||'',queueReason:item.assigned_user_id?'Em atendimento':'Mensagem aguardando CRC'};",
  "history:[],createdAt:item.created_at||item.last_message_at||'',channelId:item.channel_id,automationState:item.automation_state||'manual',automationFlow:item.automation_flow||'',automationTurns:Number(item.automation_turns||0),handoffReason:item.handoff_reason||'',queueReason:item.assigned_user_id?'Em atendimento':'Mensagem aguardando CRC'}; // CRM_PERMISSION_AUTOMATION_V1",
  "estado da automação na conversa"
);

replaceOnce(
  "c.tags.join('|'),c.note]));",
  "c.tags.join('|'),c.note,c.automationState,c.automationTurns,c.handoffReason]));",
  "assinatura da conversa"
);

replaceOnce(
  "const conversations = filtered.map(c=>{ const ch=this.channelDefs[c.channel]; const sel=c.id===S.activeConvId; return {",
  "const autoLabel={ai_active:'IA ativa',handoff:'Aguardando humano',paused:'Humano assumiu',completed:'Automação concluída',manual:''};\n    const conversations = filtered.map(c=>{ const ch=this.channelDefs[c.channel]; const sel=c.id===S.activeConvId; return {",
  "rótulos da automação"
);

replaceOnce(
  "tags:[...c.tags,...(!c.assignedUserId?[c.queueReason]:[])].filter(Boolean).map(t=>({label:t,style:this.tagStyle()})) }; });",
  "tags:[...c.tags,...(!c.assignedUserId?[c.queueReason]:[]),...(autoLabel[c.automationState]?[autoLabel[c.automationState]]:[])].filter(Boolean).map(t=>({label:t,style:this.tagStyle()})) }; });",
  "selo na lista"
);

replaceOnce(
  "tags:ac.tags.map(t=>({label:t,style:this.tagStyle()+';cursor:pointer',onRemove:()=>this.removeTag(t)})),history:[]};",
  "tags:ac.tags.map(t=>({label:t,style:this.tagStyle()+';cursor:pointer',onRemove:()=>this.removeTag(t)})),automationVisible:!!autoLabel[ac.automationState],automationLabel:autoLabel[ac.automationState]||'',automationFlow:ac.automationFlow||'',automationReason:ac.handoffReason||'',automationStyle:`font-size:11px;font-weight:800;padding:4px 9px;border-radius:20px;white-space:nowrap;background:${ac.automationState==='handoff'?'#fff1d6':ac.automationState==='ai_active'?'#e8efff':'#e7f7ee'};color:${ac.automationState==='handoff'?'#9a5b00':ac.automationState==='ai_active'?'#2456a6':'#177149'}`,history:[]};",
  "selo da automação no cabeçalho"
);

replaceOnce(
  '<span style="{{ activeConv.prioStyle }};flex:0 0 auto">{{ activeConv.prioLabel }}</span>',
  '<span style="{{ activeConv.prioStyle }};flex:0 0 auto">{{ activeConv.prioLabel }}</span><sc-if value="{{ activeConv.automationVisible }}"><span title="{{ activeConv.automationReason }}" style="{{ activeConv.automationStyle }}">{{ activeConv.automationLabel }}</span></sc-if>',
  "selo visual no cabeçalho"
);

replaceOnce(
  "const agents=(S.agents||[]).map((a,index)=>({id:a.id,name:a.name,ci:index%this.avatarColors.length,status:Number(a.active_count||0)?'Em atendimento':'Disponível',sc:Number(a.active_count||0)?'#f59e0b':'#25d366',active:Number(a.active_count||0),resolved:Number(a.resolved_today||0)}));",
  "const agents=(S.agents||[]).map((a,index)=>({id:a.id,name:a.name,ci:index%this.avatarColors.length,status:Number(a.active_count||0)?'Em atendimento':'Disponível',sc:Number(a.active_count||0)?'#f59e0b':'#25d366',active:Number(a.active_count||0),resolved:Number(a.resolved_today||0),scopeEnabled:Number(a.crm_channel_scope_enabled)!==0,channelIds:String(a.crm_channel_ids||'').split(',').filter(Boolean)}));",
  "permissões dos agentes"
);

replaceOnce(
  "const transferAgents=agents.map(a=>({",
  "const transferAgents=agents.filter(a=>!a.scopeEnabled||a.channelIds.includes(String(ac.channelId))).map(a=>({",
  "filtro de transferência"
);

replaceOnce(
  "const channels=(this.crmChannels||[]).map((ch,index)=>{const enabled=Number(ch.sync_enabled)!==0,connected=String(ch.connection_status||'').toLowerCase()==='conectado';return{id:ch.id,",
  "const channels=(this.crmChannels||[]).map((ch,index)=>{const enabled=Number(ch.sync_enabled)!==0,connected=String(ch.connection_status||'').toLowerCase()==='conectado',canManage=Number(ch.can_manage_automation)!==0;return{id:ch.id,",
  "permissão de gestão do canal"
);

replaceOnce(
  "onToggle:()=>this.updateChannelSync(ch.id,{sync_enabled:!enabled}),onDate:e=>this.updateChannelSync(ch.id,{sync_from_date:e.target.value}),cardStyle:",
  "onToggle:()=>canManage?this.updateChannelSync(ch.id,{sync_enabled:!enabled}):this.fireToast('Somente supervisores podem alterar este canal'),onDate:e=>canManage?this.updateChannelSync(ch.id,{sync_from_date:e.target.value}):this.fireToast('Somente supervisores podem alterar esta data'),cardStyle:",
  "bloqueio visual de gestão"
);

replaceOnce(
  "const hasChannels=channels.length>0;",
  "const hasChannels=channels.length>0,hasAutomationManager=channels.some(ch=>Number((this.crmChannels||[]).find(raw=>raw.id===ch.id)?.can_manage_automation)!==0);",
  "controle do sincronizador"
);

replaceOnce(
  "syncChannels:()=>this.startHistorySync(),",
  "syncChannels:()=>hasAutomationManager?this.startHistorySync():this.fireToast('Somente supervisores podem executar a sincronização'),",
  "ação do sincronizador"
);

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.replace(match[0], match[1] + serialized + match[3]), "utf8");
console.log("crm-permission-automation-applied");
