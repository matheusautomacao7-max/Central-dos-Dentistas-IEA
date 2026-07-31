import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");
let template = JSON.parse(match[2]);
if (template.includes("CRM_COMPOSER_TOOLS_V15")) process.exit(0);

function replaceRequired(before, after, label) {
  if (!template.includes(before)) throw new Error(`${label} não encontrado`);
  template = template.replace(before, after);
}

function replaceTitledButton(title, replacement) {
  const titlePosition = template.indexOf(`title="${title}"`);
  if (titlePosition < 0) throw new Error(`Botão ${title} não encontrado`);
  const start = template.lastIndexOf("<button", titlePosition);
  const end = template.indexOf("</button>", titlePosition);
  if (start < 0 || end < 0) throw new Error(`Estrutura do botão ${title} inválida`);
  template = template.slice(0, start) + replacement + template.slice(end + "</button>".length);
}

replaceTitledButton("Emoji", `<div style="position:relative;flex:0 0 auto">
            <button type="button" sc-camel-on-click="{{ toggleEmojiPicker }}" style="{{ composerIcon }}" style-hover="background:var(--hover)" title="Emoji" aria-label="Abrir seletor de emoji" aria-expanded="{{ emojiPickerOpen }}"><svg width="21" height="21" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg></button>
            <sc-if value="{{ emojiPickerOpen }}">
              <div role="dialog" aria-label="Selecionar emoji" style="position:absolute;left:0;bottom:52px;width:286px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px;box-shadow:0 12px 34px rgba(0,0,0,.18);z-index:30">
                <div style="font-size:12px;font-weight:800;color:var(--text2);margin:0 0 9px 2px">Escolha um emoji</div>
                <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">
                  <sc-for list="{{ emojiOptions }}" as="emoji"><button type="button" sc-camel-on-click="{{ emoji.onClick }}" aria-label="Inserir {{ emoji.label }}" style="width:30px;height:30px;border:none;border-radius:7px;background:transparent;cursor:pointer;font-size:19px;line-height:1" style-hover="background:var(--hover)">{{ emoji.label }}</button></sc-for>
                </div>
              </div>
            </sc-if>
          </div>`);

replaceTitledButton("Anexar arquivo", `<button type="button" sc-camel-on-click="{{ openAttachmentPicker }}" style="{{ composerIcon }}" style-hover="background:var(--hover)" title="Anexar imagem, vídeo ou arquivo" aria-label="Anexar imagem, vídeo ou arquivo"><svg width="21" height="21" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></button>
          <input id="crmAttachmentInput" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" sc-camel-on-change="{{ onAttachmentSelected }}" style="display:none">
          <sc-if value="{{ attachmentSending }}"><span style="font-size:12px;font-weight:700;color:var(--text2);white-space:nowrap;padding-bottom:13px">Enviando arquivo…</span></sc-if>`);

replaceRequired(
  `<input value="{{ draft }}" sc-camel-on-input="{{ onDraft }}" sc-camel-on-key-down="{{ onDraftKey }}" placeholder="Digite uma mensagem"`,
  `<input id="crmComposerInput" value="{{ draft }}" sc-camel-on-input="{{ onDraft }}" sc-camel-on-key-down="{{ onDraftKey }}" sc-camel-on-focus="{{ closeEmojiPicker }}" placeholder="Digite uma mensagem"`,
  "Campo de mensagem",
);

const imageBefore = `              <sc-if value="{{ m.isImage }}">
                <div style="width:220px;height:150px;border-radius:8px;background:var(--input);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--text3)">
                  <svg width="30" height="30" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.5-3.5L9 20"></path></svg>
                  <span style="font-size:12px;font-weight:600">{{ m.text }}</span>
                </div>
              </sc-if>`;
const mediaAfter = `              <sc-if value="{{ m.isImage }}">
                <a href="{{ m.mediaUrl }}" target="_blank" rel="noopener" style="display:block;color:inherit"><img src="{{ m.mediaUrl }}" alt="{{ m.text }}" style="display:block;width:260px;max-width:100%;max-height:320px;object-fit:cover;border-radius:8px"></a>
                <div style="font-size:12px;margin-top:6px;max-width:260px;overflow-wrap:anywhere">{{ m.text }}</div>
              </sc-if>
              <sc-if value="{{ m.isVideo }}">
                <video src="{{ m.mediaUrl }}" controls preload="metadata" style="display:block;width:280px;max-width:100%;max-height:340px;border-radius:8px;background:#111">Seu navegador não conseguiu reproduzir este vídeo.</video>
                <div style="font-size:12px;margin-top:6px;max-width:280px;overflow-wrap:anywhere">{{ m.text }}</div>
              </sc-if>
              <sc-if value="{{ m.isDocument }}">
                <a href="{{ m.mediaUrl }}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;min-width:220px;max-width:300px;padding:10px 12px;border-radius:9px;background:var(--input);color:var(--text);text-decoration:none">
                  <svg width="28" height="28" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  <span style="min-width:0"><span style="display:block;font-size:12px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ m.text }}</span><span style="display:block;font-size:11px;color:var(--text2);margin-top:2px">Abrir arquivo</span></span>
                </a>
              </sc-if>
              <sc-if value="{{ m.missingMedia }}"><div style="font-size:12px;color:var(--text2);font-weight:700">Arquivo indisponível</div></sc-if>`;
replaceRequired(imageBefore, mediaAfter, "Visualização de imagem");

replaceRequired(
  `recordingAudio:false, recordingSeconds:0, audioSending:false,`,
  `recordingAudio:false, recordingSeconds:0, audioSending:false, emojiPickerOpen:false, attachmentSending:false,`,
  "Estado do compositor",
);

const methods = `  // CRM_COMPOSER_TOOLS_V15
  toggleEmojiPicker(){if(this.state.attachmentSending)return;this.setState(s=>({emojiPickerOpen:!s.emojiPickerOpen}));}
  insertEmoji(value){this.setState(s=>({draft:(s.draft||'')+value}),()=>document.getElementById('crmComposerInput')?.focus());}
  openAttachmentPicker(){if(this.state.attachmentSending)return;this.setState({emojiPickerOpen:false});document.getElementById('crmAttachmentInput')?.click();}
  crmAttachmentDescriptor(file){
    const rawType=String(file?.type||'').split(';',1)[0].trim().toLowerCase(),name=String(file?.name||''),extension=(name.split('.').pop()||'').toLowerCase();
    const imageTypes=new Set(['image/jpeg','image/png','image/webp']);if(imageTypes.has(rawType))return{messageType:'image',mimeType:rawType,label:'Imagem'};
    if(rawType==='video/mp4'||extension==='mp4')return{messageType:'video',mimeType:'video/mp4',label:'Vídeo'};
    const documentByExtension={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',zip:'application/zip'};
    const allowedDocumentTypes=new Set(Object.values(documentByExtension).concat(['application/x-zip-compressed']));const documentType=allowedDocumentTypes.has(rawType)?rawType:documentByExtension[extension];
    if(documentType)return{messageType:'document',mimeType:documentType,label:'Arquivo'};
    throw new Error('Formato não suportado. Envie imagem JPG/PNG/WEBP, vídeo MP4, PDF, documento do Office, TXT ou ZIP.');
  }
  fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||'').split(',',2)[1]||'');reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo selecionado.'));reader.readAsDataURL(file);});}
  async selectAttachment(event){const input=event?.target,file=input?.files?.[0];if(!file)return;try{await this.sendAttachment(file);}finally{if(input)input.value='';}}
  async sendAttachment(file){
    if(this.state.attachmentSending)return;const id=this.state.activeConvId;if(!id){this.fireToast('Nenhuma conversa selecionada');return;}const current=this.convData.find(c=>c.id===id);if(!current?.isInternal&&!current?.assignedUserId){this.fireToast('Clique em Iniciar atendimento antes de enviar arquivos para este contato externo');return;}if(Number(file?.size||0)>12*1024*1024){this.fireToast('O arquivo ultrapassa o limite de 12 MB');return;}
    let descriptor;try{descriptor=this.crmAttachmentDescriptor(file);}catch(error){this.fireToast(error.message);return;}this.setState({attachmentSending:true,emojiPickerOpen:false});this.fireToast('Enviando '+descriptor.label.toLowerCase()+'…');
    try{const mediaBase64=await this.fileToBase64(file);if(!mediaBase64)throw new Error('O arquivo selecionado está vazio.');const response=await fetch(\`/api/crm/conversations/\${id}/messages\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message_type:descriptor.messageType,media_base64:mediaBase64,mime_type:descriptor.mimeType,file_name:file.name,text:file.name})});const data=await this.readJsonResponse(response);if(!response.ok)throw new Error(data.error||'Falha ao enviar arquivo');await Promise.all([this.loadMessages(id,true,true),this.loadConversations(true),this.loadMetrics(true)]);this.fireToast(descriptor.label+' enviado com sucesso');}catch(error){this.fireToast(error.message||'Não foi possível enviar o arquivo');}finally{this.setState({attachmentSending:false});}
  }
`;
replaceRequired(`  playCrmAudio(url){`, methods + `  playCrmAudio(url){`, "Método de reprodução de áudio");

replaceRequired(
  `isSystem:system,isText:m.type==='text',isAudio:m.type==='audio',isImage:m.type==='image',audioUrl:m.mediaUrl||'',hasPlayableAudio:m.type==='audio'&&!!m.mediaUrl,missingAudio:m.type==='audio'&&!m.mediaUrl,`,
  `isSystem:system,isText:m.type==='text',isAudio:m.type==='audio',isImage:m.type==='image'&&!!m.mediaUrl,isVideo:m.type==='video'&&!!m.mediaUrl,isDocument:m.type==='document'&&!!m.mediaUrl,missingMedia:['image','video','document'].includes(m.type)&&!m.mediaUrl,mediaUrl:m.mediaUrl||'',audioUrl:m.mediaUrl||'',hasPlayableAudio:m.type==='audio'&&!!m.mediaUrl,missingAudio:m.type==='audio'&&!m.mediaUrl,`,
  "Tipos visuais de mensagem",
);

replaceRequired(
  `    const featureSet=new Set(S.allowedFeatures||[]);`,
  `    const emojiOptions=['😀','😃','😄','😁','😊','😉','😍','🥰','😘','😋','😎','🤩','🥳','🙂','🤗','🤔','😅','😂','🤣','😢','😭','😮','😱','😴','👍','👎','👏','🙏','💪','👌','✅','❤️','💙','💚','💛','🎉','🔥','✨','📌','📅','📞','🦷','😁','💬','📎','⚠️','👋'].map(label=>({label,onClick:()=>this.insertEmoji(label)}));
    const featureSet=new Set(S.allowedFeatures||[]);`,
  "Dados do componente",
);

replaceRequired(
  `draft:S.draft,onDraft:e=>this.setState({draft:e.target.value}),onDraftKey:e=>{if(e.key==='Enter'){e.preventDefault();this.sendMsg();}},sendMsg:()=>this.sendMsg(),`,
  `draft:S.draft,onDraft:e=>this.setState({draft:e.target.value}),onDraftKey:e=>{if(e.key==='Enter'){e.preventDefault();this.sendMsg();}},sendMsg:()=>this.sendMsg(),emojiOptions,emojiPickerOpen:S.emojiPickerOpen,toggleEmojiPicker:()=>this.toggleEmojiPicker(),closeEmojiPicker:()=>this.setState({emojiPickerOpen:false}),openAttachmentPicker:()=>this.openAttachmentPicker(),onAttachmentSelected:e=>this.selectAttachment(e),attachmentSending:S.attachmentSending,`,
  "Ações do compositor",
);

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.slice(0, match.index) + match[1] + serialized + match[3] + source.slice(match.index + match[0].length));
console.log("crm-composer-tools-v15-applied");
