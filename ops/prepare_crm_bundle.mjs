import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const templateMatch = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!templateMatch) throw new Error("Template do CRM não encontrado.");

let template = JSON.parse(templateMatch[1]);
if (template.includes("CRM_REAL_CONTACTS_V1")) {
  console.log("Bundle do CRM já preparado.");
  process.exit(0);
}

const replace = (pattern, replacement, label) => {
  const next = template.replace(pattern, replacement);
  if (next === template) throw new Error(`Trecho não encontrado: ${label}`);
  template = next;
};

replace(
  /state = \{ screen:'inbox',[^\n]+\};/,
  "state = { screen:'inbox', activeConvId:null, inboxFilter:'todos', showContext:true, dark:false, agentStatus:'online', statusMenuOpen:false, modal:null, stages:{}, toast:null, draft:'', sent:{}, searchQuery:'', channelFilter:'all', brandName:'CRM IEA', brandColor:'#25d366', lang:'pt', contactsLoaded:false }; // CRM_REAL_CONTACTS_V1",
  "estado inicial",
);
replace(
  /sendMsg\(\)\{[^\n]+\}/,
  "sendMsg(){ const t=(this.state.draft||'').trim(); const id=this.state.activeConvId; if(!id){this.fireToast('Nenhuma conversa selecionada');return;} if(!t)return; this.setState(s=>({sent:{...s.sent,[id]:[...(s.sent[id]||[]),{from:'me',type:'text',text:t,time:this.nowTime()}]},draft:''})); }",
  "envio de mensagem",
);
replace(
  /componentDidMount\(\)\{ this\.applyTheme\(\); \}/,
  "componentDidMount(){ this.applyTheme(); this.loadRealContacts(); }\n  async loadRealContacts(){ try{ const response=await fetch('/api/crm/contacts',{headers:{'Accept':'application/json'}}); if(!response.ok)throw new Error('Falha ao carregar contatos'); const data=await response.json(); this.contactsData=(data.items||[]).map((item,index)=>({id:item.id,name:item.name,initials:String(item.name||'').split(/\\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase(),ci:index%this.avatarColors.length,company:item.professional||'Sem responsável',phone:item.phone,stage:'Lead',owner:item.professional||'Sem responsável',tags:[],value:''})); this.setState({contactsLoaded:true}); }catch(error){ this.contactsData=[]; this.setState({contactsLoaded:true}); this.fireToast('Não foi possível carregar os contatos reais'); } }",
  "carregamento de contatos",
);
replace(
  /channelDefs = \{[\s\S]*?\n  \};\n  prio/,
  "channelDefs = { principal:{name:'Nenhum número conectado',phone:'',color:'#8696a0',tint:'rgba(134,150,160,.14)'}, vendas:{name:'Não conectado',phone:'',color:'#8696a0',tint:'rgba(134,150,160,.14)'}, suporte:{name:'Não conectado',phone:'',color:'#8696a0',tint:'rgba(134,150,160,.14)'}, financeiro:{name:'Não conectado',phone:'',color:'#8696a0',tint:'rgba(134,150,160,.14)'} };\n  prio",
  "canais fictícios",
);
replace(
  /  convData = \[[\s\S]*?\n\n  contactsData = /,
  "  convData = [];\n\n  contactsData = ",
  "conversas fictícias",
);
replace(
  /  contactsData = \[[\s\S]*?\n  stageColors = /,
  "  contactsData = [];\n  stageColors = ",
  "contatos fictícios",
);
replace(
  /const ac=this\.convData\.find\(c=>c\.id===S\.activeConvId\)\|\|this\.convData\[0\]; const ach=this\.channelDefs\[ac\.channel\];[\s\S]*?history:ac\.history \};/,
  "const ac=this.convData.find(c=>c.id===S.activeConvId)||{id:null,name:'Nenhuma conversa selecionada',initials:'',phone:'',company:'',channel:'principal',prio:'baixa',typing:false,ci:0,stage:'',owner:'',note:'',tags:[],history:[],msgs:[]}; const ach=this.channelDefs[ac.channel]||this.channelDefs.principal;\n    const activeConv={initials:ac.initials,name:ac.name,phone:ac.phone,company:ac.company,channelColor:ach.color,channelName:ach.name,typing:false,avatarStyle:this.avatar(ac.ci,42),bigAvatarStyle:this.avatar(ac.ci,84),prioStyle:this.prioChip(ac.prio),prioLabel:this.prio[ac.prio].label,stage:ac.stage,owner:ac.owner,note:ac.note,tags:[],history:[]};",
  "conversa ativa vazia",
);
replace(/const waiting=\[[^\n]+\];/, "const waiting=[];", "fila fictícia");
replace(/const kpis=\[[^\n]+\];/, "const kpis=[{label:'Conversas ativas',value:'0',delta:'Sem dados',deltaStyle:dstyle(true)},{label:'Tempo médio 1ª resp.',value:'—',delta:'Sem dados',deltaStyle:dstyle(true)},{label:'Na fila agora',value:'0',delta:'Nenhum atendimento',deltaStyle:dstyle(true)},{label:'Taxa de resolução',value:'—',delta:'Sem dados',deltaStyle:dstyle(true)}];", "indicadores fictícios");
replace(/const heights=\[[^\n]+\]; const labels=/, "const heights=[0,0,0,0,0,0,0,0,0]; const labels=", "gráfico fictício");
replace(/const agents=\[[^\n]+\];/, "const agents=[];", "agentes fictícios");
replace(/const rep=\[[^\n]+\];/, "const rep=[];", "relatório fictício");
replace(/const channels=\[[^\n]+\];/, "const channels=[];", "canais conectados fictícios");
replace(/const integrations=\[[\s\S]*?\n    \];/, "const integrations=[];", "integrações fictícias");
replace(/const logs=\[[\s\S]*?\n    \];/, "const logs=[];", "logs fictícios");
replace(/const flowNodes=\[[\s\S]*?\n    \];/, "const flowNodes=[];", "fluxo fictício");
replace(/const botHours=\[[^\n]+\];/, "const botHours=[];", "horários fictícios");
replace(/const bt=\[[^\n]+\];/, "const bt=[false,false,false,false];", "automações fictícias");
replace(/const connCards=\[[\s\S]*?\n    \];/, "const connCards=[];", "conexões fictícias");
replace(/const quickManage=\[[^\n]+\];/, "const quickManage=[];", "atalhos fictícios");
replace(/const searchSrc=\[[^\n]+\];/, "const searchSrc=this.contactsData.map(c=>({initials:c.initials,ci:c.ci,name:c.name,sub:c.phone,type:'Contato',id:null}));", "busca fictícia");
replace(/const campaigns=\[[\s\S]*?\n    \]\.map\([^\n]+\);/, "const campaigns=[];", "campanhas fictícias");
replace(/const campaignKpis=\[[\s\S]*?\n    \];/, "const campaignKpis=[{label:'Enviadas (30d)',value:'0',color:'#25d366'},{label:'Taxa de entrega',value:'—',color:'var(--text)'},{label:'Taxa de leitura',value:'—',color:'var(--text)'},{label:'Respostas',value:'0',color:'#34b7f1'}];", "indicadores de campanhas fictícios");
replace(/const templates=\[[\s\S]*?\n    \];/, "const templates=[];", "modelos de mensagem fictícios");
replace(/quickReplies:\[[^\n]+\.map\(t=>\(\{text:t,pick:[^\n]+/, "quickReplies:[],", "respostas rápidas fictícias");
replace(/channelTabs:\[[^\n]+\.map\(ct=>\{[^\n]+/, "channelTabs:[{id:'all',label:'Todos os canais',color:'#8696a0'}].map(ct=>{const on=S.channelFilter===ct.id;return{label:ct.label,color:ct.color,onClick:()=>this.setState({channelFilter:ct.id}),style:`display:flex;align-items:center;gap:6px;flex:0 0 auto;padding:5px 11px;border-radius:16px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ${on?'#25d366':'var(--line)'};background:${on?'rgba(37,211,102,.1)':'transparent'};color:${on?'#15a34a':'var(--text2)'}`};}),", "abas de canais fictícias");
replace(/queueItems,queueStats:\{waiting:5,active:27,sla:'2m 10s'\}/, "queueItems,queueStats:{waiting:0,active:0,sla:'—'}", "totais de fila fictícios");
replace(/testConn:\(\)=>this\.fireToast\('[^']+'\)/, "testConn:()=>this.fireToast('Nenhuma integração configurada')", "teste fictício");
replace(/openCampaign:\(\)=>this\.fireToast\('[^']+'\)/, "openCampaign:()=>this.fireToast('Nenhuma integração de campanha configurada')", "campanha protótipo");

const forbidden = ["Marina Alves", "Carlos Mendes", "Juliana Ramos", "Pedro Santos", "Fernanda Costa", "Rafael Oliveira", "Ana Souza", "Bruno Lima", "suaempresa.com", "Black Friday"];
const leftovers = forbidden.filter(value => template.includes(value));
if (leftovers.length) throw new Error(`Dados fictícios restantes: ${leftovers.join(", ")}`);

const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
const output = source.replace(templateMatch[1], serialized);
fs.writeFileSync(file, output, "utf8");
console.log("Bundle do CRM limpo e conectado aos contatos reais.");
