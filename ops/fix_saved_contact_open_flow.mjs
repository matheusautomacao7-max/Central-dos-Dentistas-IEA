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
