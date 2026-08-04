import fs from "node:fs";

const file = new URL("../app/public/crm-whatsapp.html", import.meta.url);
const source = fs.readFileSync(file, "utf8");
const templateMatch = source.match(/<script type="__bundler\/template">\s*("[\s\S]*?")\s*<\/script>/);
if (!templateMatch) throw new Error("Template do CRM não encontrado.");

let template = JSON.parse(templateMatch[1]);
if (template.includes("CRM_ADAPTIVE_REFRESH_V1")) {
  console.log("Runtime do CRM já otimizado.");
  process.exit(0);
}

function replaceExact(before, after, label) {
  if (!template.includes(before)) throw new Error(`Trecho não encontrado: ${label}`);
  template = template.replace(before, after);
}

replaceExact(
`    this._crmTimer=setInterval(()=>{
      const screen=this.state.screen;
      if(screen==='inbox'||screen==='filas')this.loadConversations(true);
      if(screen==='inbox'||screen==='filas'||screen==='supervisor')this.loadMetrics(true);
      if(screen==='funil'||screen==='supervisor')this.loadPipeline();
      if(screen==='integracoes'){this.loadIntegrationLogs(true);this.loadSyncStatus(true);}
    },3000);
    this._messageTimer=setInterval(()=>{const id=this.state.activeConvId;if(id&&this.state.screen==='inbox')this.loadMessages(id,true,false,true);},3000);
    this._queueClock=setInterval(()=>{if(this.state.screen==='filas')this.setState({clockTick:Date.now()});},15000);`,
`    this._refreshCrm=()=>{ // CRM_ADAPTIVE_REFRESH_V1
      if(document.hidden||this._crmRefreshActive)return;
      const screen=this.state.screen,tasks=[];
      if(screen==='inbox'||screen==='filas')tasks.push(this.loadConversations(true));
      if(screen==='inbox'||screen==='filas'||screen==='supervisor')tasks.push(this.loadMetrics(true));
      if(screen==='funil'||screen==='supervisor')tasks.push(this.loadPipeline());
      if(screen==='integracoes')tasks.push(this.loadIntegrationLogs(true),this.loadSyncStatus(true));
      if(tasks.length)this._crmRefreshActive=Promise.allSettled(tasks).finally(()=>{this._crmRefreshActive=null;});
    };
    this._crmTimer=setInterval(this._refreshCrm,10000);
    this._messageTimer=setInterval(()=>{
      if(document.hidden||this._messagePollActive)return;
      const id=this.state.activeConvId;
      if(id&&this.state.screen==='inbox')this._messagePollActive=this.loadMessages(id,true,false,true).finally(()=>{this._messagePollActive=null;});
    },3000);
    this._visibilityHandler=()=>{if(!document.hidden)this._refreshCrm();};
    document.addEventListener('visibilitychange',this._visibilityHandler);
    this._queueClock=setInterval(()=>{if(!document.hidden&&this.state.screen==='filas')this.setState({clockTick:Date.now()});},15000);`,
"polling principal",
);

replaceExact(
`  componentWillUnmount(){ if(this._crmTimer)clearInterval(this._crmTimer);if(this._messageTimer)clearInterval(this._messageTimer);if(this._queueClock)clearInterval(this._queueClock);if(this._searchTimer)clearTimeout(this._searchTimer); }`,
`  componentWillUnmount(){if(this._crmTimer)clearInterval(this._crmTimer);if(this._messageTimer)clearInterval(this._messageTimer);if(this._queueClock)clearInterval(this._queueClock);if(this._searchTimer)clearTimeout(this._searchTimer);if(this._visibilityHandler)document.removeEventListener('visibilitychange',this._visibilityHandler);this.cleanupAudioRecorder();if(this.crmPlayingAudio){try{this.crmPlayingAudio.pause();}catch(_){ }this.crmPlayingAudio=null;}}`,
"limpeza do componente",
);

replaceExact(
`      const view=forcedView||this.state.inboxFilter||'active',search=forcedSearch===null?(this.state.searchQuery||''):forcedSearch;
      const response=await fetch(\`/api/crm/conversations?view=\${encodeURIComponent(view)}&search=\${encodeURIComponent(search)}\`,{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error('Falha ao carregar conversas');
      const data=await this.readJsonResponse(response),previous=Number(this.state.activeConvId||0)||null,oldById=new Map(this.convData.map(c=>[Number(c.id),c])); // CRM_CONVERSATION_ID_NORMALIZED_V3`,
`      const view=forcedView||this.state.inboxFilter||'active',search=forcedSearch===null?(this.state.searchQuery||''):forcedSearch,requestToken=(this._conversationRequestToken||0)+1;
      this._conversationRequestToken=requestToken;
      const response=await fetch(\`/api/crm/conversations?view=\${encodeURIComponent(view)}&search=\${encodeURIComponent(search)}&compact=workspace\`,{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error('Falha ao carregar conversas');
      const data=await this.readJsonResponse(response);if(requestToken!==this._conversationRequestToken)return;
      const previous=Number(this.state.activeConvId||0)||null,oldById=new Map(this.convData.map(c=>[Number(c.id),c])); // CRM_CONVERSATION_ID_NORMALIZED_V3`,
"lista compacta e proteção contra resposta obsoleta",
);

replaceExact(
`      const response=await fetch('/api/crm/conversations?view=operational',{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error();
      const data=await this.readJsonResponse(response);this.pipelineData=(data.items||[]).map((item,index)=>({id:item.id,name:item.name,initials:String(item.name||'').split(/\\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase(),company:item.channel_name||item.instance_name,ci:Math.abs(Number(item.contact_id||index))%this.avatarColors.length,stage:item.pipeline_stage||'Novo',owner:item.assigned_to||'Aguardando atendimento',tags:String(item.tag_names||'').split('||').filter(Boolean)}));
      this.setState(s=>({pipelineRevision:s.pipelineRevision+1}));`,
`      const requestToken=(this._pipelineRequestToken||0)+1;this._pipelineRequestToken=requestToken;
      const response=await fetch('/api/crm/conversations?view=operational&compact=pipeline',{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error();
      const data=await this.readJsonResponse(response);if(requestToken!==this._pipelineRequestToken)return;
      const next=(data.items||[]).map((item,index)=>({id:item.id,name:item.name,initials:String(item.name||'').split(/\\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase(),company:item.channel_name||item.instance_name,ci:Math.abs(Number(item.contact_id||index))%this.avatarColors.length,stage:item.pipeline_stage||'Novo',owner:item.assigned_to||'Aguardando atendimento',tags:String(item.tag_names||'').split('||').filter(Boolean)}));
      const signature=JSON.stringify(next.map(item=>[item.id,item.name,item.stage,item.owner,item.tags.join('|')]));
      if(signature===this._pipelineSignature)return;this._pipelineSignature=signature;this.pipelineData=next;
      this.setState(s=>({pipelineRevision:s.pipelineRevision+1}));`,
"funil compacto e estável",
);

replaceExact(
`    const qrCells=[]; for(let i=0;i<441;i++){ const r=Math.floor(i/21),c=i%21; let on=((r*c+r*7+c*13+ (r^c))%3===0)||((i*i)%7===0); const fin=(rr,cc)=>rr<7&&cc<7; if(fin(r,c)||fin(r,20-c)||fin(20-r,c)){ const lr=r%7,lc=(c<7?c:(20-c))%7,br=20-r; const ur=(r>13?br:r); on=(ur===0||ur===6||lc===0||lc===6)|| (ur>=2&&ur<=4&&lc>=2&&lc<=4); } qrCells.push(on?'#0b141a':'#fff'); }`,
`    const qrCells=this._qrCells||(this._qrCells=(()=>{const cells=[];for(let i=0;i<441;i++){const r=Math.floor(i/21),c=i%21;let on=((r*c+r*7+c*13+(r^c))%3===0)||((i*i)%7===0);const fin=(rr,cc)=>rr<7&&cc<7;if(fin(r,c)||fin(r,20-c)||fin(20-r,c)){const lr=r%7,lc=(c<7?c:(20-c))%7,br=20-r,ur=(r>13?br:r);on=(ur===0||ur===6||lc===0||lc===6)||(ur>=2&&ur<=4&&lc>=2&&lc<=4);}cells.push(on?'#0b141a':'#fff');}return cells;})());`,
"cache do QR",
);

const serialized = JSON.stringify(template).replace(/<\/script/gi, "<\\/script");
fs.writeFileSync(file, source.replace(templateMatch[1], serialized), "utf8");
console.log("Runtime do CRM otimizado com atualização adaptativa.");
