import fs from "node:fs";

const file=new URL("../app/public/crm-whatsapp.html",import.meta.url);
const source=fs.readFileSync(file,"utf8");
const match=source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if(!match)throw new Error("Template do CRM não encontrado");
let template=JSON.parse(match[2]);
if(template.includes("CRM_AUDIO_DURATION_SECTOR_V1")){
  console.log("crm-audio-duration-sector-already-applied");
  process.exit(0);
}

function replaceOnce(before,after,label){
  if(!template.includes(before))throw new Error(`Âncora ausente: ${label}`);
  template=template.replace(before,after);
}

replaceOnce(
  "stage:item.pipeline_stage||'Novo',status:item.status||'Aberta',owner:item.assigned_to||'Aguardando atendimento'",
  "stage:item.pipeline_stage||'Novo',status:item.status||'Aberta',owner:item.assigned_label||item.assigned_to||'Aguardando atendimento'",
  "identificação do atendente",
);

replaceOnce(
  "mediaUrl:m.media_url||'',dur:''",
  "mediaUrl:m.media_url||'',durationSeconds:Number(m.duration_seconds||0),dur:this.formatAudioDuration(m.duration_seconds)",
  "duração recebida",
);

replaceOnce(
  "  playCrmAudio(url){ // CRM_AUDIO_PLAYER_V2",
  `  formatAudioDuration(value){ // CRM_AUDIO_DURATION_SECTOR_V1
    const total=Math.max(0,Math.round(Number(value)||0)),minutes=Math.floor(total/60),seconds=total%60;
    return total?\`${'${minutes}'}:${'${String(seconds).padStart(2,\'0\')}'}\`:'0:00';
  }
  playCrmAudio(url){ // CRM_AUDIO_PLAYER_V2`,
  "formatador de duração",
);

replaceOnce(
  '<span style="font-size:11px;color:var(--text2)">Mensagem de voz</span>',
  '<span style="font-size:11px;color:var(--text2)">{{ m.dur }} · Mensagem de voz</span>',
  "duração visível",
);

const serialized=JSON.stringify(template).replaceAll("</script>","<\\/script>");
const output=source.slice(0,match.index)+match[1]+serialized+match[3]+source.slice(match.index+match[0].length);
fs.writeFileSync(file,output);
console.log("crm-audio-duration-sector-applied");
