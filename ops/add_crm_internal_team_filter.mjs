import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");

let template = JSON.parse(match[2]);
if (template.includes("CRM_INTERNAL_TEAM_FILTER_V14")) process.exit(0);

const avatarBefore = `        <div style="{{ activeConv.bigAvatarStyle }}">{{ activeConv.initials }}</div>`;
const avatarAfter = `        <div style="display:flex;justify-content:center;width:100%"><div style="{{ activeConv.bigAvatarStyle }}">{{ activeConv.initials }}</div></div><!-- CRM_INTERNAL_TEAM_FILTER_V14 -->`;
if (!template.includes(avatarBefore)) throw new Error("Avatar do painel lateral não encontrado");
template = template.replace(avatarBefore, avatarAfter);

const tabsBefore = `        <div style="display:flex;gap:8px;margin-top:12px">
          <div sc-camel-on-click="{{ filterTodos }}" style="{{ tabTodosStyle }}">Recentes</div>
          <div sc-camel-on-click="{{ filterNao }}" style="{{ tabNaoStyle }}">Fila <sc-if value="{{ hasQueueBadge }}">({{ queueBadge }})</sc-if></div>
          <div sc-camel-on-click="{{ filterAlta }}" style="{{ tabAltaStyle }}">Meus atendimentos</div>
        </div>`;
const tabsAfter = `        <div style="display:flex;gap:8px;margin-top:12px;overflow-x:auto;padding-bottom:2px" role="tablist" aria-label="Visualização das conversas">
          <div sc-camel-on-click="{{ filterTodos }}" style="{{ tabTodosStyle }}" role="tab">Recentes</div>
          <div sc-camel-on-click="{{ filterNao }}" style="{{ tabNaoStyle }}" role="tab">Fila <sc-if value="{{ hasQueueBadge }}">({{ queueBadge }})</sc-if></div>
          <div sc-camel-on-click="{{ filterAlta }}" style="{{ tabAltaStyle }}" role="tab">Meus atendimentos</div>
          <div sc-camel-on-click="{{ filterInternos }}" style="{{ tabInternosStyle }}" role="tab" title="Contatos internos da clínica">Equipe</div>
        </div>`;
if (!template.includes(tabsBefore)) throw new Error("Abas do Inbox não encontradas");
template = template.replace(tabsBefore, tabsAfter);

const handlersBefore = `      filterTodos:()=>this.switchInbox('active'),filterNao:()=>this.switchInbox('queue'),filterAlta:()=>this.switchInbox('mine'),
      tabTodosStyle:this.tabStyle(S.inboxFilter==='active'),tabNaoStyle:this.tabStyle(S.inboxFilter==='queue'),tabAltaStyle:this.tabStyle(S.inboxFilter==='mine'),`;
const handlersAfter = `      filterTodos:()=>this.switchInbox('active'),filterNao:()=>this.switchInbox('queue'),filterAlta:()=>this.switchInbox('mine'),filterInternos:()=>this.switchInbox('internal'),
      tabTodosStyle:this.tabStyle(S.inboxFilter==='active'),tabNaoStyle:this.tabStyle(S.inboxFilter==='queue'),tabAltaStyle:this.tabStyle(S.inboxFilter==='mine'),tabInternosStyle:this.tabStyle(S.inboxFilter==='internal'),`;
if (!template.includes(handlersBefore)) throw new Error("Ações das abas do Inbox não encontradas");
template = template.replace(handlersBefore, handlersAfter);

const tagsBefore = `tags:[...c.tags,...(c.assignedUserId?['Atendente: '+c.owner]:[c.queueReason]),...(autoLabel[c.automationState]?[autoLabel[c.automationState]]:[])].filter(Boolean)`;
const tagsAfter = `tags:[...c.tags,...(c.isInternal?['Contato interno da equipe']:(c.assignedUserId?['Atendente: '+c.owner]:[c.queueReason])),...(autoLabel[c.automationState]?[autoLabel[c.automationState]]:[])].filter(Boolean)`;
if (!template.includes(tagsBefore)) throw new Error("Etiquetas dos cartões de conversa não encontradas");
template = template.replace(tagsBefore, tagsAfter);

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.slice(0, match.index) + match[1] + serialized + match[3] + source.slice(match.index + match[0].length));
console.log("crm-internal-team-filter-v14-applied");
