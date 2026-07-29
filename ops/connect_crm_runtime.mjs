import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error("Template do CRM não encontrado.");
let template = JSON.parse(match[1]);

const replace = (from, to, label) => {
  if (template.includes(to)) return;
  if (!template.includes(from)) throw new Error(`Trecho não encontrado: ${label}`);
  template = template.replace(from, to);
};

replace(
  "componentDidMount(){ this.applyTheme(); this.loadRealContacts(); }\n  async loadRealContacts()",
  "componentDidMount(){ this.applyTheme(); this.loadRealContacts(); this.loadConversations(); this._crmTimer=setInterval(()=>this.loadConversations(true),5000); }\n  componentWillUnmount(){ if(this._crmTimer)clearInterval(this._crmTimer); }\n  async loadConversations(silent=false){ try{ const response=await fetch('/api/crm/conversations',{headers:{'Accept':'application/json'}}); if(!response.ok)throw new Error('Falha ao carregar conversas'); const data=await response.json(); const previous=this.state.activeConvId; this.convData=(data.items||[]).map((item,index)=>{const channel='channel'+item.channel_id;this.channelDefs[channel]={name:item.channel_name||item.instance_name,phone:item.channel_phone||'',color:this.avatarColors[index%this.avatarColors.length],tint:'rgba(37,211,102,.12)'};return{id:item.id,name:item.name,initials:String(item.name||'').split(/\\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase(),phone:item.phone,company:item.channel_name||item.instance_name,channel,prio:String(item.priority||'normal').toLowerCase().replace('normal','media'),unread:item.unread_count||0,time:item.last_message_at?String(item.last_message_at).slice(11,16):'',snippet:item.snippet||'',snoozed:false,tags:[],msgs:[],ci:index%this.avatarColors.length,stage:item.status||'Aberta',owner:item.assigned_to||'Não atribuído',note:'',history:[]};}); const active=this.convData.some(c=>c.id===previous)?previous:(this.convData[0]?.id||null); this.setState({activeConvId:active}); if(active)await this.loadMessages(active,true); }catch(error){if(!silent)this.fireToast('Não foi possível carregar as conversas');} }\n  async loadMessages(id,silent=false){ try{const response=await fetch(`/api/crm/conversations/${id}/messages`,{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error('Falha ao carregar mensagens');const data=await response.json();const target=this.convData.find(c=>c.id===id);if(target)target.msgs=(data.items||[]).map(m=>({from:m.direction==='inbound'?'them':'me',type:m.message_type||'text',text:m.body||'',time:String(m.message_at||'').slice(11,16),mediaUrl:m.media_url||'',dur:''}));this.setState({activeConvId:id});}catch(error){if(!silent)this.fireToast('Não foi possível carregar as mensagens');}}\n  openConversation(id){this.loadMessages(id);}\n  async loadRealContacts()",
  "inicialização do CRM real",
);

replace(
  "sendMsg(){ const t=(this.state.draft||'').trim(); const id=this.state.activeConvId; if(!id){this.fireToast('Nenhuma conversa selecionada');return;} if(!t)return; this.setState(s=>({sent:{...s.sent,[id]:[...(s.sent[id]||[]),{from:'me',type:'text',text:t,time:this.nowTime()}]},draft:''})); }",
  "async sendMsg(){const t=(this.state.draft||'').trim(),id=this.state.activeConvId;if(!id){this.fireToast('Nenhuma conversa selecionada');return;}if(!t)return;this.setState({draft:''});try{const response=await fetch(`/api/crm/conversations/${id}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao enviar');await this.loadMessages(id,true);await this.loadConversations(true);}catch(error){this.setState({draft:t});this.fireToast(error.message||'Falha ao enviar mensagem');}}\n  async resolveConversation(){const id=this.state.activeConvId;if(!id)return;try{const response=await fetch(`/api/crm/conversations/${id}/resolve`,{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao resolver');this.fireToast('Conversa resolvida');await this.loadConversations(true);}catch(error){this.fireToast(error.message||'Falha ao resolver conversa');}}",
  "envio real",
);

replace(
  "onClick:()=>this.setState({activeConvId:c.id}),",
  "onClick:()=>this.openConversation(c.id),",
  "abertura da conversa",
);

replace(
  "resolveConv:()=>this.fireToast('Conversa marcada como resolvida'),",
  "resolveConv:()=>this.resolveConversation(),",
  "resolução real",
);

const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(file, source.replace(match[1], serialized), "utf8");
console.log("CRM conectado ao runtime real de conversas e mensagens.");
