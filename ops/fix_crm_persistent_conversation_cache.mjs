import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const match = source.match(/(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/);
if (!match) throw new Error("Template do CRM não encontrado");
let template = JSON.parse(match[2]);
if (template.includes("CRM_PERSISTENT_CONVERSATION_CACHE_V11")) process.exit(0);

const mountAnchor = `  componentDidMount(){
    this.applyTheme();`;
const mountReplacement = `  componentDidMount(){
    this.crmMessageCache=new Map();this.crmTimelineCache=new Map();this.crmTimelineSignatures=new Map(); // CRM_PERSISTENT_CONVERSATION_CACHE_V11
    this.applyTheme();`;
if (!template.includes(mountAnchor)) throw new Error("Inicialização do CRM não encontrada");
template = template.replace(mountAnchor, mountReplacement);

const conversationStateOld = "tags:String(item.tag_names||'').split('||').filter(Boolean),msgs:old?.msgs||[],messageSignature:old?.messageSignature||'',ci:";
const conversationStateNew = "tags:String(item.tag_names||'').split('||').filter(Boolean),msgs:this.crmMessageCache.get(Number(item.id))||old?.msgs||[],messageSignature:old?.messageSignature||'',ci:";
if (!template.includes(conversationStateOld)) throw new Error("Estado das mensagens na conversa não encontrado");
template = template.replace(conversationStateOld, conversationStateNew);

const timelineStateOld = "note:item.internal_note||'',history:old?.history||[],/* CRM_TIMELINE_STATE_STABLE_V7 */";
const timelineStateNew = "note:item.internal_note||'',history:this.crmTimelineCache.get(Number(item.id))||old?.history||[],/* CRM_TIMELINE_STATE_STABLE_V7 */";
if (!template.includes(timelineStateOld)) throw new Error("Estado da linha do tempo não encontrado");
template = template.replace(timelineStateOld, timelineStateNew);

const timelineAssignmentOld = "target.history=(data.events||[]).filter(event=>labels[event.event_type]).map(event=>{const entry=labels[event.event_type],parsed=this.parseDate(event.created_at);return{eventId:event.id,eventType:event.event_type,title:entry[0]+(event.actor_name||'Sistema'),rawDate:event.created_at||'',date:parsed?parsed.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):String(event.created_at||''),color:entry[1]};});this.setState(s=>({timelineRevision:(s.timelineRevision||0)+1}));";
const timelineAssignmentNew = "const received=(data.events||[]).filter(event=>labels[event.event_type]).map(event=>{const entry=labels[event.event_type],parsed=this.parseDate(event.created_at);return{eventId:event.id,eventType:event.event_type,title:entry[0]+(event.actor_name||'Sistema'),rawDate:event.created_at||'',date:parsed?parsed.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):String(event.created_at||''),color:entry[1]};}),cached=this.crmTimelineCache.get(Number(id))||[],history=[...new Map([...cached,...received].map(item=>[String(item.eventId),item])).values()].sort((a,b)=>(this.parseDate(b.rawDate)?.getTime()||0)-(this.parseDate(a.rawDate)?.getTime()||0)),historySignature=history.map(item=>item.eventId+':'+item.title).join('|');this.crmTimelineCache.set(Number(id),history);target.history=history;if(this.crmTimelineSignatures.get(Number(id))!==historySignature){this.crmTimelineSignatures.set(Number(id),historySignature);this.setState(s=>({timelineRevision:(s.timelineRevision||0)+1}));}";
if (!template.includes(timelineAssignmentOld)) throw new Error("Atualização do histórico não encontrada");
template = template.replace(timelineAssignmentOld, timelineAssignmentNew);

const snapshotOld = "const snapshotMessages=initialTarget.msgs||[],afterId=incremental&&snapshotMessages.length?";
const snapshotNew = "const snapshotMessages=this.crmMessageCache.get(Number(id))||initialTarget.msgs||[],afterId=incremental&&snapshotMessages.length?";
if (!template.includes(snapshotOld)) throw new Error("Snapshot das mensagens não encontrado");
template = template.replace(snapshotOld, snapshotNew);

const targetOld = "const target=this.convData.find(c=>c.id===id);if(!target)return;const current=target.msgs||[]; // CRM_REFRESH_RACE_FIXED_V9";
const targetNew = "const target=this.convData.find(c=>c.id===id);if(!target)return;const current=this.crmMessageCache.get(Number(id))||target.msgs||[]; // CRM_REFRESH_RACE_FIXED_V9";
if (!template.includes(targetOld)) throw new Error("Destino das mensagens não encontrado");
template = template.replace(targetOld, targetNew);

const combinedOld = "const combined=incremental?[...new Map([...current,...mapped].map(m=>[m.id,m])).values()].sort((a,b)=>Number(a.id)-Number(b.id)):mapped;\n      const signature=combined.map(m=>`${m.id}:${m.authorType}`).join('|');if(signature===target.messageSignature){if(this.state.activeConvId!==id)this.setState({activeConvId:id});return;}\n      target.messageSignature=signature;target.msgs=combined;this.setState({activeConvId:id});";
const combinedNew = "const combined=[...new Map([...current,...mapped].map(m=>[String(m.id),m])).values()].sort((a,b)=>Number(a.id)-Number(b.id));\n      const signature=combined.map(m=>`${m.id}:${m.authorType}:${m.type}:${m.mediaUrl}`).join('|');this.crmMessageCache.set(Number(id),combined);target.msgs=combined;if(signature===target.messageSignature){if(this.state.activeConvId!==id)this.setState({activeConvId:id});return;}\n      target.messageSignature=signature;this.setState({activeConvId:id});";
if (!template.includes(combinedOld)) throw new Error("Mesclagem das mensagens não encontrada");
template = template.replace(combinedOld, combinedNew);

const serialized = JSON.stringify(template).replaceAll("</script>", "<\\/script>");
fs.writeFileSync(file, source.slice(0, match.index) + match[1] + serialized + match[3] + source.slice(match.index + match[0].length));
console.log("crm-persistent-conversation-cache-v11-applied");
