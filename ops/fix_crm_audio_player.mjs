import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");
let template = JSON.parse(match[2]);
if (template.includes("CRM_AUDIO_PLAYER_V2")) {
  console.log("crm-audio-player-v2-already-applied");
  process.exit(0);
}

const methodAnchor = "  async startAudioRecording(){";
if (!template.includes(methodAnchor)) throw new Error("Método de gravação não encontrado");
template = template.replace(methodAnchor, `  playCrmAudio(url){ // CRM_AUDIO_PLAYER_V2
    if(!url){this.fireToast('Áudio indisponível');return;}
    try{
      if(this.crmPlayingAudio){this.crmPlayingAudio.pause();this.crmPlayingAudio.currentTime=0;}
      const audio=new Audio(url);this.crmPlayingAudio=audio;
      audio.onended=()=>{if(this.crmPlayingAudio===audio)this.crmPlayingAudio=null;};
      audio.onerror=()=>this.fireToast('Não foi possível carregar este áudio');
      const playback=audio.play();if(playback?.catch)playback.catch(()=>this.fireToast('Não foi possível reproduzir este áudio'));
    }catch(error){this.fireToast('Não foi possível reproduzir este áudio');}
  }
${methodAnchor}`);

const logicAnchor = "audioUrl:m.mediaUrl||'',hasAudioUrl:!!m.mediaUrl,noAudioUrl:!m.mediaUrl,wave:waves,dur:m.dur";
if (!template.includes(logicAnchor)) throw new Error("Dados do áudio não encontrados");
template = template.replace(
  logicAnchor,
  "audioUrl:m.mediaUrl||'',hasPlayableAudio:m.type==='audio'&&!!m.mediaUrl,missingAudio:m.type==='audio'&&!m.mediaUrl,onPlayAudio:()=>this.playCrmAudio(m.mediaUrl||''),wave:waves,dur:m.dur",
);

const oldBlock = `              <sc-if value="{{ m.isAudio }}">
                <sc-if value="{{ m.hasAudioUrl }}"><audio controls preload="metadata" src="{{ m.audioUrl }}" style="display:block;width:250px;max-width:100%;height:38px"></audio></sc-if>
                <sc-if value="{{ m.noAudioUrl }}"><div style="display:flex;align-items:center;gap:10px;min-width:210px;padding:2px 0"><span style="width:34px;height:34px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;flex:0 0 auto"><svg width="15" height="15" sc-camel-view-box="0 0 24 24" fill="#fff" stroke="none"><path d="M8 5v14l11-7z"></path></svg></span><span style="font-size:12px;color:var(--text2);font-weight:700">Áudio do WhatsApp</span></div></sc-if>
              </sc-if>`;
if (!template.includes(oldBlock)) throw new Error("Player antigo não encontrado");
const newBlock = `              <sc-if value="{{ m.hasPlayableAudio }}"><button sc-camel-on-click="{{ m.onPlayAudio }}" style="display:flex;align-items:center;gap:10px;min-width:220px;border:0;background:transparent;padding:2px 0;color:var(--text);font-family:inherit;cursor:pointer;text-align:left"><span style="width:36px;height:36px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 2px 7px rgba(37,211,102,.28)"><svg width="16" height="16" sc-camel-view-box="0 0 24 24" fill="#fff" stroke="none"><path d="M8 5v14l11-7z"></path></svg></span><span style="display:flex;flex-direction:column;gap:2px"><strong style="font-size:13px">Ouvir áudio</strong><span style="font-size:11px;color:var(--text2)">Mensagem de voz</span></span></button></sc-if>
              <sc-if value="{{ m.missingAudio }}"><div style="display:flex;align-items:center;gap:10px;min-width:210px;padding:2px 0"><span style="width:34px;height:34px;border-radius:50%;background:var(--line);display:flex;align-items:center;justify-content:center;flex:0 0 auto">!</span><span style="font-size:12px;color:var(--text2);font-weight:700">Áudio indisponível</span></div></sc-if>`;
template = template.replace(oldBlock, newBlock);

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
const output = source.slice(0, match.index) + match[1] + serialized + match[3] + source.slice(match.index + match[0].length);
fs.writeFileSync(file, output);
console.log("crm-audio-player-v2-applied");
