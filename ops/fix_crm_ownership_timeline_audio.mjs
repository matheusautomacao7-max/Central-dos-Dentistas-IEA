import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");
let template = JSON.parse(match[2]);
if (template.includes("CRM_OWNERSHIP_TIMELINE_AUDIO_V8")) process.exit(0);

const timelineOld = "return{title:entry[0]+(event.actor_name||'Sistema'),date:parsed?parsed.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):String(event.created_at||''),color:entry[1]};";
const timelineNew = "return{eventId:event.id,eventType:event.event_type,title:entry[0]+(event.actor_name||'Sistema'),rawDate:event.created_at||'',date:parsed?parsed.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):String(event.created_at||''),color:entry[1]};";
if (!template.includes(timelineOld)) throw new Error("Mapeamento da linha do tempo não encontrado");
template = template.replace(timelineOld, timelineNew);

const messagesOld = "const allMsgs=[...ac.msgs,...(S.sent[ac.id]||[])]; let previousDate='';";
const messagesNew = `const attendanceNotices=(ac.history||[]).map(h=>({id:'event-'+h.eventId,from:'system',type:'system',text:h.title,time:h.date,rawDate:h.rawDate,dateKey:this.dateKey(h.rawDate),mediaUrl:''}));
    const allMsgs=[...ac.msgs,...(S.sent[ac.id]||[]),...attendanceNotices].sort((a,b)=>{const da=this.parseDate(a.rawDate)?.getTime()||0,db=this.parseDate(b.rawDate)?.getTime()||0;return da-db||String(a.id).localeCompare(String(b.id));}); let previousDate=''; // CRM_OWNERSHIP_TIMELINE_AUDIO_V8`;
if (!template.includes(messagesOld)) throw new Error("Lista de mensagens não encontrada");
template = template.replace(messagesOld, messagesNew);

const mapOld = "const messages=allMsgs.map(m=>{ const me=m.from!=='them',bot=m.from==='bot',bg=bot?'var(--bubbleBot)':(me?'var(--bubbleOut)':'var(--bubbleIn)'),showDate=m.dateKey!==previousDate,dateLabel=this.dayLabel(m.rawDate);previousDate=m.dateKey; return {\n      rowStyle:`display:flex;justify-content:${me?'flex-end':'flex-start'}`,bubbleStyle:`max-width:66%;padding:8px 11px 6px;border-radius:9px;background:${bg};box-shadow:0 1px 1px rgba(0,0,0,.06);${!me?'border-top-left-radius:2px':'border-top-right-radius:2px'}`,\n      text:m.text,time:m.time,showDate,dateLabel,showSender:me,sender:m.sender||(bot?'Assistente IA':'Enviado pelo CRM'),showTicks:me,isText:m.type==='text',isAudio:m.type==='audio',isImage:m.type==='image',audioUrl:m.mediaUrl||'',hasAudioUrl:!!m.mediaUrl,noAudioUrl:!m.mediaUrl,wave:waves,dur:m.dur }; });";
const mapNew = "const messages=allMsgs.map(m=>{ const system=m.from==='system',me=!system&&m.from!=='them',bot=m.from==='bot',bg=system?'rgba(37,99,235,.10)':bot?'var(--bubbleBot)':(me?'var(--bubbleOut)':'var(--bubbleIn)'),showDate=m.dateKey!==previousDate,dateLabel=this.dayLabel(m.rawDate);previousDate=m.dateKey; return {\n      rowStyle:`display:flex;justify-content:${system?'center':me?'flex-end':'flex-start'}`,bubbleStyle:`max-width:${system?'82%':'66%'};padding:${system?'7px 13px':'8px 11px 6px'};border-radius:${system?'16px':'9px'};background:${bg};box-shadow:${system?'none':'0 1px 1px rgba(0,0,0,.06)'};${system?'color:#2563eb;font-size:12px;font-weight:800;text-align:center':!me?'border-top-left-radius:2px':'border-top-right-radius:2px'}`,\n      text:m.text,time:m.time,showDate,dateLabel,showSender:me&&!system,sender:m.sender||(bot?'Assistente IA':'Enviado pelo CRM'),showTicks:me&&!system,isSystem:system,isText:m.type==='text',isAudio:m.type==='audio',isImage:m.type==='image',audioUrl:m.mediaUrl||'',hasPlayableAudio:m.type==='audio'&&!!m.mediaUrl,missingAudio:m.type==='audio'&&!m.mediaUrl,onPlayAudio:()=>this.playCrmAudio(m.mediaUrl||''),wave:waves,dur:m.dur }; });";
if (!template.includes(mapOld)) throw new Error("Renderização das mensagens não encontrada");
template = template.replace(mapOld, mapNew);

const methodAnchor = "  async startAudioRecording(){";
if (!template.includes(methodAnchor)) throw new Error("Método de áudio não encontrado");
template = template.replace(methodAnchor, `  playCrmAudio(url){
    if(!url){this.fireToast('Áudio indisponível');return;}
    try{if(this.crmPlayingAudio){this.crmPlayingAudio.pause();this.crmPlayingAudio.currentTime=0;}const audio=new Audio(url);this.crmPlayingAudio=audio;audio.onended=()=>{if(this.crmPlayingAudio===audio)this.crmPlayingAudio=null;};audio.onerror=()=>this.fireToast('Não foi possível carregar este áudio');const playback=audio.play();if(playback?.catch)playback.catch(()=>this.fireToast('Não foi possível reproduzir este áudio'));}catch(error){this.fireToast('Não foi possível reproduzir este áudio');}
  }
${methodAnchor}`);

const audioOld = `              <sc-if value="{{ m.isAudio }}">
                <sc-if value="{{ m.hasAudioUrl }}"><audio controls preload="metadata" src="{{ m.audioUrl }}" style="display:block;width:250px;max-width:100%;height:38px"></audio></sc-if>
                <sc-if value="{{ m.noAudioUrl }}"><div style="display:flex;align-items:center;gap:10px;min-width:210px;padding:2px 0"><span style="width:34px;height:34px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;flex:0 0 auto"><svg width="15" height="15" sc-camel-view-box="0 0 24 24" fill="#fff" stroke="none"><path d="M8 5v14l11-7z"></path></svg></span><span style="font-size:12px;color:var(--text2);font-weight:700">Áudio do WhatsApp</span></div></sc-if>
              </sc-if>`;
const audioNew = `              <sc-if value="{{ m.isSystem }}"><span>{{ m.text }}</span></sc-if>
              <sc-if value="{{ m.hasPlayableAudio }}"><button sc-camel-on-click="{{ m.onPlayAudio }}" style="display:flex;align-items:center;gap:10px;min-width:220px;border:0;background:transparent;padding:2px 0;color:var(--text);font-family:inherit;cursor:pointer;text-align:left"><span style="width:36px;height:36px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;flex:0 0 auto"><svg width="16" height="16" sc-camel-view-box="0 0 24 24" fill="#fff" stroke="none"><path d="M8 5v14l11-7z"></path></svg></span><span><strong style="display:block;font-size:13px">Ouvir áudio</strong><small style="color:var(--text2)">Mensagem de voz</small></span></button></sc-if>
              <sc-if value="{{ m.missingAudio }}"><div style="font-size:12px;color:var(--text2);font-weight:700">Áudio indisponível</div></sc-if>`;
if (!template.includes(audioOld)) throw new Error("Player de áudio antigo não encontrado");
template = template.replace(audioOld, audioNew);

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.slice(0, match.index) + match[1] + serialized + match[3] + source.slice(match.index + match[0].length));
console.log("crm-ownership-timeline-audio-v8-applied");
