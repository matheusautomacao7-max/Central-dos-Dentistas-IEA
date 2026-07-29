import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");

let template = JSON.parse(match[2]);
if (template.includes("CRM_REUSABLE_TAGS_V1")) {
  console.log("crm-reusable-tags-already-applied");
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  if (!template.includes(search)) throw new Error(`Trecho não encontrado: ${label}`);
  template = template.replace(search, replacement);
}

replaceOnce(
  "newMessage:'', newConversationBusy:false }; // CRM_REALTIME_V4 CRM_START_CONVERSATION_V1",
  "newMessage:'', newConversationBusy:false, tagDraft:[], newTagName:'', tagSaving:false }; // CRM_REALTIME_V4 CRM_START_CONVERSATION_V1 CRM_REUSABLE_TAGS_V1",
  "estado das etiquetas"
);

const methodStart = template.indexOf("  async addTag(){");
const methodEnd = template.indexOf("  async removeTag(name)", methodStart);
if (methodStart < 0 || methodEnd < 0) throw new Error("Método antigo de etiquetas não encontrado");
template = template.slice(0, methodStart) + `  openTagPicker(){
    const c=this.convData.find(item=>item.id===this.state.activeConvId);if(!c)return;
    this.setState({modal:'tagPicker',tagDraft:[...(c.tags||[])],newTagName:'',tagSaving:false});
  }
  toggleTag(name){this.setState(s=>({tagDraft:(s.tagDraft||[]).includes(name)?s.tagDraft.filter(item=>item!==name):[...(s.tagDraft||[]),name]}));}
  async createTagFromPicker(){
    const clean=(this.state.newTagName||'').trim().slice(0,40);if(!clean)return;
    try{const response=await fetch('/api/crm/tags',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:clean})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao criar etiqueta');await this.loadTags(true);this.setState(s=>({newTagName:'',tagDraft:(s.tagDraft||[]).some(name=>name.toLowerCase()===clean.toLowerCase())?s.tagDraft:[...(s.tagDraft||[]),data.name||clean]}));this.fireToast('Etiqueta criada e selecionada');}catch(e){this.fireToast(e.message||'Falha ao criar etiqueta');}
  }
  async saveTagSelection(){
    const c=this.convData.find(item=>item.id===this.state.activeConvId);if(!c||this.state.tagSaving)return;
    this.setState({tagSaving:true});try{await this.crmPatch(c.id,{tag_names:[...(this.state.tagDraft||[])]});this.setState({modal:null,tagSaving:false});await this.loadConversations(true);this.fireToast('Etiquetas atualizadas');}catch(e){this.setState({tagSaving:false});this.fireToast(e.message||'Falha ao salvar etiquetas');}
  }
` + template.slice(methodEnd);

replaceOnce(
  "    const newChannels=(this.crmChannels||[]).map(ch=>({id:String(ch.id),label:(ch.display_name||ch.instance_name)+(ch.phone?' · '+ch.phone:'')}));",
  `    const newChannels=(this.crmChannels||[]).map(ch=>({id:String(ch.id),label:(ch.display_name||ch.instance_name)+(ch.phone?' · '+ch.phone:'')}));
    const selectedTags=new Set(S.tagDraft||[]);
    const tagOptions=(S.availableTags||[]).map(t=>({name:t.name,selected:selectedTags.has(t.name),check:selectedTags.has(t.name)?'✓':'',onClick:()=>this.toggleTag(t.name),style:\`display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid \${selectedTags.has(t.name)?'#25d366':'var(--line)'};background:\${selectedTags.has(t.name)?'rgba(37,211,102,.10)':'var(--panel2)'};color:var(--text);font-size:13px;font-weight:700\`}));`,
  "opções reutilizáveis"
);

replaceOnce("addTag:()=>this.addTag()", "addTag:()=>this.openTagPicker()", "abertura do seletor");
replaceOnce(
  "modalSearch:S.modal==='search',modalNewConversation:S.modal==='newConversation',",
  "modalSearch:S.modal==='search',modalNewConversation:S.modal==='newConversation',modalTagPicker:S.modal==='tagPicker',",
  "estado do modal"
);
replaceOnce(
  "newSearchQuery:S.newSearchQuery,onNewSearch:e=>this.setState({newSearchQuery:e.target.value}),newContact,newChannels,",
  "newSearchQuery:S.newSearchQuery,onNewSearch:e=>this.setState({newSearchQuery:e.target.value}),newContact,newChannels,tagOptions,hasTagOptions:tagOptions.length>0,tagDraftCount:(S.tagDraft||[]).length,newTagName:S.newTagName,onNewTagName:e=>this.setState({newTagName:e.target.value}),createTag:()=>this.createTagFromPicker(),saveTags:()=>this.saveTagSelection(),tagSaveButton:S.tagSaving?'Salvando…':'Salvar etiquetas',",
  "dados do modal"
);

const modalAnchor = `  <sc-if value="{{ modalNewConversation }}">`;
const tagModal = `  <sc-if value="{{ modalTagPicker }}">
  <div sc-camel-on-click="{{ closeModal }}" style="{{ overlay }}">
    <div sc-camel-on-click="{{ stop }}" style="{{ modalCard }};width:540px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px">
        <div><div style="font-size:11px;font-weight:800;color:#c29548;letter-spacing:1px">CATÁLOGO REUTILIZÁVEL</div><h2 style="margin:5px 0 4px;font-size:22px">Etiquetas do contato</h2><div style="color:var(--text2);font-size:13px;line-height:1.45">Cadastre uma vez e reutilize em qualquer paciente. Selecione quantas precisar.</div></div>
        <button sc-camel-on-click="{{ closeModal }}" style="{{ iconBtn }}">×</button>
      </div>
      <div style="font-size:11px;font-weight:800;color:var(--text3);letter-spacing:.4px;margin-bottom:9px">ETIQUETAS DISPONÍVEIS</div>
      <sc-if value="{{ hasTagOptions }}"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:260px;overflow:auto;padding:2px"><sc-for list="{{ tagOptions }}" as="tag"><div sc-camel-on-click="{{ tag.onClick }}" style="{{ tag.style }}"><span>{{ tag.name }}</span><span>{{ tag.check }}</span></div></sc-for></div></sc-if>
      <sc-if value="{{ !hasTagOptions }}"><div style="padding:18px;border:1px dashed var(--line);border-radius:10px;color:var(--text3);font-size:13px;text-align:center">Nenhuma etiqueta cadastrada ainda.</div></sc-if>
      <div style="margin-top:20px;padding-top:18px;border-top:1px solid var(--line)">
        <label style="display:block;font-size:11px;font-weight:800;color:var(--text3);margin-bottom:7px">CRIAR NOVA ETIQUETA</label>
        <div style="display:flex;gap:8px"><input value="{{ newTagName }}" sc-camel-on-input="{{ onNewTagName }}" placeholder="Ex.: Retorno urgente" maxlength="40" style="flex:1;min-width:0;border:1px solid var(--line);border-radius:10px;background:var(--input);color:var(--text);font:14px inherit;padding:11px 12px;outline:none"><button sc-camel-on-click="{{ createTag }}" style="{{ ghostBtn }};white-space:nowrap">+ Criar</button></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:20px"><span style="font-size:12px;color:var(--text2)">{{ tagDraftCount }} selecionada(s)</span><div style="display:flex;gap:10px"><button sc-camel-on-click="{{ closeModal }}" style="{{ cancelBtn }}">Cancelar</button><button sc-camel-on-click="{{ saveTags }}" style="{{ primaryBtn }}">{{ tagSaveButton }}</button></div></div>
    </div>
  </div>
  </sc-if>

`;
replaceOnce(modalAnchor, tagModal + modalAnchor, "modal de etiquetas");

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
const output = source.replace(match[0], match[1] + serialized + match[3]);
fs.writeFileSync(file, output);
console.log("crm-reusable-tags-applied");
