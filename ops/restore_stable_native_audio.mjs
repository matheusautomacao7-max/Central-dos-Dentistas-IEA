import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");
let template = JSON.parse(match[2]);
if (template.includes("CRM_NATIVE_AUDIO_STABLE_V10")) process.exit(0);

const oldBlock = `              <sc-if value="{{ m.hasPlayableAudio }}"><button sc-camel-on-click="{{ m.onPlayAudio }}" style="display:flex;align-items:center;gap:10px;min-width:220px;border:0;background:transparent;padding:2px 0;color:var(--text);font-family:inherit;cursor:pointer;text-align:left"><span style="width:36px;height:36px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;flex:0 0 auto"><svg width="16" height="16" sc-camel-view-box="0 0 24 24" fill="#fff" stroke="none"><path d="M8 5v14l11-7z"></path></svg></span><span><strong style="display:block;font-size:13px">Ouvir áudio</strong><small style="color:var(--text2)">Mensagem de voz</small></span></button></sc-if>
              <sc-if value="{{ m.missingAudio }}"><div style="font-size:12px;color:var(--text2);font-weight:700">Áudio indisponível</div></sc-if>`;
const newBlock = `              <sc-if value="{{ m.hasPlayableAudio }}"><audio controls preload="metadata" src="{{ m.audioUrl }}" style="display:block;width:270px;max-width:100%;height:40px">Seu navegador não conseguiu reproduzir este áudio.</audio></sc-if>
              <sc-if value="{{ m.missingAudio }}"><div style="font-size:12px;color:var(--text2);font-weight:700">Áudio indisponível</div></sc-if>
              <!-- CRM_NATIVE_AUDIO_STABLE_V10 -->`;
if (!template.includes(oldBlock)) throw new Error("Botão personalizado de áudio não encontrado");
template = template.replace(oldBlock, newBlock);

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.slice(0, match.index) + match[1] + serialized + match[3] + source.slice(match.index + match[0].length));
console.log("crm-native-audio-stable-v10-applied");
