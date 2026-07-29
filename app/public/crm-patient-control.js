if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embed');
const $=id=>document.getElementById(id);
const state={page:1,pages:1,rows:[],filtersLoaded:false,loading:false};
const filterIds=['search','period','agent','category','outcome','scheduled','channel','professional','actor','origin','start','end'];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brDate=value=>{
  if(!value)return '—';
  const d=new Date(String(value).replace(' ','T'));
  return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Cuiaba'}).format(d);
};
const query=(page=state.page,perPage=50)=>{
  const p=new URLSearchParams({page,per_page:perPage});
  filterIds.forEach(id=>{const v=$(id)?.value?.trim();if(v)p.set(id==='agent'?'agent_id':id==='channel'?'channel_id':id,v)});
  return p;
};
function setOptions(id,rows,valueKey='value',labelKey='value'){
  const select=$(id),first=select.options[0].outerHTML;
  select.innerHTML=first+rows.map(r=>`<option value="${escapeHtml(r[valueKey])}">${escapeHtml(r[labelKey])}</option>`).join('');
}
async function api(url){
  const r=await fetch(url,{headers:{Accept:'application/json'}});
  if(r.status===401){location.href='/login';throw new Error('Sessão expirada.');}
  if(r.status===403)throw new Error('Seu acesso não possui permissão para visualizar o Controle de pacientes.');
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`Falha de comunicação (${r.status}).`);
  return data;
}
async function load(){
  if(state.loading)return; state.loading=true;$('error').style.display='none';$('resultText').textContent='Atualizando registros…';
  try{
    const data=await api('/api/crm/patient-control?'+query());
    state.page=data.pagination.page;state.pages=data.pagination.pages;state.rows=data.rows||[];
    $('kTotal').textContent=data.summary.total;$('kScheduled').textContent=data.summary.scheduled;$('kAi').textContent=data.summary.ai_involved;$('kHuman').textContent=data.summary.human_finalized;
    $('resultText').textContent=`${data.pagination.total} atendimento(s) encontrado(s) · página ${state.page} de ${state.pages}`;
    $('prevBtn').disabled=state.page<=1;$('nextBtn').disabled=state.page>=state.pages;
    if(!state.filtersLoaded){
      setOptions('agent',data.filters.agents||[],'id','name');setOptions('channel',data.filters.channels||[],'id','display_name');
      ['categories','outcomes','origins','professionals'].forEach(k=>setOptions(k==='categories'?'category':k==='outcomes'?'outcome':k==='origins'?'origin':'professional',(data.filters[k]||[]).map(value=>({value}))));
      state.filtersLoaded=true;
    }
    renderRows();
  }catch(e){$('error').textContent=e.message;$('error').style.display='block';$('resultText').textContent='Não foi possível carregar os registros.';}
  finally{state.loading=false}
}
function renderRows(){
  $('rows').innerHTML=state.rows.length?state.rows.map((r,i)=>`<tr data-index="${i}">
    <td class="person"><b>${escapeHtml(r.contact_name||'Paciente sem nome')}</b><small>${escapeHtml(r.phone||'Sem telefone')}</small></td>
    <td>${escapeHtml(brDate(r.resolved_at))}</td><td>${escapeHtml(r.resolved_by_name||'—')}</td>
    <td><span class="pill">${escapeHtml(r.category||'—')}</span></td><td>${escapeHtml(r.outcome||'—')}</td>
    <td>${r.scheduled_date?`<span class="pill ok">${escapeHtml(r.scheduled_date)}${r.scheduled_time?' · '+escapeHtml(r.scheduled_time):''}</span>`:'—'}</td>
    <td>${escapeHtml(r.channel_name||'—')}</td><td>${escapeHtml(r.responsible_professional||'—')}</td></tr>`).join(''):`<tr><td colspan="8" class="empty">Nenhum atendimento finalizado corresponde aos filtros.</td></tr>`;
  document.querySelectorAll('tbody tr[data-index]').forEach(tr=>tr.onclick=()=>openDetail(state.rows[Number(tr.dataset.index)]));
}
function openDetail(r){
  $('detailTitle').textContent=r.contact_name||'Paciente sem nome';
  const fields=[['Telefone',r.phone],['Finalizado em',brDate(r.resolved_at)],['Atendente',r.resolved_by_name],['Canal',r.channel_name],['Categoria',r.category],['Resultado',r.outcome],['Interesse',r.interest],['Origem',r.origin],['Profissional',r.responsible_professional],['Agendamento',[r.scheduled_date,r.scheduled_time].filter(Boolean).join(' · ')],['Campanha',r.campaign_name],['Workflow',r.workflow_name],['Ator final',r.final_actor],['Participação da IA',r.ai_involved?'Sim':'Não'],['Observações',r.notes,'notes']];
  $('detailGrid').innerHTML=fields.map(([label,value,cls])=>`<div class="detail ${cls||''}"><small>${escapeHtml(label)}</small><b>${escapeHtml(value||'Não informado')}</b></div>`).join('');
  $('detailModal').showModal();
}
let timer;
filterIds.forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{clearTimeout(timer);state.page=1;if(id==='period')$('dates').classList.toggle('show',$('period').value==='custom');timer=setTimeout(load,id==='search'?350:40)}));
$('clearBtn').onclick=()=>{filterIds.forEach(id=>{if($(id).tagName==='SELECT')$(id).selectedIndex=0;else $(id).value=''});$('period').value='30d';$('dates').classList.remove('show');state.page=1;load()};
$('prevBtn').onclick=()=>{state.page--;load()};$('nextBtn').onclick=()=>{state.page++;load()};
$('closeModal').onclick=()=>$('detailModal').close();
$('exportBtn').onclick=async()=>{
  const btn=$('exportBtn');btn.disabled=true;btn.textContent='Preparando exportação…';
  try{
    let all=[],page=1,pages=1;
    do{const data=await api('/api/crm/patient-control?'+query(page,500));all=all.concat(data.rows||[]);pages=data.pagination.pages;page++;}while(page<=pages);
    const cols=[['Paciente','contact_name'],['Telefone','phone'],['Finalizado em','resolved_at'],['Atendente','resolved_by_name'],['Categoria','category'],['Resultado','outcome'],['Interesse','interest'],['Origem','origin'],['Canal','channel_name'],['Profissional','responsible_professional'],['Data agendamento','scheduled_date'],['Hora agendamento','scheduled_time'],['Campanha','campaign_name'],['Workflow','workflow_name'],['Participação IA','ai_involved'],['Ator final','final_actor'],['Observações','notes']];
    const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    const csv='\ufeff'+[cols.map(c=>q(c[0])).join(';'),...all.map(r=>cols.map(c=>q(r[c[1]])).join(';'))].join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`controle-pacientes-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);
  }catch(e){$('error').textContent=e.message;$('error').style.display='block'}finally{btn.disabled=false;btn.textContent='↓ Exportar resultados'}
};
api('/api/auth/status').then(x=>{$('userName').textContent=x.user?.name||x.name||'Usuário'}).catch(()=>{});
load();
