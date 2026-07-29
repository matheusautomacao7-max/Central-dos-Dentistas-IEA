const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? "").replace(/[&<'"]/g, char => ({"&":"&amp;","<":"&lt;","'":"&#39;",'"':"&quot;"}[char]));
const formatDate = value => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "Sem agendamento";
const initials = name => String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(item => item[0]).join("").toUpperCase();
const state = { search:"", status:"", next_schedule:"", attention:"", month:"", professional:"", crc_stage:"", patient:null };

async function api(path, options = {}) {
  const response = await fetch(path, { headers:{"Content-Type":"application/json"}, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}
function toast(message, error=false) { const item=$("#toast"); item.textContent=message; item.style.background=error?"#b4514c":"#46745d"; item.classList.add("show"); setTimeout(()=>item.classList.remove("show"),3200); }
function procedureRow(item={}) { return `<div class="crc-procedure-row"><input class="crc-procedure-name" value="${escapeHtml(item.name || "")}" placeholder="Procedimento"><input class="crc-procedure-value" type="number" min="0" step="0.01" value="${((item.value_cents || 0) / 100).toFixed(2)}" placeholder="Valor"><input class="crc-procedure-discount" type="number" min="0" step="0.01" value="${((item.discount_cents || 0) / 100).toFixed(2)}" placeholder="Desconto"><select class="crc-procedure-stage"><option ${item.stage === "Indicado" ? "selected" : ""}>Indicado</option><option ${item.stage === "Aprovado" ? "selected" : ""}>Aprovado</option><option ${item.stage === "Agendado" ? "selected" : ""}>Agendado</option><option ${item.stage === "Em andamento" ? "selected" : ""}>Em andamento</option><option ${item.stage === "Concluído" ? "selected" : ""}>Concluído</option></select><button type="button" class="crc-remove-procedure" aria-label="Remover">×</button></div>`; }
function bindProcedureRows() { $$(".crc-remove-procedure").forEach(button => button.onclick = () => button.closest(".crc-procedure-row").remove()); }
function collectProcedures() { return $$(".crc-procedure-row").map(row => ({name: row.querySelector(".crc-procedure-name").value.trim(), value_cents: Math.round(Number(row.querySelector(".crc-procedure-value").value || 0) * 100), discount_cents: Math.round(Number(row.querySelector(".crc-procedure-discount").value || 0) * 100), stage: row.querySelector(".crc-procedure-stage").value})).filter(item => item.name); }
function stageLabel(stage) { const current=stage || "Aguardando contato"; const cls=current === "Jornada compartilhada" ? "crc-stage-journey" : current === "Em atendimento" ? "crc-stage-progress" : "crc-stage-waiting"; return `<span class="crc-stage ${cls}">${escapeHtml(current)}</span>`; }
function appointmentCell(item) {
  if (!item.next_appointment) return '<span class="crc-appointment-empty">Sem agendamento</span>';
  const programmed=item.next_appointment_type==="Programado";
  return `<div class="crc-appointment"><span class="crc-appointment-badge ${programmed?"crc-appointment-programmed":"crc-appointment-scheduled"}">${programmed?"Programado":"Agendado"}</span><small>${formatDate(item.next_appointment)}</small></div>`;
}
function journeySummary(item) { if (!Number(item.journey_professional_count)) return '<span class="crc-no-journey">Sem jornada ativa</span>'; const names=String(item.journey_summary || "").split("||").filter(Boolean).map(value => value.split("|")[0]); return `<div class="crc-journey-summary"><strong>${item.journey_professional_count} ${Number(item.journey_professional_count) === 1 ? "profissional" : "profissionais"}</strong><small>${escapeHtml(names.join(", "))}</small></div>`; }
async function loadDashboard() { const data=await api("/api/dashboard"); $("#crcNeedContact").textContent=data.need_contact||0; $("#crcUnscheduled").textContent=data.without_schedule||0; $("#crcTreatment").textContent=data.open_treatments||0; $("#crcResolved").textContent=data.resolved_today||0; }
async function loadFilters() {
  const data=await api("/api/filters");
  $("#crcMonth").innerHTML=`<option value="">Todos os meses</option>${(data.months||[]).map(month=>`<option value="${month}">${month.slice(5,7)}/${month.slice(0,4)}</option>`).join("")}`;
  $("#crcProfessionalOptions").innerHTML=(data.professionals||[]).map(item=>{ const avatar=item.has_photo?`<img src="/api/professionals/${item.id}/photo" alt="">`:`<span>${escapeHtml(initials(item.name))}</span>`; return `<label class="crc-professional-choice"><input type="checkbox" value="${item.id}"><span class="crc-professional-avatar">${avatar}</span><span>${escapeHtml(item.name)}</span></label>`; }).join("");
  $$(".crc-professional-choice input").forEach(input=>input.onchange=()=>{ const selected=$$(".crc-professional-choice input:checked"); state.professional=selected.map(item=>item.value).join(","); $("#crcProfessionalLabel").textContent=!selected.length?"Todos os dentistas":selected.length===1?selected[0].closest("label").lastElementChild.textContent:`${selected.length} dentistas selecionados`; refresh(); });
  $("#crcProfessionalToggle").onclick=event=>{ event.stopPropagation(); $("#crcProfessionalOptions").toggleAttribute("hidden"); };
}
async function loadPatients() {
  const data=await api("/api/patients?"+new URLSearchParams({...state,per_page:"50"}));
  $("#crcTotal").textContent=`${data.total} pacientes encontrados`;
  $("#crcPatients").innerHTML=data.items.length ? data.items.map(item=>`<tr><td><div class="patient-cell crc-patient-cell"><span class="patient-avatar">${escapeHtml(initials(item.name))}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.professional||"Sem responsável")}</small></div></div></td><td>${escapeHtml(item.professional||"—")}</td><td>${formatDate(item.last_visit)}</td><td>${appointmentCell(item)}</td><td>${stageLabel(item.crc_status)}</td><td>${journeySummary(item)}</td><td><button class="crc-view" data-view-id="${item.id}" type="button">Abrir prontuário</button></td></tr>`).join("") : `<tr class="loading-row"><td colspan="7">Nenhum paciente encontrado.</td></tr>`;
  $$("[data-view-id]").forEach(button=>button.onclick=()=>openPatient(button.dataset.viewId));
}
function renderJourney(patient) {
  const journey=patient.journey||[];
  const shared=journey.some(item=>!item.is_primary);
  $("#crcJourney").hidden=!shared;
  $("#crcJourney").querySelector(":scope > strong").textContent="Prontuários da jornada compartilhada";
  $("#crcJourneyList").innerHTML=journey.map(item=>{
    const notes=(patient.observations||[]).filter(note=>String(note.author_name||"").trim().toLocaleLowerCase("pt-BR")===String(item.name||"").trim().toLocaleLowerCase("pt-BR"));
    return `<article class="crc-journey-record"><header><strong>${escapeHtml(item.name)}</strong><span>${item.is_primary?"Prontuário de origem":escapeHtml(item.stage_status||"Aguardando início")} · ${item.days_shared??0} dias</span></header>${item.forwarded_by?`<small>Encaminhado por ${escapeHtml(item.forwarded_by)}${item.forward_reason?` · ${escapeHtml(item.forward_reason)}`:""}</small>`:""}${notes.length?notes.map(note=>`<div class="crc-journey-note"><time>${escapeHtml(note.created_at||"")}</time><p>${escapeHtml(note.note)}</p></div>`).join(""):item.stage_note?`<div class="crc-journey-note"><p>${escapeHtml(item.stage_note)}</p></div>`:`<p class="crc-empty-record">Nenhuma anotação registrada por este profissional.</p>`}</article>`;
  }).join("");
}
function renderPatient(patient) {
  state.patient=patient;
  $("#crcPatientTitle").textContent=patient.name;
  $("#crcPatientInfo").textContent=`Responsável principal: ${patient.professional || "Não informado"}. Dados clínicos em leitura; procedimentos e contato sob responsabilidade da CRC.`;
  $("#crcPatientDetails").innerHTML=`<div><small>Status</small><strong>${escapeHtml(patient.status)}</strong></div><div><small>Última consulta</small><strong>${formatDate(patient.last_visit)}</strong></div><div><small>Próxima consulta</small><strong>${patient.next_appointment ? `${escapeHtml(patient.next_appointment_type || "Agendado")} · ${formatDate(patient.next_appointment)}` : "Sem agendamento"}</strong></div><div><small>Retorno</small><strong>${escapeHtml(patient.next_action || "Não informado")}</strong></div>`;
  const observations=patient.observations||[];
  $("#crcObservations").previousElementSibling.textContent=(patient.journey||[]).some(item=>!item.is_primary)?"Histórico completo dos prontuários":"Observações do prontuário";
  $("#crcObservations").innerHTML=observations.length ? observations.map(item=>`<article><time>${escapeHtml(item.created_at || "")}${item.author_name?` · ${escapeHtml(item.author_name)}`:""}</time><p>${escapeHtml(item.note)}</p></article>`).join("") : "<p>Sem observações registradas.</p>";
  renderJourney(patient);
  $("#crcProcedureList").innerHTML=(patient.procedures||[]).map(procedureRow).join(""); bindProcedureRows();
  $("#crcPhone").value=patient.phone||""; $("#crcLastContact").value=patient.last_contact||""; $("#crcReference").value=patient.reference||""; $("#crcStage").value=patient.crc_status||"Aguardando contato";
  $("#crcNextAppointment").value=patient.next_appointment||"";
  $("#crcNextAppointmentType").value=patient.next_appointment_type||"Programado";
  updateAppointmentHelp();
}
async function openPatient(id) { try { renderPatient(await api(`/api/patients/${id}`)); $("#crcPatientDialog").showModal(); } catch(error) { toast(error.message,true); } }
function updateAppointmentHelp() {
  const scheduled=$("#crcNextAppointmentType").value==="Agendado";
  $("#crcAppointmentHelp").textContent=scheduled
    ?"Ao salvar, o paciente muda para Agendado na carteira do dentista e sai da fila pendente do CRC."
    :"Programado permanece na fila do CRC até a confirmação.";
}
async function savePatient(event) {
  event.preventDefault();
  if (!state.patient) return;
  const appointmentType=$("#crcNextAppointmentType").value;
  const appointmentDate=$("#crcNextAppointment").value;
  const confirmed=Boolean(appointmentDate) && appointmentType==="Agendado";
  try {
    const updated=await api(`/api/patients/${state.patient.id}/crc`,{method:"PATCH",body:JSON.stringify({
      phone:$("#crcPhone").value.trim(),
      last_contact:$("#crcLastContact").value,
      reference:$("#crcReference").value.trim(),
      crc_status:$("#crcStage").value,
      next_appointment:appointmentDate,
      next_appointment_type:appointmentDate?appointmentType:"",
      procedures:collectProcedures()
    })});
    renderPatient(updated);
    toast(confirmed?"Agendamento confirmado e carteira do dentista atualizada.":"Atualização CRC salva com sucesso.");
    await Promise.all([loadDashboard(),loadPatients()]);
    if (confirmed || $("#crcStage").value === "Retorno concluído") $("#crcPatientDialog").close();
  } catch(error) { toast(error.message,true); }
}
function refresh(){ loadPatients().catch(error=>toast(error.message,true)); }
function showCrcView(view){
  const queue=view==="returns";
  $$(".nav-list .nav-item").forEach((item,index)=>item.classList.toggle("active",queue?index===1:index===0));
  $$(".topbar,.crc-hero,.crc-metrics").forEach(section=>section.hidden=queue);
  $("#crcQueue").classList.toggle("crc-returns-view",queue);
  if(queue){state.attention="";state.crc_stage="";$("#crcStageFilter").value="";refresh();$("#crcQueue").scrollIntoView({behavior:"smooth",block:"start"});}
}
async function init() {
  const auth=await api("/api/auth/status"); if(!auth.authenticated){location.replace("/login");return;} if(auth.user.role!=="crc"){location.replace("/");return;} if(!auth.user.two_factor_enabled&&!auth.user.two_factor_exempt){location.replace("/two-factor-setup");return;} if(auth.user.must_change_password){location.replace("/change-password");return;}
  $("#crcName").textContent=auth.user.name; $("#crcInitials").textContent=initials(auth.user.name); $("#crcDate").textContent=new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long",timeZone:"America/Cuiaba"}).format(new Date()); const hour=Number(new Intl.DateTimeFormat("en-US",{hour:"2-digit",hourCycle:"h23",timeZone:"America/Cuiaba"}).format(new Date())); $("#crcGreeting").textContent=`${hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite"}, ${auth.user.name}.`;
  $("#crcSearch").oninput=event=>{state.search=event.target.value;refresh();}; $("#crcStatus").onchange=event=>{state.status=event.target.value;refresh();}; $("#crcSchedule").onchange=event=>{state.next_schedule=event.target.value;refresh();}; $("#crcMonth").onchange=event=>{state.month=event.target.value;refresh();}; $("#crcStageFilter").onchange=event=>{state.crc_stage=event.target.value;refresh();};
  $$("[data-crc-filter]").forEach(button=>button.onclick=()=>{state.attention=button.dataset.crcFilter;refresh();}); $("#crcLogout").onclick=async()=>{await fetch("/api/auth/logout",{method:"POST"});location.replace("/login");}; $("#crcAddProcedure").onclick=()=>{$("#crcProcedureList").insertAdjacentHTML("beforeend",procedureRow());bindProcedureRows();}; $("#closeCrcDialog").onclick=()=>$("#crcPatientDialog").close(); $("#crcPatientForm").onsubmit=savePatient; $("#crcNextAppointmentType").onchange=updateAppointmentHelp;
  const navItems=$$(".nav-list .nav-item");navItems[0].onclick=()=>showCrcView("overview");navItems[1].onclick=()=>showCrcView("returns");$("#crcWhatsappNav span:last-child").textContent="Abrir CRM";$("#crcWhatsappNav").onclick=()=>window.open("/central-crc/whatsapp","iea-crm-whatsapp");
  document.addEventListener("click",event=>{if(!event.target.closest("#crcProfessionalFilter")) $("#crcProfessionalOptions").hidden=true;});
  await Promise.all([loadDashboard(),loadFilters(),loadPatients()]);
}
init().catch(error=>toast(error.message,true));
