import fs from "node:fs";

const file=new URL("../app/public/crm-whatsapp.html",import.meta.url);
const source=fs.readFileSync(file,"utf8");
const match=source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if(!match)throw new Error("Template do CRM não encontrado");
let template=JSON.parse(match[2]);
if(template.includes("CRM_AUDIO_RECORDING_V1")){console.log("crm-audio-recording-already-applied");process.exit(0);}

function replaceOnce(search,replacement,label){if(!template.includes(search))throw new Error(`Trecho não encontrado: ${label}`);template=template.replace(search,replacement);}

replaceOnce(
  "tagDraft:[], newTagName:'', tagSaving:false }; // CRM_REALTIME_V4 CRM_START_CONVERSATION_V1 CRM_REUSABLE_TAGS_V1",
  "tagDraft:[], newTagName:'', tagSaving:false, recordingAudio:false, recordingSeconds:0, audioSending:false }; // CRM_REALTIME_V4 CRM_START_CONVERSATION_V1 CRM_REUSABLE_TAGS_V1 CRM_AUDIO_RECORDING_V1",
  "estado da gravação"
);

const audioMethods=`  async startAudioRecording(){
    if(this.state.recordingAudio||this.state.audioSending)return;
    const id=this.state.activeConvId;if(!id){this.fireToast('Selecione uma conversa antes de gravar');return;}
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){this.fireToast('Este navegador não permite gravar áudio');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      const options=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported?.(type));
      const recorder=new MediaRecorder(stream,options?{mimeType:options}:undefined);
      this.audioChunks=[];this.audioRecorder=recorder;this.audioStream=stream;this.audioConversationId=id;this.audioShouldSend=false;
      recorder.ondataavailable=event=>{if(event.data?.size)this.audioChunks.push(event.data);};
      recorder.onstop=()=>this.completeAudioRecording();
      recorder.start(250);this.setState({recordingAudio:true,recordingSeconds:0});
      this.audioTimer=setInterval(()=>this.setState(s=>{const seconds=(s.recordingSeconds||0)+1;if(seconds>=300)setTimeout(()=>this.finishAudioRecording(true),0);return{recordingSeconds:Math.min(seconds,300)};}),1000);
    }catch(error){this.cleanupAudioRecorder();this.fireToast(error?.name==='NotAllowedError'?'Permita o uso do microfone para gravar':'Não foi possível acessar o microfone');}
  }
  finishAudioRecording(send){if(!this.audioRecorder||this.audioRecorder.state==='inactive')return;this.audioShouldSend=!!send;clearInterval(this.audioTimer);this.audioTimer=null;this.setState({recordingAudio:false,audioSending:!!send});this.audioRecorder.stop();}
  cleanupAudioRecorder(){clearInterval(this.audioTimer);this.audioTimer=null;(this.audioStream?.getTracks?.()||[]).forEach(track=>track.stop());this.audioStream=null;this.audioRecorder=null;}
  async completeAudioRecording(){
    const shouldSend=this.audioShouldSend,id=this.audioConversationId,chunks=this.audioChunks||[],mimeType=chunks[0]?.type||'audio/webm';this.cleanupAudioRecorder();this.audioChunks=[];this.audioShouldSend=false;
    if(!shouldSend){this.setState({audioSending:false,recordingSeconds:0});return;}
    try{
      const blob=new Blob(chunks,{type:mimeType});if(!blob.size)throw new Error('A gravação ficou vazia');if(blob.size>8*1024*1024)throw new Error('O áudio ultrapassou o limite de 8 MB');
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Falha ao preparar o áudio'));reader.readAsDataURL(blob);});
      const audioBase64=String(dataUrl).split(',',2)[1]||'';
      const current=this.convData.find(c=>c.id===id),willAssign=!current?.assignedUserId;
      const response=await fetch(\`/api/crm/conversations/\${id}/messages\`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message_type:'audio',audio_base64:audioBase64,mime_type:blob.type||mimeType})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha ao enviar áudio');
      if(willAssign)this.setState({inboxFilter:'mine',activeConvId:id});await this.loadConversations(true,willAssign?'mine':null);await this.loadMessages(id,true,true);await Promise.all([this.loadMetrics(true),this.loadAgents(true)]);this.fireToast('Áudio enviado');
    }catch(error){this.fireToast(error.message||'Falha ao enviar áudio');}finally{this.setState({audioSending:false,recordingSeconds:0});}
  }
`;
replaceOnce("  async resolveConversation(){",audioMethods+"  async resolveConversation(){","métodos de áudio");

replaceOnce(
  "text:m.text,time:m.time,showDate,dateLabel,showSender:me,sender:m.sender||(bot?'Assistente IA':'Enviado pelo CRM'),showTicks:me,isText:m.type==='text',isAudio:m.type==='audio',isImage:m.type==='image',wave:waves,dur:m.dur",
  "text:m.text,time:m.time,showDate,dateLabel,showSender:me,sender:m.sender||(bot?'Assistente IA':'Enviado pelo CRM'),showTicks:me,isText:m.type==='text',isAudio:m.type==='audio',isImage:m.type==='image',audioUrl:m.mediaUrl||'',hasAudioUrl:!!m.mediaUrl,noAudioUrl:!m.mediaUrl,wave:waves,dur:m.dur",
  "dados de reprodução"
);

const audioBlockStart=template.indexOf('              <sc-if value="{{ m.isAudio }}">');
const audioBlockEnd=template.indexOf('              </sc-if>',audioBlockStart);
if(audioBlockStart<0||audioBlockEnd<0)throw new Error("Bloco visual de áudio não encontrado");
const audioReplacement=`              <sc-if value="{{ m.isAudio }}">
                <sc-if value="{{ m.hasAudioUrl }}"><audio controls preload="metadata" src="{{ m.audioUrl }}" style="display:block;width:250px;max-width:100%;height:38px"></audio></sc-if>
                <sc-if value="{{ m.noAudioUrl }}"><div style="display:flex;align-items:center;gap:10px;min-width:210px;padding:2px 0"><span style="width:34px;height:34px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;flex:0 0 auto"><svg width="15" height="15" sc-camel-view-box="0 0 24 24" fill="#fff" stroke="none"><path d="M8 5v14l11-7z"></path></svg></span><span style="font-size:12px;color:var(--text2);font-weight:700">Áudio do WhatsApp</span></div></sc-if>
              </sc-if>`;
template=template.slice(0,audioBlockStart)+audioReplacement+template.slice(audioBlockEnd+'              </sc-if>'.length);

const composerStart=template.indexOf('        <div style="display:flex;align-items:flex-end;gap:8px">');
const composerCloser='\n        </div>\n      </div>\n    </section>';
const composerCloseAt=template.indexOf(composerCloser,composerStart);
if(composerStart<0||composerCloseAt<0)throw new Error("Compositor de mensagens não encontrado");
const composerEnd=composerCloseAt+'\n        </div>'.length;
const composer=`        <sc-if value="{{ !recordingAudio }}"><div style="display:flex;align-items:flex-end;gap:8px">
          <button style="{{ composerIcon }}" style-hover="background:var(--hover)" title="Emoji"><svg width="21" height="21" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg></button>
          <button style="{{ composerIcon }}" style-hover="background:var(--hover)" title="Anexar arquivo"><svg width="21" height="21" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></button>
          <input value="{{ draft }}" sc-camel-on-input="{{ onDraft }}" sc-camel-on-key-down="{{ onDraftKey }}" placeholder="Digite uma mensagem" style="flex:1;border:none;background:var(--panel);border-radius:22px;padding:12px 18px;outline:none;font-family:inherit;font-size:14px;color:var(--text)">
          <button sc-camel-on-click="{{ startAudioRecording }}" style="{{ audioRecordButton }}" title="Gravar áudio"><svg width="21" height="21" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"></path></svg></button>
          <button sc-camel-on-click="{{ sendMsg }}" style="width:46px;height:46px;border:none;border-radius:50%;background:#25d366;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(37,211,102,.4);flex:0 0 auto" style-hover="background:#1da851"><svg width="21" height="21" sc-camel-view-box="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"></path><path d="M22 2 15 22 11 13 2 9 22 2Z"></path></svg></button>
        </div></sc-if>
        <sc-if value="{{ recordingAudio }}"><div style="display:flex;align-items:center;gap:12px;background:var(--panel);border:1px solid rgba(239,68,68,.35);border-radius:24px;padding:6px 8px 6px 12px;min-height:48px">
          <button sc-camel-on-click="{{ cancelAudioRecording }}" style="width:36px;height:36px;border:0;border-radius:50%;background:rgba(239,68,68,.10);color:#ef4444;display:grid;place-items:center;cursor:pointer" title="Cancelar gravação"><svg width="18" height="18" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6"></path></svg></button>
          <span style="width:9px;height:9px;border-radius:50%;background:#ef4444;animation:pulse 1s infinite"></span><span style="font-variant-numeric:tabular-nums;font-size:14px;font-weight:800;color:#ef4444">{{ audioTime }}</span>
          <div style="flex:1;display:flex;align-items:center;gap:4px;height:28px;overflow:hidden"><sc-for list="{{ recordingWave }}" as="bar"><span style="width:3px;height:{{ bar }};border-radius:3px;background:#ef4444;opacity:.7;animation:pulse 1.1s infinite"></span></sc-for></div>
          <button sc-camel-on-click="{{ sendAudioRecording }}" style="width:40px;height:40px;border:0;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 3px 10px rgba(37,211,102,.35)" title="Enviar áudio"><svg width="20" height="20" sc-camel-view-box="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"></path></svg></button>
        </div></sc-if>
        <sc-if value="{{ audioSending }}"><div style="display:flex;align-items:center;justify-content:center;gap:9px;color:var(--text2);font-size:13px;font-weight:700;padding:12px"><span style="width:8px;height:8px;border-radius:50%;background:#25d366;animation:pulse 1s infinite"></span>Enviando áudio…</div></sc-if>`;
template=template.slice(0,composerStart)+composer+template.slice(composerEnd);

replaceOnce(
  "draft:S.draft,onDraft:e=>this.setState({draft:e.target.value}),onDraftKey:e=>{if(e.key==='Enter'){e.preventDefault();this.sendMsg();}},sendMsg:()=>this.sendMsg(),pickQuick:t=>()=>this.setState({draft:t}),",
  "draft:S.draft,onDraft:e=>this.setState({draft:e.target.value}),onDraftKey:e=>{if(e.key==='Enter'){e.preventDefault();this.sendMsg();}},sendMsg:()=>this.sendMsg(),pickQuick:t=>()=>this.setState({draft:t}),recordingAudio:S.recordingAudio,audioSending:S.audioSending,startAudioRecording:()=>this.startAudioRecording(),cancelAudioRecording:()=>this.finishAudioRecording(false),sendAudioRecording:()=>this.finishAudioRecording(true),audioTime:`${Math.floor((S.recordingSeconds||0)/60)}:${String((S.recordingSeconds||0)%60).padStart(2,'0')}`,recordingWave:['8px','16px','24px','12px','20px','10px','26px','15px','9px','21px','13px','25px','11px','18px','8px','22px','14px','27px'],audioRecordButton:`width:46px;height:46px;border:1px solid var(--line);border-radius:50%;background:var(--panel);color:${S.audioSending?'var(--text3)':'#ef4444'};cursor:${S.audioSending?'wait':'pointer'};display:flex;align-items:center;justify-content:center;flex:0 0 auto`,",
  "propriedades do gravador"
);

const serialized=JSON.stringify(template).replaceAll("</script>","<\\/script>");
fs.writeFileSync(file,source.replace(match[0],match[1]+serialized+match[3]));
console.log("crm-audio-recording-applied");
