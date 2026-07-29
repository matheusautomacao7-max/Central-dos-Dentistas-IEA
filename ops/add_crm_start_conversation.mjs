import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const templateMatch = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!templateMatch) throw new Error("Template do CRM não encontrado.");
let template = JSON.parse(templateMatch[1]);
if (template.includes("CRM_START_CONVERSATION_V1")) {
  console.log("Início de conversa já instalado.");
  process.exit(0);
}

const replace = (before, after, label) => {
  if (!template.includes(before)) throw new Error(`Trecho não encontrado: ${label}`);
  template = template.replace(before, after);
};

replace(
  "selectedAgentId:null, pipelineRevision:0 }; // CRM_REALTIME_V4",
  "selectedAgentId:null, pipelineRevision:0, newSearchQuery:'', newContactId:'', newChannelId:'', newMessage:'', newConversationBusy:false }; // CRM_REALTIME_V4 CRM_START_CONVERSATION_V1",
  "estado do CRM",
);
replace(
  "    this.loadRealContacts();\n    this.loadTags();",
  "    this.loadRealContacts();\n    this.loadCrmChannels();\n    this.loadTags();",
  "carregamento inicial",
);
replace(
  "  async loadRealContacts(){ try{",
  `  async loadCrmChannels(){try{const response=await fetch('/api/crm/channels');const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao carregar canais');this.crmChannels=(data.items||[]).filter(item=>Number(item.active)===1);this.setState(s=>({newChannelId:s.newChannelId||String(this.crmChannels[0]?.id||'')}));}catch(error){this.crmChannels=[];this.fireToast(error.message||'Não foi possível carregar os canais');}}
  openNewConversation(contactId){const contact=this.contactsData.find(item=>String(item.id)===String(contactId));if(!contact)return;this.setState({modal:'newConversation',newContactId:String(contact.id),newChannelId:String(this.state.newChannelId||this.crmChannels?.[0]?.id||''),newMessage:'',newConversationBusy:false,newSearchQuery:''});}
  async startNewConversation(){if(this.state.newConversationBusy)return;const contact=this.contactsData.find(item=>String(item.id)===String(this.state.newContactId));if(!contact){this.fireToast('Selecione um contato');return;}const text=(this.state.newMessage||'').trim();if(!this.state.newChannelId){this.fireToast('Selecione o número de saída');return;}if(!text){this.fireToast('Digite a primeira mensagem');return;}this.setState({newConversationBusy:true});try{const response=await fetch('/api/crm/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:contact.name,phone:contact.phone,channel_id:Number(this.state.newChannelId),text})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao iniciar conversa');this.setState({modal:null,screen:'inbox',inboxFilter:'mine',activeConvId:data.conversation_id||null,newConversationBusy:false,newMessage:''});await this.loadConversations(true,'mine');const id=data.conversation_id||this.state.activeConvId;if(id)await this.openConversation(id);await Promise.all([this.loadMetrics(true),this.loadAgents(true)]);this.fireToast('Conversa iniciada e atribuída a você');}catch(error){this.setState({newConversationBusy:false});this.fireToast(error.message||'Não foi possível iniciar a conversa');}}
  async loadRealContacts(){ try{`,
  "métodos de nova conversa",
);
replace(
  `<button style="background:#25d366;color:#fff;border:none;border-radius:10px;padding:11px 20px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer" style-hover="background:#1da851">+ Novo contato</button>`,
  `<button sc-camel-on-click="{{ openSearch }}" style="background:#25d366;color:#fff;border:none;border-radius:10px;padding:11px 20px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer" style-hover="background:#1da851">+ Iniciar conversa</button>`,
  "botão de contatos",
);
replace(
  `grid-template-columns:2fr 1.4fr 1.2fr 1.5fr 1fr;gap:16px;padding:14px 22px`,
  `grid-template-columns:2fr 1.25fr 1fr 1.25fr 1fr 145px;gap:16px;padding:14px 22px`,
  "grade do cabeçalho",
);
replace(
  `<span>CONTATO</span><span>TELEFONE</span><span>ESTÁGIO</span><span>ETIQUETAS</span><span>RESPONSÁVEL</span>`,
  `<span>CONTATO</span><span>TELEFONE</span><span>ESTÁGIO</span><span>ETIQUETAS</span><span>RESPONSÁVEL</span><span>AÇÃO</span>`,
  "coluna ação",
);
replace(
  `grid-template-columns:2fr 1.4fr 1.2fr 1.5fr 1fr;gap:16px;padding:15px 22px`,
  `grid-template-columns:2fr 1.25fr 1fr 1.25fr 1fr 145px;gap:16px;padding:15px 22px`,
  "grade dos contatos",
);
replace(
  `<div style="font-size:13px;color:var(--text2);font-weight:600">{{ c.owner }}</div>\n        </div>`,
  `<div style="font-size:13px;color:var(--text2);font-weight:600">{{ c.owner }}</div>\n          <button sc-camel-on-click="{{ c.onStart }}" style="border:1px solid #25d366;background:rgba(37,211,102,.1);color:#159447;border-radius:8px;padding:8px 11px;font-weight:800;font-family:inherit;cursor:pointer">Conversar</button>\n        </div>`,
  "ação por contato",
);
replace(
  `<input autofocus="" placeholder="Buscar em conversas, contatos, mensagens…" style="flex:1;border:none;background:transparent;outline:none;font-family:inherit;font-size:15px;color:var(--text)">`,
  `<input autofocus="" value="{{ newSearchQuery }}" sc-camel-on-input="{{ onNewSearch }}" placeholder="Buscar contato por nome ou telefone…" style="flex:1;border:none;background:transparent;outline:none;font-family:inherit;font-size:15px;color:var(--text)">`,
  "busca de contato",
);
replace(
  `  <sc-if value="{{ modalSearch }}">`,
  `  <sc-if value="{{ modalNewConversation }}">
  <div sc-camel-on-click="{{ closeModal }}" style="{{ overlay }}">
    <div sc-camel-on-click="{{ stop }}" style="{{ modalCard }}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px"><div><div style="font-size:11px;font-weight:800;color:#c29548;letter-spacing:1px">NOVA CONVERSA</div><h2 style="margin:5px 0 0;font-size:22px">{{ newContact.name }}</h2><div style="margin-top:4px;color:var(--text2);font-size:13px">{{ newContact.phone }}</div></div><button sc-camel-on-click="{{ closeModal }}" style="{{ iconBtn }}">×</button></div>
      <label style="display:block;font-size:11px;font-weight:800;color:var(--text3);margin-bottom:7px">ENVIAR PELO NÚMERO</label>
      <select value="{{ newChannelId }}" sc-camel-on-change="{{ onNewChannel }}" style="{{ selectStyle }};width:100%;margin-bottom:16px"><option value="">Selecione um canal</option><sc-for list="{{ newChannels }}" as="ch"><option value="{{ ch.id }}">{{ ch.label }}</option></sc-for></select>
      <label style="display:block;font-size:11px;font-weight:800;color:var(--text3);margin-bottom:7px">PRIMEIRA MENSAGEM</label>
      <textarea value="{{ newMessage }}" sc-camel-on-input="{{ onNewMessage }}" placeholder="Digite a mensagem para iniciar o atendimento…" style="width:100%;min-height:120px;resize:vertical;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);font:14px/1.5 inherit;padding:12px;outline:none"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px"><button sc-camel-on-click="{{ closeModal }}" style="{{ cancelBtn }}">Cancelar</button><button sc-camel-on-click="{{ confirmNewConversation }}" style="{{ primaryBtn }}">{{ newConversationButton }}</button></div>
    </div>
  </div>
  </sc-if>

  <sc-if value="{{ modalSearch }}">`,
  "modal de nova conversa",
);
replace(
  `const searchSrc=this.contactsData.map(c=>({initials:c.initials,ci:c.ci,name:c.name,sub:c.phone,type:'Contato',id:null}));\n    const searchResults=searchSrc.map(r=>({initials:r.initials,avatarStyle:this.avatar(r.ci,38),name:r.name,sub:r.sub,type:r.type,onClick:()=>this.setState({modal:null,screen:'inbox',activeConvId:r.id})}));`,
  `const newQuery=(S.newSearchQuery||'').trim().toLowerCase();\n    const searchSrc=this.contactsData.filter(c=>!newQuery||(c.name+' '+c.phone).toLowerCase().includes(newQuery)).slice(0,50).map(c=>({initials:c.initials,ci:c.ci,name:c.name,sub:c.phone,type:'Contato',contactId:c.id}));\n    const searchResults=searchSrc.map(r=>({initials:r.initials,avatarStyle:this.avatar(r.ci,38),name:r.name,sub:r.sub,type:r.type,onClick:()=>this.openNewConversation(r.contactId)}));\n    const newContact=this.contactsData.find(c=>String(c.id)===String(S.newContactId))||{name:'Contato não selecionado',phone:''};\n    const newChannels=(this.crmChannels||[]).map(ch=>({id:String(ch.id),label:(ch.display_name||ch.instance_name)+(ch.phone?' · '+ch.phone:'')}));`,
  "dados do modal",
);
replace(
  `const contacts=this.contactsData.map(c=>{ const sc=this.stageColors[c.stage]||{bg:'var(--chip)',fg:'var(--chipT)'}; return {...c,avatarStyle:this.avatar(c.ci,40),stageStyle:`,
  `const contacts=this.contactsData.map(c=>{ const sc=this.stageColors[c.stage]||{bg:'var(--chip)',fg:'var(--chipT)'}; return {...c,onStart:()=>this.openNewConversation(c.id),avatarStyle:this.avatar(c.ci,40),stageStyle:`,
  "ação dos contatos",
);
replace(
  `openSearch:open('search'),openTransfer:open('transfer')`,
  `openSearch:()=>this.setState({modal:'search',newSearchQuery:''}),openTransfer:open('transfer')`,
  "abertura da busca",
);
replace(
  `modalTransfer:S.modal==='transfer',modalQr:S.modal==='qr',modalSchedule:S.modal==='schedule',modalQuick:S.modal==='quick',modalSearch:S.modal==='search',`,
  `modalTransfer:S.modal==='transfer',modalQr:S.modal==='qr',modalSchedule:S.modal==='schedule',modalQuick:S.modal==='quick',modalSearch:S.modal==='search',modalNewConversation:S.modal==='newConversation',\n      newSearchQuery:S.newSearchQuery,onNewSearch:e=>this.setState({newSearchQuery:e.target.value}),newContact,newChannels,newChannelId:S.newChannelId,onNewChannel:e=>this.setState({newChannelId:e.target.value}),newMessage:S.newMessage,onNewMessage:e=>this.setState({newMessage:e.target.value}),confirmNewConversation:()=>this.startNewConversation(),newConversationButton:S.newConversationBusy?'Enviando…':'Iniciar conversa',`,
  "propriedades do modal",
);

const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(file, source.replace(templateMatch[1], serialized), "utf8");
console.log("Início de conversa adicionado ao CRM.");
