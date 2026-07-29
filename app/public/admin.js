const state = { admin: null, crmAccess: null, tab: "overview", importRows: [], importValidated: false, professionalPhoto: null, appointmentFiles: [], appointmentToken: null, relationshipDirectoryFiles: [], relationshipDirectoryToken: null, scheduledPatientFiles: [], scheduledPatientToken: null, professionalFilters: {search: "", role: "", status: ""} };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const slug = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const currency = (cents = 0) => new Intl.NumberFormat("pt-BR", {style: "currency", currency: "BRL"}).format(cents / 100);
const accessRoleLabels = {professional: "Dentista", asb: "ASB", crc: "CRC", admin: "Admin Geral", owner: "Proprietária"};
const accessRoleLabel = role => accessRoleLabels[role] || "Não definido";

async function api(path, options = {}) {
  const response = await fetch(path, {headers: {"Content-Type": "application/json"}, ...options});
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error(response.ok ? "Resposta inválida do servidor." : `Servidor indisponível (${response.status}).`); }
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

async function loadCrmAccess() {
  state.crmAccess = await api("/api/admin/crm-channel-access");
  renderCrmAccess();
}

function crmChannelLabel(channel) { return channel.display_name || channel.instance_name || `Canal ${channel.id}`; }
const crmFeatureLabels = {inbox:"Inbox",queue:"Filas",funnel:"Funil",management:"Gestão",contacts:"Contatos",campaigns:"Campanhas",integrations:"Integrações",settings:"Configurações"};

function renderCrmAccess() {
  const data = state.crmAccess;
  if (!data) return;
  const channels = data.channels || [];
  const users = data.users || [];
  $("#crmAccessGrid").innerHTML = users.length ? users.map(user => {
    const selected = new Set(String(user.channel_ids || "").split(",").filter(Boolean));
    const selectedFeatures = new Set(String(user.feature_keys || "").split(",").filter(Boolean));
    const restricted = Number(user.crm_channel_scope_enabled) === 1;
    const featuresRestricted = Number(user.crm_feature_scope_enabled) === 1;
    return `<article class="crm-access-card" data-crm-access-user="${user.id}">
      <div class="crm-access-card-head"><div class="admin-overview-avatar">${escapeHtml(initials(user.name))}</div><div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email || "")}</small></div><span class="access-badge ${user.active ? "" : "off"}">${user.active ? "Ativo" : "Bloqueado"}</span></div>
      <label class="crm-scope-toggle"><input type="checkbox" data-crm-scope ${restricted ? "checked" : ""}><span><strong>Restringir aos números marcados</strong><small>Desmarcado: visualiza todos os canais.</small></span></label>
      <div class="crm-channel-checks">${channels.map(channel => `<label><input type="checkbox" data-crm-channel value="${channel.id}" ${selected.has(String(channel.id)) ? "checked" : ""}><span><strong>${escapeHtml(crmChannelLabel(channel))}</strong><small>${escapeHtml(channel.phone || channel.instance_name || "Sem telefone")} · ${channel.sync_enabled ? "Sincronizando" : "Pausado"}</small></span></label>`).join("") || '<p class="empty-state">Nenhum canal conectado.</p>'}</div>
      <label class="crm-manager-toggle"><input type="checkbox" data-crm-manager ${Number(user.can_manage_automation) ? "checked" : ""}><span><strong>Supervisão de canais e automações</strong><small>Pode pausar sincronização e executar importações.</small></span></label>
      <div class="crm-feature-permissions"><div class="crm-feature-title"><strong>Telas disponíveis</strong><label><input type="checkbox" data-crm-feature-scope ${featuresRestricted ? "checked" : ""}> Personalizar</label></div><div class="crm-feature-checks">${Object.entries(crmFeatureLabels).map(([key,label]) => `<label><input type="checkbox" data-crm-feature value="${key}" ${selectedFeatures.has(key) || !featuresRestricted ? "checked" : ""}><span>${label}</span></label>`).join("")}</div><small>Com “Personalizar” desmarcado, todas as telas permanecem liberadas.</small></div>
      <button class="primary-button" type="button" data-save-crm-access="${user.id}">Salvar permissões</button>
    </article>`;
  }).join("") : '<p class="empty-state">Nenhum acesso CRC cadastrado.</p>';
  $("#crmTestUser").innerHTML = `<option value="">Selecione</option>${users.filter(user => user.active).map(user => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("")}`;
  $("#crmTestChannel").innerHTML = `<option value="">Selecione</option>${channels.map(channel => `<option value="${channel.id}">${escapeHtml(crmChannelLabel(channel))}</option>`).join("")}`;
  $$('[data-save-crm-access]').forEach(button => button.addEventListener("click", () => saveCrmAccess(button.dataset.saveCrmAccess)));
}

async function saveCrmAccess(userId) {
  const card = $(`[data-crm-access-user="${userId}"]`);
  const payload = {user_id: Number(userId), scope_enabled: card.querySelector('[data-crm-scope]').checked, can_manage_automation: card.querySelector('[data-crm-manager]').checked, channel_ids: [...card.querySelectorAll('[data-crm-channel]:checked')].map(input => Number(input.value)), feature_scope_enabled: card.querySelector('[data-crm-feature-scope]').checked, feature_keys: [...card.querySelectorAll('[data-crm-feature]:checked')].map(input => input.value)};
  if (payload.scope_enabled && !payload.channel_ids.length && !confirm("Esta atendente ficará sem acesso a nenhum número. Continuar?")) return;
  if (payload.feature_scope_enabled && !payload.feature_keys.length && !confirm("Esta atendente ficará sem nenhuma tela do CRM. Continuar?")) return;
  try { await api("/api/admin/crm-channel-access", {method:"POST", body:JSON.stringify(payload)}); await loadCrmAccess(); showToast("Permissões do CRM salvas."); } catch (error) { showToast(error.message, true); }
}

async function testCrmTransfer() {
  const user_id = Number($("#crmTestUser").value), channel_id = Number($("#crmTestChannel").value);
  if (!user_id || !channel_id) return showToast("Selecione a atendente e o número.", true);
  try {
    const result = await api("/api/admin/crm-channel-access/test", {method:"POST", body:JSON.stringify({user_id, channel_id})});
    const box = $("#crmTransferTestResult"); box.hidden = false; box.classList.toggle("allowed", result.transfer_allowed); box.classList.toggle("blocked", !result.transfer_allowed);
    box.innerHTML = `<strong>${result.transfer_allowed ? "Transferência liberada" : "Transferência bloqueada"}</strong><span>${escapeHtml(result.message)}</span><small>Visualizar: ${result.can_view ? "sim" : "não"} · Responder: ${result.can_reply ? "sim" : "não"} · Automações: ${result.can_manage_automation ? "sim" : "não"}</small>`;
  } catch (error) { showToast(error.message, true); }
}

function showToast(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.style.background = error ? "#a94442" : "";
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function updateDate() {
  const label = new Intl.DateTimeFormat("pt-BR", {weekday: "long", day: "2-digit", month: "long", timeZone: "America/Cuiaba"}).format(new Date());
  $("#adminCurrentDate").textContent = label;
}

async function loadAdmin() {
  state.admin = await api("/api/admin");
  renderAdmin();
}

function filteredProfessionals() {
  const items = state.admin?.professionals || [];
  const search = state.professionalFilters.search.trim().toLocaleLowerCase("pt-BR");
  return items.filter(item => {
    const matchesSearch = !search || `${item.name || ""} ${item.email || ""}`.toLocaleLowerCase("pt-BR").includes(search);
    const matchesRole = !state.professionalFilters.role || item.access_role === state.professionalFilters.role;
    const matchesStatus = !state.professionalFilters.status
      || (state.professionalFilters.status === "active" && Boolean(item.access_active))
      || (state.professionalFilters.status === "blocked" && !item.access_active);
    return matchesSearch && matchesRole && matchesStatus;
  });
}

function renderProfessionalsTable() {
  const allItems = state.admin?.professionals || [];
  const items = filteredProfessionals();
  $("#adminProfessionalCount").textContent = items.length === allItems.length ? `${allItems.length} cadastrados` : `${items.length} de ${allItems.length} cadastrados`;
  $("#adminProfessionalsTable").innerHTML = items.length ? items.map(item => {
    const linkedPortfolio = item.access_role === "asb" && item.linked_professional_name
      ? `<span class="linked-portfolio-badge">${escapeHtml(item.linked_professional_name)}</span>`
      : '<span class="linked-portfolio-empty">—</span>';
    return `<tr><td><div class="admin-person"><strong>${escapeHtml(item.name)}${item.is_owner ? " · Proprietária" : ""}</strong><small>${escapeHtml(item.email || "Sem e-mail")}</small></div></td><td><span class="access-level-badge access-level-${escapeHtml(item.access_role || "undefined")}">${escapeHtml(accessRoleLabel(item.access_role))}</span></td><td>${escapeHtml(item.specialties || "Não definida")}</td><td>${escapeHtml(item.offices || "Não definido")}</td><td>${linkedPortfolio}</td><td>${item.patient_count} pacientes</td><td><span class="access-badge ${item.access_active ? "" : "off"}">${item.access_active ? "Ativo" : "Bloqueado"}</span></td><td><button class="admin-edit-button" type="button" data-edit-professional="${item.id}">Editar</button></td></tr>`;
  }).join("") : `<tr class="loading-row"><td colspan="8">Nenhum profissional encontrado com estes filtros.</td></tr>`;
  $$('[data-edit-professional]').forEach(button => {
    button.addEventListener("click", () => editProfessional(button.dataset.editProfessional));
    const resetButton = document.createElement("button");
    resetButton.className = "admin-edit-button admin-reset-password";
    resetButton.type = "button";
    resetButton.textContent = "Redefinir senha";
    resetButton.addEventListener("click", () => resetProfessionalPassword(button.dataset.editProfessional));
    button.after(resetButton);
  });
}

function renderAdmin() {
  const data = state.admin;
  if (!data) return;
  $("#adminPatients").textContent = data.summary.patients;
  $("#adminProfessionals").textContent = data.summary.professionals;
  $("#adminPasswordRequests").innerHTML = data.password_reset_requests?.length ? data.password_reset_requests.map(item => `<div class="admin-master-item"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)} · Solicitação pendente</small></div><button class="admin-edit-button" type="button" data-complete-reset="${item.id}">Definir senha temporária</button></div>`).join("") : '<p class="empty-state">Nenhuma solicitação pendente.</p>';
  $("#adminAccesses").textContent = data.summary.active_accesses;
  $("#adminPotential").textContent = currency(data.summary.potential_value_cents);
  $("#adminOfficeCount").textContent = data.summary.offices;
  $("#adminSpecialtyCount").textContent = data.summary.specialties;
  $("#adminUnassigned").textContent = data.summary.unassigned;
  $("#adminTeamOverview").innerHTML = data.professionals.map(item => `<div class="admin-overview-item"><span class="admin-overview-avatar">${escapeHtml(initials(item.name))}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.specialties || item.role || "Sem especialidade")}</small></div><span>${item.patient_count} pacientes</span></div>`).join("");
  $("#adminOfficeOverview").innerHTML = data.offices.map(item => `<div class="admin-overview-item"><span class="admin-overview-avatar">${escapeHtml(String(item.name).replace(/\D/g, "").slice(-2) || "IEA")}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.responsibles || "Sem responsável definido")}</small></div><span>${item.professional_count} profissionais</span></div>`).join("");
  renderProfessionalsTable();
  $("#adminSpecialtiesList").innerHTML = data.specialties.map(item => `<div class="admin-master-item"><div><strong>${escapeHtml(item.name)}</strong><small>${item.professional_count} profissionais vinculados</small></div><div class="admin-master-actions"><span>${item.active ? "Ativa" : "Off"}</span><button type="button" data-edit-structure="specialties" data-item-id="${item.id}">Editar</button><button type="button" data-delete-structure="specialties" data-item-id="${item.id}" data-item-name="${escapeHtml(item.name)}">Excluir</button></div></div>`).join("");
  $("#adminOfficesList").innerHTML = data.offices.map(item => `<div class="admin-master-item"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.responsibles || "Sem responsável")} · ${item.professional_count} profissionais</small></div><span>${item.active ? "Ativo" : "Off"}</span></div>`).join("");
  $("#adminOfficesList").innerHTML = data.offices.map(item => `<div class="admin-master-item"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.responsibles || "Sem responsável")} · ${item.professional_count} profissionais</small></div><div class="admin-master-actions"><span>${item.active ? "Ativo" : "Off"}</span><button type="button" data-edit-structure="offices" data-item-id="${item.id}">Editar</button><button type="button" data-delete-structure="offices" data-item-id="${item.id}" data-item-name="${escapeHtml(item.name)}">Excluir</button></div></div>`).join("");
  const specialtyValue = $("#adminProfessionalSpecialty").value;
  const officeValue = $("#adminProfessionalOffice").value;
  $("#adminProfessionalSpecialty").innerHTML = `<option value="">Selecione</option>${data.specialties.filter(item => item.active).map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  $("#adminProfessionalOffice").innerHTML = `<option value="">Selecione</option>${data.offices.filter(item => item.active).map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  const dentistCandidates = data.professionals.filter(item => item.access_role === "professional" && item.active && /dentista|odont|ortod/i.test(String(item.role || "")));
  $("#adminLinkedDentist").innerHTML = `<option value="">Selecione o dentista</option>${dentistCandidates.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  renderCrmChannelOptions();
  if (specialtyValue) $("#adminProfessionalSpecialty").value = specialtyValue;
  if (officeValue) $("#adminProfessionalOffice").value = officeValue;
  $$('[data-complete-reset]').forEach(button => button.addEventListener("click", () => completePasswordReset(button.dataset.completeReset)));
  $$('[data-edit-structure]').forEach(button => button.addEventListener("click", () => editStructure(button.dataset.editStructure, button.dataset.itemId)));
  $$('[data-delete-structure]').forEach(button => button.addEventListener("click", () => deleteStructure(button.dataset.deleteStructure, button.dataset.itemId, button.dataset.itemName)));
}

function renderCrmChannelOptions(selectedIds = null) {
  const selected = new Set(selectedIds || $$('[name="adminCrmChannel"]').filter(input => input.checked).map(input => String(input.value)));
  const channels = state.admin?.crm_channels || [];
  $("#adminCrmChannelOptions").innerHTML = channels.length ? channels.map(channel => `<label style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #e5eaf0;border-radius:9px;cursor:pointer"><input name="adminCrmChannel" type="checkbox" value="${channel.id}" ${selected.has(String(channel.id)) ? "checked" : ""}><span><strong>${escapeHtml(channel.display_name || channel.instance_name)}</strong><small style="display:block;color:#7b8795">${escapeHtml(channel.phone || channel.instance_name)} · ${channel.sync_enabled ? "Sincronizando" : "Pausado no CRM"}</small></span></label>`).join("") : '<p class="empty-state">Nenhum número conectado ainda.</p>';
}

async function completePasswordReset(id) {
  const password = prompt('Defina a senha temporária (mínimo 10 caracteres):');
  if (password === null) return;
  try { await api(`/api/admin/password-resets/${id}/complete`, {method: 'POST', body: JSON.stringify({temporary_password: password})}); await loadAdmin(); showToast('Senha temporária definida. O dentista deverá alterá-la no primeiro acesso.'); } catch (error) { showToast(error.message, true); }
}

async function resetProfessionalPassword(id) {
  const password = prompt("Defina a senha temporária (mínimo de 10 caracteres):");
  if (password === null) return;
  try {
    await api(`/api/admin/professionals/${id}/reset-password`, {method: "POST", body: JSON.stringify({temporary_password: password})});
    showToast("Senha temporária definida. No próximo acesso, o profissional deverá criar a própria senha.");
  } catch (error) { showToast(error.message, true); }
}

async function editStructure(type, id) {
  const item = state.admin[type].find(row => String(row.id) === String(id));
  const name = prompt(`Editar item:`, item?.name || '');
  if (name === null || !name.trim()) return;
  try { await api(`/api/admin/${type}/${id}`, {method: 'PATCH', body: JSON.stringify({name: name.trim(), active: item.active})}); await loadAdmin(); showToast('Estrutura atualizada.'); } catch (error) { showToast(error.message, true); }
}
async function deleteStructure(type, id, name) {
  if (!confirm(`Excluir “${name}”? Só é possível se não houver profissionais vinculados.`)) return;
  try { await api(`/api/admin/${type}/${id}`, {method: 'DELETE'}); await loadAdmin(); showToast('Item excluído.'); } catch (error) { showToast(error.message, true); }
}

function setTab(tab) {
  state.tab = tab;
  $$('[data-admin-tab]').forEach(button => button.classList.toggle("active", button.dataset.adminTab === tab));
  $$('[data-side-admin-tab]').forEach(button => {
    const active = button.dataset.sideAdminTab === tab;
    button.classList.toggle("active", active);
    button.toggleAttribute("aria-current", active);
  });
  $$('[data-admin-panel]').forEach(panel => { panel.hidden = panel.dataset.adminPanel !== tab; });
  $("#adminOverviewHero").hidden = tab !== "overview";
  $("#adminOverviewMetrics").hidden = tab !== "overview";
  if (tab === "audit") loadAudit();
  if (tab === "integrations") loadClinicorpConfig();
  if (tab === "crm-access") loadCrmAccess().catch(error => showToast(error.message, true));
  if (window.innerWidth <= 820) $(".sidebar").classList.remove("open");
}

function resetProfessionalForm() {
  $("#adminProfessionalForm").reset();
  state.professionalPhoto = null;
  $("#adminProfessionalPhotoPreview").hidden = true;
  $("#adminProfessionalPhotoPreview").removeAttribute("src");
  $("#adminProfessionalId").value = "";
  $("#adminProfessionalRole").value = "";
  $("#adminServiceSector").value = "CRC";
  $("#adminProfessionalActive").checked = true;
  $("#adminProfessionalFormTitle").textContent = "Novo profissional";
  $("#cancelProfessionalEdit").hidden = true;
  renderCrmChannelOptions([]);
  $("#adminCrmManageAutomation").checked = false;
  updateAccessRoleHelp();
}

function updateAccessRoleHelp() {
  const descriptions = {
    professional: 'Dentista: acessa somente a própria carteira, atualiza o acompanhamento clínico, registra observações, encaminha e verifica pacientes. Pode excluir pacientes da própria carteira mediante senha; não altera procedimentos nem contato/referência.',
    asb: 'ASB: acessa a carteira do dentista ao qual está vinculada e apoia o acompanhamento, encaminhamento e verificação. Pode excluir pacientes dessa carteira mediante senha; não altera procedimentos nem contato/referência.',
    crc: 'CRC: acessa a Central CRC, os pacientes verificados e as jornadas compartilhadas. Pode atualizar procedimentos, telefone, último contato e referência; não altera o acompanhamento clínico do dentista.',
    admin: 'Admin Geral: acessa o painel administrativo, equipe e acessos, estrutura, importações, auditoria, segurança e integrações. Pode excluir pacientes mediante senha; não altera os campos clínicos exclusivos do CRC.',
    owner: 'Proprietária: acessa a própria carteira, supervisiona o sistema e também entra no painel administrativo. Pode excluir pacientes da própria carteira mediante senha; procedimentos e contato/referência continuam exclusivos do CRC.'
  };
  $('#accessRoleHelp').textContent = descriptions[$('#adminAccessRole').value];
  $("#adminLinkedDentistField").hidden = $("#adminAccessRole").value !== "asb";
  $("#adminCrmChannelsField").hidden = $("#adminAccessRole").value !== "crc";
  $("#adminServiceSectorField").hidden = $("#adminAccessRole").value !== "crc";
}

function editProfessional(id) {
  const item = state.admin?.professionals.find(professional => String(professional.id) === String(id));
  if (!item) return;
  $("#adminProfessionalId").value = item.id;
  $("#adminProfessionalName").value = item.name;
  $("#adminProfessionalEmail").value = String(item.email || "").replace(/@instituto\.local$/i, "");
  $("#adminProfessionalRole").value = item.role || "";
  $("#adminAccessRole").value = item.access_role || "professional";
  $("#adminServiceSector").value = item.service_sector || "CRC";
  $("#adminLinkedDentist").value = item.linked_professional_id || "";
  renderCrmChannelOptions(String(item.crm_channel_ids || "").split(",").filter(Boolean));
  $("#adminCrmManageAutomation").checked = Boolean(item.crm_can_manage_automation);
  updateAccessRoleHelp();
  $("#adminProfessionalSpecialty").value = item.specialty_id || "";
  $("#adminProfessionalOffice").value = item.office_id || "";
  $("#adminOfficeResponsible").checked = Boolean(item.office_responsible);
  $("#adminProfessionalActive").checked = Boolean(item.active);
  state.professionalPhoto = null;
  const photoPreview = $("#adminProfessionalPhotoPreview");
  if (item.has_photo) { photoPreview.src = `/api/professionals/${item.id}/photo?cache=${Date.now()}`; photoPreview.hidden = false; } else { photoPreview.hidden = true; photoPreview.removeAttribute("src"); }
  $("#adminProfessionalFormTitle").textContent = "Editar profissional";
  $("#cancelProfessionalEdit").hidden = false;
  $("#adminProfessionalForm").scrollIntoView({behavior: "smooth", block: "start"});
}

async function loadAudit() {
  try {
    const data = await api("/api/admin/audit?limit=100");
    $("#adminAuditTable").innerHTML = data.items.length ? data.items.map(item => `<tr><td>${escapeHtml(new Date(item.created_at.replace(" ", "T") + "-04:00").toLocaleString("pt-BR"))}</td><td>${escapeHtml(item.patient_name)}</td><td><span class="status-badge status-controle">${escapeHtml(item.event_type)}</span></td><td>${escapeHtml(item.description || "—")}</td></tr>`).join("") : `<tr class="loading-row"><td colspan="4">Nenhuma movimentação registrada.</td></tr>`;
  } catch (error) { showToast(error.message, true); }
}
let apiMonitorTimer=null;
let currentApiMonitorId=null;
function formatApiMonitorDate(value){if(!value)return "—";const parsed=new Date(value.replace(" ","T")+"Z");return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"America/Cuiaba"}).format(parsed);}
function formatBrazilianPhone(value){const digits=String(value||"").replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"");if(digits.length===11)return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;if(digits.length===10)return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;return digits||"—";}
async function loadApiMonitor(id){try{const data=await api(`/api/admin/apis/${id}/sync-status`);const item=data.integration;$("#apiMonitorTitle").textContent=`Monitoramento · ${item.name}`;$("#apiMonitorSummary").textContent=item.last_sync_message||"Aguardando início da sincronização.";$("#apiMonitorStatus").textContent=data.running?"Em execução":(item.last_sync_status||"Aguardando");$("#apiMonitorCount").textContent=`${item.last_sync_count||0} telefone(s) preenchido(s)`;$("#apiMonitorLogs").innerHTML=data.logs.length?data.logs.map(log=>`<tr><td>${escapeHtml(formatApiMonitorDate(log.updated_at||log.created_at))}</td><td>${escapeHtml(log.patient_name||"Paciente removido")}</td><td>${escapeHtml(formatBrazilianPhone(log.phone_result))}</td><td><span class="api-log-status api-log-${String(log.status).toLowerCase().replace(/[^a-z]+/g,"-")}">${escapeHtml(log.status)}</span></td><td>${escapeHtml(log.detail||"—")}</td></tr>`).join(""):`<tr class="loading-row"><td colspan="5">Ainda não há consultas registradas.</td></tr>`;$("#apiFailureCount").textContent=`${data.failure_count||0} paciente(s)`;$("#apiFailureLogs").innerHTML=data.failures?.length?data.failures.map(log=>`<tr><td>${escapeHtml(log.patient_name||"Paciente removido")}</td><td>${escapeHtml(log.detail||log.status)}</td><td>${escapeHtml(formatApiMonitorDate(log.updated_at||log.created_at))}</td></tr>`).join(""):`<tr class="loading-row"><td colspan="3">Nenhuma falha registrada.</td></tr>`;$("#retryApiFailures").disabled=!data.failure_count||data.running;}catch(error){$("#apiMonitorSummary").textContent=error.message;}}
async function loadApiRunHistory(id){if(!$("#apiRunHistory")){const history=document.createElement("details");history.className="api-run-history";history.open=true;history.innerHTML=`<summary><strong>Histórico de atualizações</strong><span>Últimas 30 execuções</span></summary><div class="admin-table-wrap"><table><thead><tr><th>Data e hora</th><th>Consultados</th><th>Atualizados</th><th>Falhas</th><th>Situação</th></tr></thead><tbody id="apiRunHistory"></tbody></table></div>`;$(".api-failure-list").before(history);}try{const data=await api(`/api/admin/apis/${id}/sync-status`);$("#apiRunHistory").innerHTML=data.runs?.length?data.runs.map(run=>`<tr><td>${escapeHtml(formatApiMonitorDate(run.started_at))}</td><td><strong>${run.attempted_count||0}</strong></td><td><strong>${run.updated_count||0}</strong></td><td>${run.failed_count||0}</td><td><span class="api-log-status api-log-${String(run.status).toLowerCase().replace(/[^a-z]+/g,"-")}">${escapeHtml(run.status)}</span></td></tr>`).join(""):`<tr class="loading-row"><td colspan="5">Nenhuma sincronização registrada.</td></tr>`;}catch(error){$("#apiRunHistory").innerHTML=`<tr class="loading-row"><td colspan="5">${escapeHtml(error.message)}</td></tr>`;}}
function openApiMonitor(id){currentApiMonitorId=id;if(apiMonitorTimer)clearInterval(apiMonitorTimer);$("#apiSyncMonitorDialog").showModal();loadApiMonitor(id);loadApiRunHistory(id);apiMonitorTimer=setInterval(()=>{loadApiMonitor(id);loadApiRunHistory(id);},5000);}
async function loadClinicorpConfig(){try{const data=await api("/api/admin/apis");state.apis=data.items;$("#apiIntegrationList").innerHTML=data.items.map(item=>{const clinicorp=item.name.toLowerCase().startsWith("clinicorp");const syncInfo=item.last_sync_at?`<small class="api-sync-info">${escapeHtml(item.last_sync_status||"Última sincronização")}: ${escapeHtml(item.last_sync_message||"")}</small>`:"";return `<article class="api-card" data-api-id="${item.id}" tabindex="0" role="button"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description)}</small>${syncInfo}${clinicorp?`<button class="api-sync-button" type="button" data-api-sync="${item.id}" ${!item.active||!item.token_configured?"disabled":""}>Sincronizar telefones</button><button class="api-monitor-button" type="button" data-api-monitor="${item.id}">Acompanhar sincronização</button>`:""}${item.has_backup?`<button class="api-revert-button" type="button" data-api-revert="${item.id}">Desfazer última alteração</button>`:""}</span><label class="api-toggle" title="Ativar ou desativar"><input type="checkbox" data-api-toggle="${item.id}" ${item.active?"checked":""}><i></i></label></article>`}).join("")||"<p>Nenhuma API cadastrada.</p>";$$('[data-api-id]').forEach(card=>{card.onclick=event=>{if(event.target.closest('.api-toggle, .api-sync-button, .api-monitor-button, .api-revert-button'))return;openApiDialog(state.apis.find(item=>String(item.id)===card.dataset.apiId));};card.onkeydown=event=>{if((event.key==="Enter"||event.key===" ")&&!event.target.closest('.api-toggle, .api-sync-button, .api-monitor-button, .api-revert-button')){event.preventDefault();openApiDialog(state.apis.find(item=>String(item.id)===card.dataset.apiId));}};});$$('[data-api-toggle]').forEach(input=>input.onchange=async()=>{const item=state.apis.find(api=>String(api.id)===input.dataset.apiToggle);try{await api('/api/admin/apis',{method:'POST',body:JSON.stringify({...item,active:input.checked,api_token:''})});await loadClinicorpConfig();}catch(error){showToast(error.message,true);}});$$('[data-api-sync]').forEach(button=>button.onclick=async event=>{event.stopPropagation();const testOnly=!confirm("Deseja iniciar a sincronização completa? Clique em Cancelar para testar somente um paciente primeiro.");button.disabled=true;try{const result=await api(`/api/admin/apis/${button.dataset.apiSync}/sync`,{method:'POST',body:JSON.stringify({test_only:testOnly})});showToast(result.message);await loadClinicorpConfig();}catch(error){showToast(error.message,true);button.disabled=false;}});$$('[data-api-monitor]').forEach(button=>button.onclick=event=>{event.stopPropagation();openApiMonitor(button.dataset.apiMonitor);});$$('[data-api-revert]').forEach(button=>button.onclick=async event=>{event.stopPropagation();if(!confirm("Desfazer a última alteração desta API? A configuração anterior será restaurada."))return;try{await api(`/api/admin/apis/${button.dataset.apiRevert}/revert`,{method:"POST",body:"{}"});await loadClinicorpConfig();showToast("Configuração anterior restaurada.");}catch(error){showToast(error.message,true);}});}catch(error){showToast(error.message,true);}}
function openApiDialog(item){$("#apiIntegrationForm").reset();$("#apiIntegrationId").value=item?.id||"";$("#apiDialogTitle").textContent=item?item.name:"Nova API";$("#apiIntegrationName").value=item?.name||"";$("#apiIntegrationDescription").value=item?.description||"";$("#apiIntegrationUrl").value=item?.api_base_url||"";$("#apiIntegrationSubscriberId").value=item?.subscriber_id||"";$("#apiIntegrationUser").value=item?.api_user||"";$("#apiIntegrationInterval").value=item?.sync_interval_seconds||60;$("#deleteApiButton").hidden=!item;$("#apiIntegrationDialog").showModal();}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if ((char === "," || char === ";") && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[index + 1] === "\n") index++; row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(value => slug(value).replace(/\s+/g, "_"));
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function renderImportPreview() {
  const items = state.importRows.slice(0, 5);
  $("#adminImportPreview").innerHTML = items.length ? `<table><thead><tr><th>Nome</th><th>Última consulta</th><th>Status</th><th>Profissional</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.name || item.nome || "—")}</td><td>${escapeHtml(item.last_visit || item.ultima_consulta || "—")}</td><td>${escapeHtml(item.status || "Consulta")}</td><td>${escapeHtml(item.professional_email || item.email_profissional || "Dra. Dulce")}</td></tr>`).join("")}</tbody></table>` : "";
}

async function runImport(dryRun) {
  try {
    const result = await api("/api/admin/import/patients", {method: "POST", body: JSON.stringify({rows: state.importRows, dry_run: dryRun})});
    const box = $("#adminImportResult");
    box.hidden = false;
    box.classList.toggle("error", result.errors.length > 0);
    box.innerHTML = `<strong>${dryRun ? "Validação concluída" : "Importação concluída"}</strong><br>${result.valid} válidos · ${result.duplicates} duplicados · ${result.errors.length} com erro${dryRun ? "" : ` · ${result.imported} importados`}`;
    state.importValidated = dryRun && result.errors.length === 0;
    $("#confirmImport").disabled = !state.importValidated;
    if (!dryRun) { state.importValidated = false; await loadAdmin(); }
  } catch (error) { showToast(error.message, true); }
}

$$('[data-admin-tab]').forEach(button => button.addEventListener("click", () => setTab(button.dataset.adminTab)));
$$('[data-side-admin-tab]').forEach(button => button.addEventListener("click", () => setTab(button.dataset.sideAdminTab)));
$("#refreshCrmAccess").addEventListener("click", () => loadCrmAccess().catch(error => showToast(error.message, true)));
$("#testCrmTransfer").addEventListener("click", testCrmTransfer);
$$('[data-open-admin-tab]').forEach(button => button.addEventListener("click", () => setTab(button.dataset.openAdminTab)));
$("#adminMobileMenu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
$("#cancelProfessionalEdit").addEventListener("click", resetProfessionalForm);
$("#adminAccessRole").addEventListener("change", updateAccessRoleHelp);
$("#adminProfessionalSearch").addEventListener("input", event => {
  state.professionalFilters.search = event.target.value;
  renderProfessionalsTable();
});
$("#adminProfessionalRoleFilter").addEventListener("change", event => {
  state.professionalFilters.role = event.target.value;
  renderProfessionalsTable();
});
$("#adminProfessionalStatusFilter").addEventListener("change", event => {
  state.professionalFilters.status = event.target.value;
  renderProfessionalsTable();
});
$("#clearProfessionalFilters").addEventListener("click", () => {
  state.professionalFilters = {search: "", role: "", status: ""};
  $("#adminProfessionalSearch").value = "";
  $("#adminProfessionalRoleFilter").value = "";
  $("#adminProfessionalStatusFilter").value = "";
  renderProfessionalsTable();
  $("#adminProfessionalSearch").focus();
});
$("#adminProfessionalForm").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("#adminProfessionalId").value;
   const emailUser = $("#adminProfessionalEmail").value.trim().toLowerCase().replace(/@instituto\.local$/i, "");
   const payload = {name: $("#adminProfessionalName").value.trim(), email: `${emailUser}@instituto.local`, role: $("#adminProfessionalRole").value.trim(), access_role: $("#adminAccessRole").value, service_sector: $("#adminServiceSector").value, linked_professional_id: $("#adminLinkedDentist").value, specialty_id: $("#adminProfessionalSpecialty").value, office_id: $("#adminProfessionalOffice").value, office_responsible: $("#adminOfficeResponsible").checked, active: $("#adminProfessionalActive").checked, temporary_password: $("#adminTemporaryPassword").value, crm_channel_ids: $$('[name="adminCrmChannel"]:checked').map(input => Number(input.value)), crm_can_manage_automation: $("#adminCrmManageAutomation").checked};
   try { const result = await api(id ? `/api/admin/professionals/${id}` : "/api/admin/professionals", {method: id ? "PATCH" : "POST", body: JSON.stringify(payload)}); const professionalId = id || result.id; if (state.professionalPhoto) await api(`/api/admin/professionals/${professionalId}/photo`, {method: "POST", body: JSON.stringify({image: state.professionalPhoto})}); resetProfessionalForm(); await loadAdmin(); showToast(id ? "Profissional atualizado." : "Profissional e acesso preparados."); }
  catch (error) { showToast(error.message, true); }
});
$("#adminProfessionalPhoto").addEventListener("change", event => {
  const file = event.target.files?.[0]; if (!file) return;
  if (!/image\/(jpeg|png|webp)/.test(file.type) || file.size > 2 * 1024 * 1024) { showToast("Use JPG, PNG ou WEBP de até 2 MB.", true); event.target.value = ""; return; }
  const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { if (image.naturalWidth < 400 || image.naturalHeight < 400) { showToast("Use uma foto com pelo menos 400 × 400 pixels para manter a qualidade.", true); event.target.value = ""; return; } state.professionalPhoto = reader.result; const preview = $("#adminProfessionalPhotoPreview"); preview.src = reader.result; preview.hidden = false; }; image.src = reader.result; }; reader.readAsDataURL(file);
});
$("#newApiButton").addEventListener("click",()=>openApiDialog());$("#cancelApiDialog").addEventListener("click",()=>$("#apiIntegrationDialog").close());$("#apiIntegrationForm").addEventListener("submit",async event=>{event.preventDefault();try{const old=state.apis?.find(item=>String(item.id)===$("#apiIntegrationId").value);await api("/api/admin/apis",{method:"POST",body:JSON.stringify({name:$("#apiIntegrationName").value.trim(),description:$("#apiIntegrationDescription").value.trim(),api_base_url:$("#apiIntegrationUrl").value.trim(),subscriber_id:$("#apiIntegrationSubscriberId").value.trim(),api_user:$("#apiIntegrationUser").value.trim(),api_token:$("#apiIntegrationToken").value,sync_interval_seconds:Number($("#apiIntegrationInterval").value),active:old?.active??true})});$("#apiIntegrationDialog").close();await loadClinicorpConfig();showToast("API salva. O token permanece oculto.");}catch(error){showToast(error.message,true);}});
$("#closeApiMonitor").addEventListener("click",()=>$("#apiSyncMonitorDialog").close());$("#apiSyncMonitorDialog").addEventListener("close",()=>{if(apiMonitorTimer){clearInterval(apiMonitorTimer);apiMonitorTimer=null;}});
$("#retryApiFailures").addEventListener("click",async()=>{if(!currentApiMonitorId||!confirm("Liberar todos os pacientes com falha para uma nova tentativa?"))return;try{const result=await api(`/api/admin/apis/${currentApiMonitorId}/retry-failures`,{method:"POST",body:"{}"});showToast(result.message);await loadApiMonitor(currentApiMonitorId);}catch(error){showToast(error.message,true);}});
$("#deleteApiButton").addEventListener("click",async()=>{const id=$("#apiIntegrationId").value;if(!id||!confirm("Excluir esta API? Os dados de conexão serão removidos."))return;try{await api(`/api/admin/apis/${id}`,{method:"DELETE"});$("#apiIntegrationDialog").close();await loadClinicorpConfig();showToast("API excluída.");}catch(error){showToast(error.message,true);}});
$("#adminSpecialtyForm").addEventListener("submit", async event => { event.preventDefault(); try { await api("/api/admin/specialties", {method: "POST", body: JSON.stringify({name: $("#adminSpecialtyName").value.trim()})}); event.target.reset(); await loadAdmin(); showToast("Especialidade adicionada."); } catch (error) { showToast(error.message, true); } });
$("#adminOfficeForm").addEventListener("submit", async event => { event.preventDefault(); try { await api("/api/admin/offices", {method: "POST", body: JSON.stringify({name: $("#adminOfficeName").value.trim()})}); event.target.reset(); await loadAdmin(); showToast("Consultório adicionado."); } catch (error) { showToast(error.message, true); } });
async function fileToBase64(file) { const buffer = await file.arrayBuffer(); const bytes = new Uint8Array(buffer); let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary); }
function renderAppointmentPreview(items = []) { $("#adminImportPreview").innerHTML = items.length ? `<table><thead><tr><th>Data</th><th>Paciente</th><th>Categoria</th><th>Profissional</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.patient)}</td><td>${escapeHtml(item.category || "—")}</td><td>${escapeHtml(item.professional)}</td></tr>`).join("")}</tbody></table>` : ""; }
function selectAppointmentFiles(files) { state.appointmentFiles = [...files].filter(file => /\.(xlsx|csv)$/i.test(file.name)); state.appointmentToken = null; $("#validateAppointments").disabled = true; $("#confirmAppointments").disabled = true; $("#adminImportResult").hidden = true; $("#adminImportFileInfo").textContent = state.appointmentFiles.length ? `${state.appointmentFiles.length} planilha(s) selecionada(s).` : "Nenhuma planilha encontrada."; $("#auditAppointments").disabled = !state.appointmentFiles.length; renderAppointmentPreview(); }
$("#selectImportFiles").addEventListener("click", () => $("#adminImportFile").click());
$("#selectImportFolder").addEventListener("click", () => $("#adminImportFolder").click());
$("#adminImportFile").addEventListener("change", event => selectAppointmentFiles(event.target.files || []));
$("#adminImportFolder").addEventListener("change", event => selectAppointmentFiles(event.target.files || []));
$("#auditAppointments").addEventListener("click", async () => { try { const files = await Promise.all(state.appointmentFiles.map(async file => ({name: file.name, data: await fileToBase64(file)}))); const data = await api("/api/admin/import/appointments/audit", {method:"POST", body: JSON.stringify({files})}); state.appointmentToken = data.token; renderAppointmentPreview(data.preview); $("#adminImportResult").hidden = false; $("#adminImportResult").classList.toggle("error", data.errors.length > 0); $("#adminImportResult").innerHTML = `<strong>Auditoria concluída</strong><br>${data.read} atendimentos válidos · ${data.consolidated} pacientes consolidados · ${data.duplicates_removed} duplicados removidos${data.errors.length ? `<br><br><strong>Itens bloqueados ou para revisão:</strong><br>${data.errors.map(escapeHtml).join("<br>")}` : ""}`; $("#validateAppointments").disabled = data.errors.length > 0 || !data.consolidated; } catch(error) { showToast(error.message, true); } });
$("#validateAppointments").addEventListener("click", async () => { try { const data = await api("/api/admin/import/appointments/validate", {method:"POST", body: JSON.stringify({token: state.appointmentToken})}); renderAppointmentPreview(data.preview); $("#adminImportResult").hidden = false; $("#adminImportResult").innerHTML = data.can_confirm ? `<strong>Validação concluída</strong><br>${data.total} pacientes prontos para importação.` : `<strong>Validação pendente</strong><br>Cadastre antes: ${data.missing_professionals.map(escapeHtml).join(", ")}.`; $("#confirmAppointments").disabled = !data.can_confirm; } catch(error) { showToast(error.message, true); } });
$("#confirmAppointments").addEventListener("click", async () => { if (!confirm("Confirmar a importação das carteiras validadas?")) return; try { const data = await api("/api/admin/import/appointments/confirm", {method:"POST", body: JSON.stringify({token: state.appointmentToken})}); $("#adminImportResult").hidden = false; $("#adminImportResult").innerHTML = `<strong>Importação concluída</strong><br>${data.imported} novos pacientes · ${data.updated} últimas consultas atualizadas · ${data.unchanged} registros ignorados por já estarem na mesma data ou em uma data mais recente.`; $("#confirmAppointments").disabled = true; await loadAdmin(); } catch(error) { showToast(error.message, true); } });
function renderSpecialImportPreview(target, items, columns) {
  $(target).innerHTML = items?.length ? `<table><thead><tr>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${items.map(item => `<tr>${columns.map(column => `<td>${escapeHtml(item[column.key] || "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";
}
async function encodedFiles(files) { return Promise.all([...files].map(async file => ({name:file.name, data:await fileToBase64(file)}))); }
$("#relationshipDirectoryFile").addEventListener("change", event => {
  state.relationshipDirectoryFiles = [...(event.target.files || [])]; state.relationshipDirectoryToken = null;
  $("#auditRelationshipDirectory").disabled = !state.relationshipDirectoryFiles.length; $("#confirmRelationshipDirectory").disabled = true;
  $("#relationshipDirectoryResult").hidden = true; renderSpecialImportPreview("#relationshipDirectoryPreview", [], []);
});
$("#auditRelationshipDirectory").addEventListener("click", async () => {
  try {
    const data = await api("/api/admin/import/relationship-directory/audit", {method:"POST", body:JSON.stringify({files:await encodedFiles(state.relationshipDirectoryFiles)})});
    state.relationshipDirectoryToken = data.token;
    renderSpecialImportPreview("#relationshipDirectoryPreview", data.preview, [{label:"Nome",key:"name"},{label:"Origem",key:"source"}]);
    $("#relationshipDirectoryResult").hidden = false;
    $("#relationshipDirectoryResult").innerHTML = `<strong>Auditoria concluída</strong><br>${data.valid} nomes únicos · ${data.duplicates_removed} duplicados removidos${data.errors.length ? ` · ${data.errors.map(escapeHtml).join("<br>")}` : ""}`;
    $("#confirmRelationshipDirectory").disabled = !data.valid || data.errors.length > 0;
  } catch(error) { showToast(error.message, true); }
});
$("#confirmRelationshipDirectory").addEventListener("click", async () => {
  if (!confirm("Confirmar estes nomes somente no catálogo de Vínculos?")) return;
  try {
    const data = await api("/api/admin/import/relationship-directory/confirm", {method:"POST", body:JSON.stringify({token:state.relationshipDirectoryToken})});
    $("#relationshipDirectoryResult").innerHTML = `<strong>Catálogo atualizado</strong><br>${data.inserted} novos nomes · ${data.updated} nomes atualizados. Nenhuma carteira foi alterada.`;
    $("#confirmRelationshipDirectory").disabled = true;
  } catch(error) { showToast(error.message, true); }
});
$("#scheduledPatientsFile").addEventListener("change", event => {
  state.scheduledPatientFiles = [...(event.target.files || [])]; state.scheduledPatientToken = null;
  $("#auditScheduledPatients").disabled = !state.scheduledPatientFiles.length; $("#validateScheduledPatients").disabled = true; $("#confirmScheduledPatients").disabled = true;
  $("#scheduledPatientsResult").hidden = true; renderSpecialImportPreview("#scheduledPatientsPreview", [], []);
});
$("#auditScheduledPatients").addEventListener("click", async () => {
  try {
    const data = await api("/api/admin/import/scheduled/audit", {method:"POST", body:JSON.stringify({files:await encodedFiles(state.scheduledPatientFiles)})});
    state.scheduledPatientToken = data.token;
    renderSpecialImportPreview("#scheduledPatientsPreview", data.preview, [{label:"Paciente",key:"patient"},{label:"Profissional",key:"professional"},{label:"Agendamento",key:"date"}]);
    $("#scheduledPatientsResult").hidden = false;
    $("#scheduledPatientsResult").innerHTML = `<strong>Auditoria concluída</strong><br>${data.scheduled} agendados · ${data.ignored} não agendados ignorados · ${data.duplicates_removed} duplicados removidos${data.errors.length ? ` · ${data.errors.map(escapeHtml).join("<br>")}` : ""}`;
    $("#validateScheduledPatients").disabled = !data.scheduled || data.errors.length > 0;
  } catch(error) { showToast(error.message, true); }
});
$("#validateScheduledPatients").addEventListener("click", async () => {
  try {
    const data = await api("/api/admin/import/scheduled/validate", {method:"POST", body:JSON.stringify({token:state.scheduledPatientToken})});
    renderSpecialImportPreview("#scheduledPatientsPreview", data.preview, [{label:"Paciente",key:"patient"},{label:"Profissional",key:"professional"},{label:"Data atual",key:"current_date"},{label:"Data da planilha",key:"date"},{label:"Decisão",key:"decision"}]);
    $("#scheduledPatientsResult").innerHTML = data.can_confirm ? `<strong>Validação concluída</strong><br>${data.matched} pacientes encontrados. Somente a próxima consulta será alterada.` : `<strong>Validação bloqueada</strong><br>${data.errors.map(escapeHtml).join("<br>")}`;
    $("#confirmScheduledPatients").disabled = !data.can_confirm;
  } catch(error) { showToast(error.message, true); }
});
$("#confirmScheduledPatients").addEventListener("click", async () => {
  if (!confirm("Atualizar somente a próxima consulta destes pacientes para Agendado?")) return;
  try {
    const data = await api("/api/admin/import/scheduled/confirm", {method:"POST", body:JSON.stringify({token:state.scheduledPatientToken})});
    $("#scheduledPatientsResult").innerHTML = `<strong>Agendamentos atualizados</strong><br>${data.updated} alterados · ${data.unchanged} já estavam iguais. Os demais campos foram preservados.`;
    $("#confirmScheduledPatients").disabled = true;
  } catch(error) { showToast(error.message, true); }
});
$("#refreshAudit").addEventListener("click", loadAudit);

async function initializeAdmin() {
  const response = await fetch('/api/auth/status');
  const auth = await response.json();
  if (!auth.authenticated) { location.replace('/login'); return; }
  if (!auth.user.two_factor_enabled && !auth.user.two_factor_exempt) { location.replace('/two-factor-setup'); return; }
  if (!auth.user.can_admin_portal) { location.replace('/'); return; }
  updateAccessRoleHelp();
  updateDate(); setInterval(updateDate, 60_000); await loadAdmin();
}
initializeAdmin().catch(error => showToast(error.message, true));
