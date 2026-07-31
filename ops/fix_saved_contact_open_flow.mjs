import fs from 'node:fs';

const file = 'app/public/crm-whatsapp.html';
let html = fs.readFileSync(file, 'utf8');

const templateOpen = '<script type="__bundler/template">';
const templateOpenAt = html.indexOf(templateOpen);
const contentStart = templateOpenAt + templateOpen.length;

if (templateOpenAt < 0) {
  throw new Error('Template do CRM não encontrado.');
}

let templateEnd = -1;
let template = '';
let candidateAt = contentStart;
while ((candidateAt = html.indexOf('</script>', candidateAt)) >= 0) {
  try {
    template = JSON.parse(html.slice(contentStart, candidateAt).trim());
    templateEnd = candidateAt;
    break;
  } catch {
    candidateAt += '</script>'.length;
  }
}

if (templateEnd < contentStart) {
  throw new Error('Conteúdo serializado do CRM não encontrado.');
}

function replaceOnce(pattern, replacement, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = template.match(new RegExp(pattern.source, flags)) || [];
  if (matches.length !== 1) {
    throw new Error(`${label}: esperado 1 trecho, encontrados ${matches.length}.`);
  }
  template = template.replace(pattern, replacement);
}

if (!template.includes('open_only:true')) {
  replaceOnce(
    /async startNewConversation\(\)\{[\s\S]*?\}\}\s*async loadRealContacts\(\)\{/,
    `async startNewConversation(){if(this.state.newConversationBusy)return;const contact=this.contactsData.find(item=>String(item.id)===String(this.state.newContactId));if(!contact){this.fireToast('Selecione um contato');return;}if(!this.state.newChannelId){this.fireToast('Selecione o número de saída');return;}this.setState({newConversationBusy:true});try{const response=await fetch('/api/crm/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:contact.name,phone:contact.phone,channel_id:Number(this.state.newChannelId),open_only:true})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao abrir conversa');this.setState({modal:null,screen:'inbox',inboxFilter:'mine',activeConvId:data.conversation_id||null,newConversationBusy:false,newMessage:''});await this.loadConversations(true,'mine');const id=data.conversation_id||this.state.activeConvId;if(id)await this.openConversation(id);await Promise.all([this.loadMetrics(true),this.loadAgents(true)]);this.fireToast('Conversa aberta e atribuída a você');}catch(error){this.setState({newConversationBusy:false});this.fireToast(error.message||'Não foi possível abrir a conversa');}}
    async loadRealContacts(){`,
    'Fluxo de abertura da conversa',
  );
}

if (!template.includes('CRM_START_CONVERSATION_STABLE_V2') && !template.includes('CRM_CONVERSATION_RELOAD_RESUME_V4') && !template.includes('CRM_CONVERSATION_AUTO_REVEAL_V5')) {
  replaceOnce(
    /async startNewConversation\(\)\{[\s\S]*?\}\}\s*async loadRealContacts\(\)\{/,
    `async startNewConversation(){if(this.state.newConversationBusy)return;const contact=this.contactsData.find(item=>String(item.id)===String(this.state.newContactId));if(!contact){this.fireToast('Selecione um contato');return;}if(!this.state.newChannelId){this.fireToast('Selecione o número de saída');return;}this.setState({newConversationBusy:true});try{const response=await fetch('/api/crm/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:contact.name,phone:contact.phone,channel_id:Number(this.state.newChannelId),open_only:true})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao abrir conversa');const id=Number(data.conversation_id||0);if(!id)throw new Error('A conversa foi criada sem um identificador válido');await new Promise(resolve=>this.setState({modal:null,screen:'inbox',inboxFilter:'mine',activeConvId:null,newConversationBusy:false,newMessage:'',searchQuery:''},resolve));await this.loadConversations(true,'mine','');await new Promise(resolve=>this.setState({activeConvId:id},resolve));await this.loadMessages(id,false,true);await Promise.all([this.loadMetrics(true),this.loadAgents(true)]);this.fireToast('Conversa aberta e atribuída a você'); // CRM_START_CONVERSATION_STABLE_V2
    }catch(error){this.setState({newConversationBusy:false});this.fireToast(error.message||'Não foi possível abrir a conversa');}}
    async loadRealContacts(){`,
    'Fluxo estável de abertura da conversa',
  );
}

if (!template.includes('CRM_CONVERSATION_ID_NORMALIZED_V3')) {
  replaceOnce(
    /const data=await this\.readJsonResponse\(response\),previous=this\.state\.activeConvId,oldById=new Map\(this\.convData\.map\(c=>\[c\.id,c\]\)\);/,
    `const data=await this.readJsonResponse(response),previous=Number(this.state.activeConvId||0)||null,oldById=new Map(this.convData.map(c=>[Number(c.id),c])); // CRM_CONVERSATION_ID_NORMALIZED_V3`,
    'Normalização do estado da conversa',
  );
  replaceOnce(
    /const channel='channel'\+item\.channel_id,old=oldById\.get\(item\.id\),colorIndex=/,
    `const channel='channel'+item.channel_id,old=oldById.get(Number(item.id)),colorIndex=`,
    'Normalização do cache da conversa',
  );
  replaceOnce(
    /return \{id:item\.id,contactId:item\.contact_id,/,
    `return {id:Number(item.id),contactId:item.contact_id,`,
    'Normalização do ID carregado',
  );
  replaceOnce(
    /openConversation\(id\)\{this\.setState\(\{activeConvId:id\}\);this\.loadMessages\(id,false,true\);\}/,
    `openConversation(id){const conversationId=Number(id||0)||null;this.setState({activeConvId:conversationId});if(conversationId)this.loadMessages(conversationId,false,true);}`,
    'Normalização da abertura manual',
  );
  replaceOnce(
    /this\.convData\.find\(c=>c\.id===S\.activeConvId\)/,
    `this.convData.find(c=>Number(c.id)===Number(S.activeConvId))`,
    'Normalização da conversa renderizada',
  );
}

if (!template.includes('CRM_CONVERSATION_RELOAD_RESUME_V4') && !template.includes('CRM_CONVERSATION_AUTO_REVEAL_V5')) {
  replaceOnce(
    /componentDidMount\(\)\{([\s\S]*?)this\.loadMetrics\(\);\s*this\.loadConversations\(false,'active'\);/,
    `componentDidMount(){$1this.loadMetrics();
    this.resumePendingConversation(); // CRM_CONVERSATION_RELOAD_RESUME_V4`,
    'Restauração da conversa após recarregar',
  );
  replaceOnce(
    /async startNewConversation\(\)\{[\s\S]*?\}\}\s*async loadRealContacts\(\)\{/,
    `async startNewConversation(){if(this.state.newConversationBusy)return;const contact=this.contactsData.find(item=>String(item.id)===String(this.state.newContactId));if(!contact){this.fireToast('Selecione um contato');return;}if(!this.state.newChannelId){this.fireToast('Selecione o número de saída');return;}this.setState({newConversationBusy:true});try{const response=await fetch('/api/crm/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:contact.name,phone:contact.phone,channel_id:Number(this.state.newChannelId),open_only:true})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao abrir conversa');const id=Number(data.conversation_id||0);if(!id)throw new Error('A conversa foi criada sem um identificador válido');sessionStorage.setItem('iea.crm.pendingConversationId',String(id));window.location.replace('/central-crc/whatsapp?conversation='+encodeURIComponent(id)+'&reload='+Date.now());}catch(error){this.setState({newConversationBusy:false});this.fireToast(error.message||'Não foi possível abrir a conversa');}}
    async resumePendingConversation(){const id=Number(sessionStorage.getItem('iea.crm.pendingConversationId')||0)||null;sessionStorage.removeItem('iea.crm.pendingConversationId');if(!id){await this.loadConversations(false,'active','');return;}await new Promise(resolve=>this.setState({screen:'inbox',inboxFilter:'mine',activeConvId:id,searchQuery:''},resolve));await this.loadConversations(false,'mine','');await new Promise(resolve=>this.setState({activeConvId:id},resolve));await this.loadMessages(id,false,true);this.fireToast('Conversa aberta e atribuída a você');}
    async loadRealContacts(){`,
    'Recarga confiável da conversa criada',
  );
  replaceOnce(
    /tags:\[\.\.\.c\.tags,\.\.\.\(!c\.assignedUserId\?\[c\.queueReason\]:\[\]\),\.\.\.\(autoLabel\[c\.automationState\]\?\[autoLabel\[c\.automationState\]\]:\[\]\)\]/,
    `tags:[...c.tags,...(c.assignedUserId?['Atendente: '+c.owner]:[c.queueReason]),...(autoLabel[c.automationState]?[autoLabel[c.automationState]]:[])]`,
    'Identificação visual do atendente',
  );
}

if (!template.includes('CRM_CONVERSATION_AUTO_REVEAL_V5')) {
  replaceOnce(
    /this\.resumePendingConversation\(\); \/\/ CRM_CONVERSATION_RELOAD_RESUME_V4/,
    `this.loadConversations(false,'active',''); // CRM_CONVERSATION_AUTO_REVEAL_V5`,
    'Carga inicial sem recarregar a pÃ¡gina',
  );
  replaceOnce(
    /\},8000\);\s*this\._messageTimer=/,
    `},3000);
    this._messageTimer=`,
    'SincronizaÃ§Ã£o automÃ¡tica da lista',
  );
  replaceOnce(
    /async startNewConversation\(\)\{[\s\S]*?\}\s*async loadRealContacts\(\)\{/,
    `async startNewConversation(){if(this.state.newConversationBusy)return;const contact=this.contactsData.find(item=>String(item.id)===String(this.state.newContactId));if(!contact){this.fireToast('Selecione um contato');return;}if(!this.state.newChannelId){this.fireToast('Selecione o nÃºmero de saÃ­da');return;}this.setState({newConversationBusy:true});try{const response=await fetch('/api/crm/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:contact.name,phone:contact.phone,channel_id:Number(this.state.newChannelId),open_only:true})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao abrir conversa');const id=Number(data.conversation_id||0);if(!id)throw new Error('A conversa foi criada sem um identificador vÃ¡lido');await this.revealConversation(id,!!data.reused);}catch(error){this.setState({newConversationBusy:false});this.fireToast(error.message||'NÃ£o foi possÃ­vel abrir a conversa');}}
    async revealConversation(id,reused=false){await new Promise(resolve=>this.setState({modal:null,screen:'inbox',inboxFilter:'mine',activeConvId:id,newConversationBusy:false,newMessage:'',searchQuery:''},resolve));for(let attempt=0;attempt<12;attempt+=1){await this.loadConversations(true,'mine','');if(this.convData.some(item=>Number(item.id)===Number(id))){await new Promise(resolve=>this.setState({activeConvId:Number(id)},resolve));await this.loadMessages(Number(id),false,true);await Promise.all([this.loadMetrics(true),this.loadAgents(true)]);this.fireToast(reused?'Conversa existente aberta e atribuÃ­da a vocÃª':'Conversa aberta e atribuÃ­da a vocÃª');return;}await new Promise(resolve=>setTimeout(resolve,250));}throw new Error('A conversa foi criada, mas nÃ£o apareceu na lista. Tente novamente.');}
    async loadRealContacts(){`,
    'Abertura automÃ¡tica com tentativas',
  );
}

if (!template.includes('CRM_ATTENDANCE_TIMELINE_V6')) {
  replaceOnce(
    /async loadMessages\(id,silent=false,forceBottom=false,incremental=false\)\{/,
    `async loadTimeline(id,silent=true){try{const target=this.convData.find(c=>Number(c.id)===Number(id));if(!target)return;const response=await fetch(\`/api/crm/conversations/\${id}/timeline\`,{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error('Falha ao carregar histórico');const data=await this.readJsonResponse(response);const labels={
      'conversation.started':['Atendimento iniciado por ','#2563eb'],
      'conversation.assigned':['Atendimento assumido por ','#16a34a'],
      'conversation.assignment_restored':['Atendimento atribuído a ','#16a34a'],
      'conversation.transferred':['Atendimento transferido por ','#f59e0b'],
      'conversation.resolved':['Atendimento finalizado por ','#7c3aed'],
      'return.scheduled':['Retorno programado por ','#0ea5e9'],
      'return.reopened':['Atendimento reaberto por ','#0ea5e9']};target.history=(data.events||[]).filter(event=>labels[event.event_type]).map(event=>{const entry=labels[event.event_type],parsed=this.parseDate(event.created_at);return{title:entry[0]+(event.actor_name||'Sistema'),date:parsed?parsed.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):String(event.created_at||''),color:entry[1]};});this.setState(s=>({timelineRevision:(s.timelineRevision||0)+1})); // CRM_ATTENDANCE_TIMELINE_V6
    }catch(error){if(!silent)this.fireToast('Não foi possível carregar o histórico do atendimento');}}
  async loadMessages(id,silent=false,forceBottom=false,incremental=false){`,
    'Carregamento do histórico de atendimento',
  );
  replaceOnce(
    /if\(active&&\(!oldActive\|\|!oldActive\.msgs\.length\|\|oldActive\.rawLast!==nextActive\.rawLast\)\)await this\.loadMessages\(active,true,!oldActive\);/,
    `if(active&&(!oldActive||!oldActive.msgs.length||oldActive.rawLast!==nextActive.rawLast))await Promise.all([this.loadMessages(active,true,!oldActive),this.loadTimeline(active,true)]);`,
    'Histórico na seleção automática',
  );
  replaceOnce(
    /openConversation\(id\)\{const conversationId=Number\(id\|\|0\)\|\|null;this\.setState\(\{activeConvId:conversationId\}\);if\(conversationId\)this\.loadMessages\(conversationId,false,true\);\}/,
    `openConversation(id){const conversationId=Number(id||0)||null;this.setState({activeConvId:conversationId});if(conversationId)Promise.all([this.loadMessages(conversationId,false,true),this.loadTimeline(conversationId,false)]);}`,
    'Histórico ao abrir a conversa',
  );
  replaceOnce(
    /await this\.loadMessages\(id,true,true\);this\.fireToast\('Atendimento iniciado e atribuído a você'\);/,
    `await Promise.all([this.loadMessages(id,true,true),this.loadTimeline(id,true)]);this.fireToast('Atendimento iniciado e atribuído a você');`,
    'Histórico ao assumir atendimento',
  );
  replaceOnce(
    /await this\.loadMessages\(Number\(id\),false,true\);await Promise\.all\(\[this\.loadMetrics\(true\),this\.loadAgents\(true\)\]\);/,
    `await Promise.all([this.loadMessages(Number(id),false,true),this.loadTimeline(Number(id),true),this.loadMetrics(true),this.loadAgents(true)]);`,
    'Histórico ao iniciar atendimento',
  );
  replaceOnce(
    /automationStyle:`([^`]+)`,history:\[\]\};/,
    'automationStyle:`$1`,history:ac.history||[]};',
    'Histórico no painel lateral',
  );
  replaceOnce(
    /<span style="width:10px;height:10px;border-radius:50%;background:#25d366;flex:0 0 auto;margin-top:3px"><\/span>/,
    `<span style="width:10px;height:10px;border-radius:50%;background:{{ h.color }};flex:0 0 auto;margin-top:3px"></span>`,
    'Cor do evento no histórico',
  );
}

if (!template.includes('CRM_TIMELINE_STATE_STABLE_V7')) {
  replaceOnce(
    /note:item\.internal_note\|\|'',history:\[\],createdAt:/,
    `note:item.internal_note||'',history:old?.history||[],/* CRM_TIMELINE_STATE_STABLE_V7 */createdAt:`,
    'Preservação do histórico durante a sincronização',
  );
}

if (template.includes('PRIMEIRA MENSAGEM')) {
  replaceOnce(
    /\s*<label style="display:block;font-size:11px;font-weight:800;color:var\(--text3\);margin-bottom:7px">PRIMEIRA MENSAGEM<\/label>\s*<textarea value="\{\{ newMessage \}\}" sc-camel-on-input="\{\{ onNewMessage \}\}"[\s\S]*?<\/textarea>/,
    '',
    'Campo de primeira mensagem',
  );
}

if (template.includes("newConversationButton:S.newConversationBusy?'Enviando…':'Iniciar conversa'")) {
  replaceOnce(
    /newConversationButton:S\.newConversationBusy\?'Enviando…':'Iniciar conversa'/,
    `newConversationButton:S.newConversationBusy?'Abrindo…':'Abrir conversa'`,
    'Texto do botão',
  );
}

const serializedTemplate = JSON.stringify(template).replace(/<\/script/gi, '<\\/script');
html = `${html.slice(0, contentStart)}\n${serializedTemplate}\n${html.slice(templateEnd)}`;
html = html.replace(/\r\n/g, '\n');
fs.writeFileSync(file, html);

console.log('Fluxo de contato salvo atualizado.');
