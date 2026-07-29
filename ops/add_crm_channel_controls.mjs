import fs from "node:fs";

const file=new URL("../app/public/crm-whatsapp.html",import.meta.url);
const source=fs.readFileSync(file,"utf8");
const match=source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if(!match)throw new Error("Template do CRM não encontrado");
let template=JSON.parse(match[2]);
if(template.includes("CRM_CHANNEL_CONTROL_V1")){console.log("crm-channel-control-already-applied");process.exit(0);}

function replaceOnce(search,replacement,label){if(!template.includes(search))throw new Error(`Trecho não encontrado: ${label}`);template=template.replace(search,replacement);}

replaceOnce(
  "recordingAudio:false, recordingSeconds:0, audioSending:false, clockTick:Date.now() }; //",
  "recordingAudio:false, recordingSeconds:0, audioSending:false, clockTick:Date.now(), channelRevision:0, integrationLogs:[], syncStatus:{running:false,phase:'Pronto para sincronizar'} }; // CRM_CHANNEL_CONTROL_V1",
  "estado dos canais"
);

replaceOnce(
  "    this.loadCrmChannels();\n    this.loadTags();",
  "    this.loadCrmChannels();\n    this.loadIntegrationLogs(true);\n    this.loadSyncStatus(true);\n    this.loadTags();",
  "carga inicial"
);
replaceOnce(
  "this.loadMetrics(true);if(this.state.screen==='funil'||this.state.screen==='supervisor')this.loadPipeline();",
  "this.loadMetrics(true);if(this.state.screen==='funil'||this.state.screen==='supervisor')this.loadPipeline();if(this.state.screen==='integracoes'){this.loadIntegrationLogs(true);this.loadSyncStatus(true);}",
  "atualização das integrações"
);

const oldLoad=`  async loadCrmChannels(){try{const response=await fetch('/api/crm/channels');const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao carregar canais');this.crmChannels=(data.items||[]).filter(item=>Number(item.active)===1);this.setState(s=>({newChannelId:s.newChannelId||String(this.crmChannels[0]?.id||'')}));}catch(error){this.crmChannels=[];this.fireToast(error.message||'Não foi possível carregar os canais');}}`;
const newLoad=`  async loadCrmChannels(){try{const response=await fetch('/api/crm/channels');const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao carregar canais');this.crmChannels=(data.items||[]).filter(item=>Number(item.active)===1);const available=this.crmChannels.find(item=>Number(item.sync_enabled)!==0);this.setState(s=>({newChannelId:(this.crmChannels.some(item=>String(item.id)===String(s.newChannelId)&&Number(item.sync_enabled)!==0)?s.newChannelId:String(available?.id||'')),channelRevision:(s.channelRevision||0)+1}));}catch(error){this.crmChannels=[];this.fireToast(error.message||'Não foi possível carregar os canais');}}
  async updateChannelSync(channelId,payload){try{const response=await fetch(\`/api/crm/channels/\${channelId}\`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Não foi possível atualizar o canal');await this.loadCrmChannels();await Promise.all([this.loadConversations(true),this.loadMetrics(true)]);this.fireToast(data.sync_enabled===0?'Canal pausado somente neste CRM':'Configuração do canal atualizada');}catch(error){this.fireToast(error.message||'Não foi possível atualizar o canal');}}
  async loadIntegrationLogs(silent=true){try{const response=await fetch('/api/crm/webhook-events');const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao carregar eventos');this.setState({integrationLogs:(data.items||[]).slice(0,20)});}catch(error){if(!silent)this.fireToast(error.message||'Não foi possível carregar os eventos');}}
  async loadSyncStatus(silent=true){try{const response=await fetch('/api/crm/evolution/sync');const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao consultar sincronização');this.setState({syncStatus:data});}catch(error){if(!silent)this.fireToast(error.message||'Não foi possível consultar a sincronização');}}
  async startHistorySync(){if(this.state.syncStatus?.running)return;try{const response=await fetch('/api/crm/evolution/sync',{method:'POST'});const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Não foi possível iniciar a sincronização');this.setState({syncStatus:data});this.fireToast('Sincronização iniciada nos canais habilitados');}catch(error){this.fireToast(error.message||'Não foi possível iniciar a sincronização');}}`;
replaceOnce(oldLoad,newLoad,"controle dos canais");

replaceOnce(
  "const newChannels=(this.crmChannels||[]).map(ch=>",
  "const newChannels=(this.crmChannels||[]).filter(ch=>Number(ch.sync_enabled)!==0).map(ch=>",
  "canais disponíveis para envio"
);

replaceOnce(
  "    const channels=[];",
  `    const channels=(this.crmChannels||[]).map((ch,index)=>{const enabled=Number(ch.sync_enabled)!==0,connected=String(ch.connection_status||'').toLowerCase()==='conectado';return{id:ch.id,name:ch.display_name||ch.instance_name,phone:ch.phone||ch.instance_name,status:connected?'Conectado':(ch.connection_status||'Pendente'),statusStyle:connected?'background:rgba(37,211,102,.14);color:#15803d':'background:rgba(239,68,68,.12);color:#dc2626',enabled,syncLabel:enabled?'Recebendo no CRM':'Pausado no CRM',syncStyle:enabled?'color:#15803d':'color:#dc2626',switchStyle:this.switchStyle(enabled),knobStyle:this.knobStyle(enabled),fromDate:ch.sync_from_date||'2026-07-20',onToggle:()=>this.updateChannelSync(ch.id,{sync_enabled:!enabled}),onDate:e=>this.updateChannelSync(ch.id,{sync_from_date:e.target.value}),cardStyle:\`background:var(--panel);border:1px solid \${enabled?'var(--line)':'rgba(239,68,68,.28)'};border-radius:14px;padding:18px 20px;opacity:\${enabled?1:.78}\`};});
    const hasChannels=channels.length>0;
    const syncRunning=!!S.syncStatus?.running,syncPhase=S.syncStatus?.phase||'Pronto para sincronizar';`,
  "dados reais dos canais"
);

replaceOnce(
  "    const integrations=[];",
  `    const integrations=[{badge:'EV',color:'#16a34a',name:'Evolution API',status:syncRunning?'Sincronizando':'Ativa',statusStyle:syncRunning?'background:#fff5e6;color:#b26a00;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px':conn,desc:'Importa somente os números habilitados acima e respeita a data inicial de cada canal.',meta:syncPhase,btnLabel:syncRunning?'Em andamento…':'Sincronizar agora',btnStyle:syncRunning?ghost:prim,onClick:()=>this.startHistorySync()}];`,
  "integração Evolution"
);
replaceOnce(
  "    const logs=[];",
  `    const logs=(S.integrationLogs||[]).map(item=>({time:String(item.received_at||'').slice(11,19)||'--:--:--',event:item.event_type||'Evento',origin:item.instance_name||'Evolution',status:item.processing_status||'Recebido',statusStyle:item.processing_status==='Falhou'?logErr:logOk}));`,
  "logs reais"
);

const sectionStart=template.indexOf('    <h2 style="margin:0 0 12px;font-size:15px;font-weight:800;color:var(--text2)">Canais WhatsApp conectados</h2>');
const sectionEnd=template.indexOf('    <h2 style="margin:0 0 12px;font-size:15px;font-weight:800;color:var(--text2)">Eventos &amp; automações (log)</h2>',sectionStart);
if(sectionStart<0||sectionEnd<0)throw new Error("Seção de integrações não encontrada");
const controls=`    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px">
      <div><h2 style="margin:0;font-size:17px;font-weight:800;color:var(--text)">Números monitorados pelo CRM</h2><p style="margin:4px 0 0;color:var(--text2);font-size:13px">Pausar aqui não desconecta o WhatsApp nem altera a Evolution.</p></div>
      <button sc-camel-on-click="{{ syncChannels }}" style="{{ primaryBtn }}">Sincronizar canais ativos</button>
    </div>
    <sc-if value="{{ hasChannels }}"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:30px">
      <sc-for list="{{ channels }}" as="ch"><div style="{{ ch.cardStyle }}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px">
          <div style="min-width:0"><div style="font-weight:800;font-size:15px">{{ ch.name }}</div><div style="font-size:12px;color:var(--text3);margin-top:3px">{{ ch.phone }}</div></div>
          <span style="{{ ch.statusStyle }};font-size:11px;font-weight:800;padding:4px 9px;border-radius:20px;white-space:nowrap">{{ ch.status }}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
          <div><div style="font-size:12px;font-weight:800;{{ ch.syncStyle }}">{{ ch.syncLabel }}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">Controla somente a entrada neste sistema</div></div>
          <div sc-camel-on-click="{{ ch.onToggle }}" style="{{ ch.switchStyle }}"><div style="{{ ch.knobStyle }}"></div></div>
        </div>
        <label style="display:block;margin-top:14px;font-size:11px;font-weight:800;color:var(--text3)">SINCRONIZAR HISTÓRICO DESDE</label>
        <input type="date" value="{{ ch.fromDate }}" sc-camel-on-change="{{ ch.onDate }}" style="width:100%;margin-top:6px;border:1px solid var(--line);background:var(--input);color:var(--text);border-radius:9px;padding:9px 11px;font:13px inherit">
      </div></sc-for>
    </div></sc-if>
    <sc-if value="{{ !hasChannels }}"><div style="padding:24px;border:1px dashed var(--line);border-radius:12px;color:var(--text2);text-align:center;margin-bottom:30px">Nenhum número foi localizado na Evolution.</div></sc-if>

    <h2 style="margin:0 0 12px;font-size:15px;font-weight:800;color:var(--text2)">Sincronização &amp; APIs</h2>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:30px">
      <sc-for list="{{ integrations }}" as="ig"><div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px 22px;display:flex;gap:16px">
        <div style="width:52px;height:52px;border-radius:13px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:#fff;background:{{ ig.color }}">{{ ig.badge }}</div>
        <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span style="font-weight:800;font-size:16px">{{ ig.name }}</span><span style="{{ ig.statusStyle }}">{{ ig.status }}</span></div><p style="margin:6px 0 12px;font-size:13px;color:var(--text2);line-height:1.5">{{ ig.desc }}</p><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ ig.meta }}</span><button sc-camel-on-click="{{ ig.onClick }}" style="{{ ig.btnStyle }};white-space:nowrap">{{ ig.btnLabel }}</button></div></div>
      </div></sc-for>
    </div>

`;
template=template.slice(0,sectionStart)+controls+template.slice(sectionEnd);

replaceOnce(
  "      campaigns,campaignKpis,templates,openCampaign:()=>this.fireToast('Nenhuma integração de campanha configurada'),",
  "      campaigns,campaignKpis,templates,openCampaign:()=>this.fireToast('Nenhuma integração de campanha configurada'),hasChannels,syncChannels:()=>this.startHistorySync(),",
  "propriedades dos controles"
);

const serialized=JSON.stringify(template).replaceAll("</script>","<\\/script>");
fs.writeFileSync(file,source.replace(match[0],match[1]+serialized+match[3]),"utf8");
console.log("crm-channel-control-applied");
