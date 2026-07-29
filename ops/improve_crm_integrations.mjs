import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error("Template do CRM não encontrado.");
let template = JSON.parse(match[1]);
if (template.includes("CRM_INTEGRATIONS_CENTER_V2")) {
  console.log("Central de integrações já atualizada.");
  process.exit(0);
}

const replace = (from, to, label) => {
  if (!template.includes(from)) throw new Error(`Trecho não encontrado: ${label}`);
  template = template.replace(from, to);
};

replace(
  "integrationLogs:[], integrationHealth:[]",
  "integrationLogs:[], automationLogs:[], integrationHealth:[]",
  "estado dos eventos n8n",
);

replace(
  "  nowTime(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }",
  `  nowTime(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
  integrationDate(value){const raw=String(value||'').trim();if(!raw)return 'Sem evento';const parts=raw.replace('T',' ').split(' ');const date=(parts[0]||'').split('-');return date.length===3?\`${'${date[2]}/${date[1]}/${date[0]}'} · \${(parts[1]||'').slice(0,8)}\`:raw;}
  // CRM_INTEGRATIONS_CENTER_V2`,
  "formatador de data das integrações",
);

replace(
  "  async loadIntegrationLogs(silent=true){try{const response=await fetch('/api/crm/webhook-events');const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao carregar eventos');this.setState({integrationLogs:(data.items||[]).slice(0,20)});}catch(error){if(!silent)this.fireToast(error.message||'Não foi possível carregar os eventos');}}",
  `  async loadIntegrationLogs(silent=true){try{const response=await fetch('/api/crm/webhook-events');const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao carregar eventos');this.setState({integrationLogs:(data.items||[]).slice(0,100)});}catch(error){if(!silent)this.fireToast(error.message||'Não foi possível carregar os eventos');}}
  async loadAutomationLogs(silent=true){try{const response=await fetch('/api/crm/automation-events');const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao carregar automações');this.setState({automationLogs:(data.items||[]).slice(0,100)});}catch(error){if(!silent)this.fireToast(error.message||'Não foi possível carregar os eventos do n8n');}}`,
  "carregamento de eventos n8n",
);

replace(
  "    this.loadIntegrationLogs(true);\n    this.loadSyncStatus(true);",
  "    this.loadIntegrationLogs(true);\n    this.loadAutomationLogs(true);\n    this.loadSyncStatus(true);",
  "carga inicial n8n",
);

replace(
  "if(this.state.screen==='integracoes'){this.loadIntegrationLogs(true);this.loadSyncStatus(true);this.loadIntegrationHealth(true);}",
  "if(this.state.screen==='integracoes'){this.loadIntegrationLogs(true);this.loadAutomationLogs(true);this.loadSyncStatus(true);this.loadIntegrationHealth(true);}",
  "atualização periódica n8n",
);

const headerEnd = `      <button sc-camel-on-click="{{ openQr }}" style="display:flex;align-items:center;gap:7px;background:#25d366;color:#fff;border:none;border-radius:10px;padding:11px 18px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer" style-hover="background:#1da851"><svg width="17" height="17" sc-camel-view-box="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>Conectar número</button>
    </div>`;
replace(
  headerEnd,
  `${headerEnd}

    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:22px">
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px"><strong style="font-size:13px">1. Canais WhatsApp</strong><p style="margin:5px 0 0;color:var(--text2);font-size:12px;line-height:1.5">Números existentes na Evolution. O botão liga ou pausa somente a entrada no CRM.</p></div>
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px"><strong style="font-size:13px">2. Evolution + Webhook</strong><p style="margin:5px 0 0;color:var(--text2);font-size:12px;line-height:1.5">A Evolution envia e recebe mensagens; o webhook entrega cada evento em tempo real.</p></div>
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px"><strong style="font-size:13px">3. n8n + Inteligência Artificial</strong><p style="margin:5px 0 0;color:var(--text2);font-size:12px;line-height:1.5">Executa campanhas e fluxos, identifica mensagens da IA e transfere oportunidades para humanos.</p></div>
    </div>`,
  "guia da central",
);

replace(
  `        <input type="date" value="{{ ch.fromDate }}" sc-camel-on-change="{{ ch.onDate }}" style="width:100%;margin-top:6px;border:1px solid var(--line);background:var(--input);color:var(--text);border-radius:9px;padding:9px 11px;font:13px inherit">`,
  `        <input type="date" value="{{ ch.fromDate }}" sc-camel-on-change="{{ ch.onDate }}" style="width:100%;margin-top:6px;border:1px solid var(--line);background:var(--input);color:var(--text);border-radius:9px;padding:9px 11px;font:13px inherit">
        <div style="display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:11px;color:var(--text3)"><span>Último evento</span><strong style="color:var(--text2)">{{ ch.lastEvent }}</strong></div>`,
  "último evento do canal",
);

replace(
  "fromDate:ch.sync_from_date||'2026-07-20',onToggle:",
  "fromDate:ch.sync_from_date||'2026-07-20',lastEvent:this.integrationDate(ch.last_event_at),onToggle:",
  "data do último evento do canal",
);

const oldIntegrations = "const integrations=[{badge:'EV',color:'#16a34a',name:'Evolution API',status:syncRunning?'Sincronizando':'Ativa',statusStyle:syncRunning?'background:#fff5e6;color:#b26a00;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px':conn,desc:'Importa somente os números habilitados acima e respeita a data inicial de cada canal.',meta:syncPhase,btnLabel:syncRunning?'Em andamento…':'Sincronizar agora',btnStyle:syncRunning?ghost:prim,onClick:()=>this.startHistorySync()}];";
const newIntegrations = "const n8nHealth=(S.integrationHealth||[]).find(item=>item.type==='n8n')||{};const integrations=[{badge:'EV',color:'#16a34a',name:'Evolution API',status:syncRunning?'Sincronizando':'Ativa',statusStyle:syncRunning?'background:#fff5e6;color:#b26a00;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px':conn,desc:'Importa somente os números habilitados acima e respeita a data inicial de cada canal.',meta:syncPhase,btnLabel:syncRunning?'Em andamento…':'Sincronizar agora',btnStyle:syncRunning?ghost:prim,onClick:()=>this.startHistorySync()},{badge:'n8n',color:'#ea4b71',name:'n8n · Automações e IA',status:n8nHealth.status==='online'?'Online':'Atenção',statusStyle:n8nHealth.status==='online'?conn:off,desc:'Recebe campanhas, mensagens da IA, resultados e transferências para atendimento humano.',meta:n8nHealth.message||'Verificando servidor e eventos…',btnLabel:'Atualizar status',btnStyle:ghost,onClick:()=>Promise.all([this.loadAutomationLogs(false),this.loadIntegrationHealth(false)])}];";
replace(oldIntegrations, newIntegrations, "card real do n8n");

const oldLogs = "const logs=(S.integrationLogs||[]).map(item=>({time:String(item.received_at||'').slice(11,19)||'--:--:--',event:item.event_type||'Evento',origin:item.instance_name||'Evolution',status:item.processing_status||'Recebido',statusStyle:item.processing_status==='Falhou'?logErr:logOk}));";
const newLogs = "const evolutionLogs=(S.integrationLogs||[]).map(item=>({sort:item.received_at||'',time:this.integrationDate(item.received_at),event:item.event_type||'Evento Evolution',origin:item.instance_name||'Evolution',status:item.processing_status||'Recebido',detail:item.error_message||'',statusStyle:item.processing_status==='Falhou'?logErr:logOk}));const automationLogs=(S.automationLogs||[]).map(item=>({sort:item.received_at||'',time:this.integrationDate(item.received_at),event:item.flow_name?`${item.flow_name} · ${item.event_type}`:(item.event_type||'Evento n8n'),origin:item.channel_name?`n8n · ${item.channel_name}`:'n8n',status:item.outcome||'Recebido',detail:item.contact_name||'',statusStyle:logOk}));const logs=[...evolutionLogs,...automationLogs].sort((a,b)=>String(b.sort).localeCompare(String(a.sort))).slice(0,100);";
replace(oldLogs, newLogs, "log unificado Evolution e n8n");

replace(
  "last:h.last_event_at||'Sem evento'",
  "last:this.integrationDate(h.last_event_at)",
  "horário legível do monitor",
);

const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(file, source.replace(match[1], serialized), "utf8");
console.log("CRM_INTEGRATIONS_CENTER_V2");
