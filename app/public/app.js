const state = { page: 1, perPage: 15, total: 0, search: "", status: "", month: "", nextSchedule: "", sort: "last_visit_asc", attention: "", selected: null, mode: "edit", catalog: [], actionTemplates: [], view: "dashboard", hiddenColumns: new Set(), patientLocked: false, patientLockReason: null, collaborationLock: null, collaborationLockTimer: null, patientRefreshBusy: false, journeyRecipient: false, healthDialogSnapshot: null, admin: null, adminTab: "overview", importRows: [], importValidated: false, currentUser: null, observationsExpanded: false, releasePatientId: null, forwardAfterSave: false, saveApproved: false, verifyAfterSave: false, completionMode: null, pendingForward: null, editingObservationId: null, editingJourneyProfessionalId: null };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const nextActionOptions = ["Profilaxia c/ Air Flow Criança", "Profilaxia c/ Air Flow Adulto", "Restauração", "Clareamento", "Estética Anterior", "Tratamento Ortodôntico", "Controle Ortodontia", "Programa Zero Cárie", "Controle Zero Cárie", "Cirurgia c/ Dr. Eduardo", "Planejamento", "Nova Etapa", "Reabilitação", "Niver"];

const formatDate = (value) => {
  if (!value) return "Sem agendamento";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const slug = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const currency = (cents = 0) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const elapsedTime = (value) => {
  const totalDays = Number(value);
  if (!Number.isFinite(totalDays) || totalDays < 0) return "—";
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  if (!months) return `${days} ${days === 1 ? "dia" : "dias"}`;
  const monthLabel = `${months} ${months === 1 ? "mês" : "meses"}`;
  return days ? `${monthLabel} e ${days} ${days === 1 ? "dia" : "dias"}` : monthLabel;
};
const returnStatus = (patient) => patient.is_scheduled ? (patient.next_appointment_type || "Agendado") : elapsedTime(patient.days_away);

function syncNextAppointmentType() {
  const hasDate = Boolean($("#fieldNextAppointment").value);
  $("#nextAppointmentTypeField").hidden = !hasDate;
  $("#fieldNextAppointmentType").required = hasDate;
  if (!hasDate) $("#fieldNextAppointmentType").value = "Agendado";
}
const monthLabel = (month) => {
  const [year, number] = month.split("-");
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${year}-${number}-01T00:00:00Z`));
  return label[0].toUpperCase() + label.slice(1);
};

function updateCurrentDate() {
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Cuiaba",
  }).format(new Date());
  $("#currentDate").textContent = label;
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZone: "America/Cuiaba" }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  if (state.view === "dashboard") $("#pageTitle").textContent = `${greeting}, ${state.currentUser?.name || 'Dra. Dulce'}.`;
}

const configurableColumns = ["last_visit", "days", "next_appointment", "procedures", "potential", "status", "actions"];

function loadColumnPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem("iea.patientTable.hiddenColumns") || "[]");
    state.hiddenColumns = new Set(saved.filter(column => configurableColumns.includes(column)));
  } catch { state.hiddenColumns = new Set(); }
  state.hiddenColumns.add("potential");
  $$('[data-column-toggle]').forEach(input => { input.checked = !state.hiddenColumns.has(input.dataset.columnToggle); });
  applyColumnVisibility();
}

function applyColumnVisibility() {
  configurableColumns.forEach(column => {
    $$(`[data-column="${column}"]`).forEach(element => element.classList.toggle("column-hidden", state.hiddenColumns.has(column)));
  });
}

function hasMasterPatientListAccess() {
  return state.currentUser?.role === "admin";
}

function configureMasterPatientColumn() {
  const visible = hasMasterPatientListAccess();
  $$('[data-master-column="responsible"]').forEach(element => { element.hidden = !visible; });
}

function visibleColumnCount() { return 8 - state.hiddenColumns.size + (hasMasterPatientListAccess() ? 1 : 0); }

function priority(patient) {
  if (patient.status === "Inativo") return { label: "Inativo", className: "inactive" };
  if (patient.is_scheduled) return { label: "Em dia", className: "regular" };
  if (patient.days_away >= 90) return { label: "Alta", className: "high" };
  if (patient.days_away >= 60) return { label: "Atenção", className: "medium" };
  return { label: "Em dia", className: "regular" };
}

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  $("#metricContact").textContent = data.need_contact;
  $("#metricUnscheduled").textContent = data.without_schedule;
  $("#metricTreatment").textContent = data.open_treatments;
  $("#metricInactive").textContent = data.inactive;
  $("#metricPotential").textContent = currency(data.potential_value_cents);
  $("#metricResolved").textContent = data.resolved_today;
}

async function loadCatalog() {
  const data = await api("/api/procedure-catalog");
  state.catalog = data.items;
  renderCatalog();
}

async function loadActionTemplates() {
  const data = await api("/api/action-templates");
  state.actionTemplates = data.items;
  renderNextActionChecklist($("#fieldNextAction").value);
}

function actionValues(value = "") {
  return String(value).split(" • ").map(item => item.trim()).filter(Boolean);
}

function renderNextActionChecklist(value = "") {
  const selected = new Set(actionValues(value));
  const options = [...new Set([...nextActionOptions, ...selected])];
  $("#fieldNextAction").value = value;
  $("#nextActionOptions").innerHTML = options.map(option => `<label><input class="next-action-option" type="checkbox" value="${escapeHtml(option)}" ${selected.has(option) ? "checked" : ""}><span>${escapeHtml(option)}</span></label>`).join("");
  $$(".next-action-option").forEach(option => option.addEventListener("change", syncNextActionValue));
  syncNextActionValue();
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Cuiaba" }).format(new Date(`${value.replace(" ", "T")}Z`));
}

function renderObservations(items = []) {
  const visible = state.observationsExpanded ? items : items.slice(0, 3);
  const canManage = (item) => !state.patientLocked && item.author_name === state.currentUser?.name;
  $("#observationHistory").innerHTML = visible.length ? visible.map(item => `<article class="observation-item"><time>${formatDateTime(item.created_at)}${item.author_name ? ` · ${escapeHtml(item.author_name)}` : ""}${item.updated_at ? " · editado" : ""}</time><p>${escapeHtml(item.note)}</p>${canManage(item) ? `<div class="observation-actions"><button type="button" data-edit-observation="${item.id}">Editar</button><button type="button" class="observation-delete" data-delete-observation="${item.id}">Excluir</button></div>` : ""}</article>`).join("") : `<p class="empty-observations">Nenhum retorno registrado.</p>`;
  const button = $("#showAllObservations");
  button.hidden = items.length <= 3;
  button.textContent = state.observationsExpanded ? "Ver menos" : `Ver mais (${items.length - 3})`;
  $$('[data-edit-observation]').forEach(button => button.addEventListener("click", () => openObservationEdit(Number(button.dataset.editObservation))));
  $$('[data-delete-observation]').forEach(button => button.addEventListener("click", () => deleteObservation(Number(button.dataset.deleteObservation))));
}

function openObservationEdit(observationId) {
  const note = state.selected?.observations?.find(item => Number(item.id) === observationId);
  if (!note) return;
  state.editingObservationId = observationId;
  $("#observationEditText").value = note.note || "";
  $("#observationEditDialog").showModal();
  $("#observationEditText").focus();
}

async function deleteObservation(observationId) {
  if (!state.selected?.id || !window.confirm("Excluir esta observação do histórico? Esta ação não pode ser desfeita.")) return;
  try {
    const updated = await api(`/api/patients/${state.selected.id}/observations/${observationId}`, { method: "DELETE" });
    state.selected = updated;
    renderObservations(updated.observations || []);
    showToast("Observação excluída do histórico.");
  } catch (error) { showToast(error.message, true); }
}

function renderPatientJourney(items = []) {
  const container = $("#patientJourney");
  const list = $("#patientJourneyList");
  const shared = items.filter(item => !item.is_primary || item.origin_professional_id);
  container.hidden = shared.length === 0;
  const currentProfessionalId = Number(state.currentUser?.portfolio_professional_id || state.currentUser?.professional_id);
  list.innerHTML = items.map(item => {
    const canManage = !item.is_primary && Number(item.origin_professional_id) === currentProfessionalId;
    return `<article class="journey-person ${item.is_primary ? "journey-primary" : ""}"><strong>${escapeHtml(item.name)}</strong><small>${item.is_primary ? "Responsável principal" : `${escapeHtml(item.stage_status || "Aguardando início")} · ${item.days_shared ?? 0} dias`}</small>${item.forward_reason ? `<em>Motivo: ${escapeHtml(item.forward_reason)}</em>` : ""}${item.stage_note ? `<em>${escapeHtml(item.stage_note)}</em>` : ""}${canManage ? `<div class="journey-person-actions"><button type="button" data-edit-journey="${item.professional_id}" data-journey-reason="${escapeHtml(item.forward_reason || "")}">Editar</button><button type="button" class="journey-delete" data-delete-journey="${item.professional_id}">Excluir</button></div>` : ""}</article>`;
  }).join("");
  $$('[data-edit-journey]', list).forEach(button => button.addEventListener('click', () => {
    state.editingJourneyProfessionalId = Number(button.dataset.editJourney);
    $('#journeyEditReason').value = button.dataset.journeyReason || '';
    $('#journeyEditDialog').showModal();
    $('#journeyEditReason').focus();
  }));
  $$('[data-delete-journey]', list).forEach(button => button.addEventListener('click', async () => {
    if (!state.selected?.id || !window.confirm('Excluir este encaminhamento da jornada? O registro continuará preservado na auditoria.')) return;
    try {
      const updated = await api(`/api/patients/${state.selected.id}/journey/${button.dataset.deleteJourney}`, { method: 'DELETE' });
      state.selected = updated;
      renderPatientJourney(updated.journey || []);
      configureJourneyStage(updated);
      showToast('Encaminhamento excluído da jornada.');
    } catch (error) { showToast(error.message, true); }
  }));
}

function openReleaseDialog(patientId) {
  state.releasePatientId = Number(patientId);
  if (!state.releasePatientId) return;
  $('#releasePassword').value = '';
  $('#releaseDialog').showModal();
  setTimeout(() => $('#releasePassword').focus(), 0);
}

function configureJourneyStage(patient) {
  const portfolioProfessionalId=Number(state.currentUser?.portfolio_professional_id || state.currentUser?.professional_id);
  const own = (patient.journey || []).find(item => !item.is_primary && Number(item.professional_id) === portfolioProfessionalId);
  const shared = (patient.journey || []).some(item => !item.is_primary);
  state.sharedJourney = shared;
  state.journeyRecipient = Boolean(own);
  $("#journeyStageEditor").hidden = !own;
  if (own) {
    $("#journeyStageStatus").value = own.stage_status === "Concluído" ? "Concluído" : "Em atendimento";
    $("#journeyStageNote").value = own.stage_note || "";
    $("#journeyStageTitle").textContent = own.stage_note ? "Atualizar minha evolução" : "Criar meu prontuário na jornada";
  }
  if (!own) return;
  $("#patientForm").querySelectorAll("input:not([type=hidden]), select, textarea").forEach(field => {
    if (!field.closest("#journeyStageEditor")) field.disabled = true;
  });
  ["#addProcedure", "#addRelationship", "#savePatient", "#deletePatient"].forEach(selector => $(selector).hidden = true);
  $("#saveAndForward").hidden = false;
  $("#saveAndForward").disabled = false;
}

function syncNextActionValue() {
  const selected = $$(".next-action-option:checked").map(option => option.value);
  $("#fieldNextAction").value = selected.join(" • ");
  $("#nextActionSummary").textContent = selected.length ? selected.join(" • ") : "Selecione uma ou mais ações";
}

function syncNiverFromStatus() {
  const selected = new Set(actionValues($("#fieldNextAction").value));
  if ($("#fieldStatus").value === "Inativo") selected.add("Niver");
  else selected.delete("Niver");
  renderNextActionChecklist([...selected].join(" • "));
}

async function loadFilters() {
  const data = await api("/api/filters");
  $("#monthFilter").innerHTML = `<option value="">Todos</option>${data.months.map(month => `<option value="${month}">${monthLabel(month)}</option>`).join("")}`;
  const statusOptions = (data.statuses || ["Consulta", "Controle", "Tratamento", "Inativo"]);
  $("#statusFilter").innerHTML = `<option value="">Todos</option>${statusOptions.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("")}`;
  $("#statusFilter").value = state.status;
  const currentStatus = $("#fieldStatus").value || "Consulta";
  $("#fieldStatus").innerHTML = statusOptions.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
  $("#fieldStatus").value = statusOptions.includes(currentStatus) ? currentStatus : "Consulta";
}

function renderPatients(items) {
  const tbody = $("#patientsTable");
  if (!items.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="${visibleColumnCount()}">Nenhum paciente encontrado com estes filtros.</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(patient => {
    const risk = priority(patient);
    return `<tr class="patient-row ${patient.is_resolved_today ? "patient-resolved" : ""} ${patient.edit_lock_user_id ? "patient-being-edited" : ""}" data-open-patient-id="${patient.id}" tabindex="0" aria-label="Abrir ficha de ${escapeHtml(patient.name)}">
      <td><div class="patient-cell"><span class="priority-dot ${risk.className}" title="${risk.label}"></span><span class="patient-initials">${escapeHtml(initials(patient.name))}</span><div><strong title="${escapeHtml(patient.name)}">${escapeHtml(patient.name)}${patient.has_health_change ? `<img class="table-health-seal" src="/assets/health-alert-seal-3d.png" alt="Alerta de saúde" title="Paciente com alteração de saúde">` : ""}</strong>${hasMasterPatientListAccess() ? "" : `<small>${escapeHtml(patient.professional)}</small>`}</div></div></td>
      ${hasMasterPatientListAccess() ? `<td class="responsible-cell" title="${escapeHtml(patient.professional || "Não definido")}"><strong>${escapeHtml(patient.professional || "Não definido")}</strong></td>` : ""}
      <td data-column="last_visit">${formatDate(patient.last_visit)}</td>
      <td data-column="days"><span class="days-count ${patient.is_scheduled ? "is-scheduled" : ""}">${returnStatus(patient)}</span></td>
      <td data-column="next_appointment" class="${patient.next_appointment ? "" : "muted"}">${formatDate(patient.next_appointment)}</td>
      <td data-column="procedures" class="${patient.procedure_summary ? "" : "muted"}" title="${escapeHtml(patient.procedure_summary || "")}">${patient.procedure_count ? `${patient.procedure_count} · ${escapeHtml(patient.procedure_summary || "")}` : "Não informado"}</td>
      <td data-column="potential"><span class="money-value">${currency(patient.potential_value_cents)}</span></td>
      <td data-column="status"><span class="status-badge status-${slug(patient.status)}">${escapeHtml(patient.status)}</span></td>
      <td data-column="actions"><div class="row-actions">${patient.is_resolved_today ? `<span class="verified-label">Verificado</span><button class="resolved-lock" type="button" data-release-patient-id="${patient.id}" title="Liberar ficha para alteração" aria-label="Liberar ficha de ${escapeHtml(patient.name)}">🔒</button>` : `<button class="resolve-check" type="button" data-resolve-id="${patient.id}" data-resolved="0" aria-label="Marcar como resolvido ${escapeHtml(patient.name)}"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></button>`}<button class="row-action" type="button" data-patient-id="${patient.id}" aria-label="${patient.is_resolved_today ? "Ver ficha bloqueada de" : "Abrir ficha de"} ${escapeHtml(patient.name)}">→</button></div></td>
    </tr>`;
  }).join("");
  items.filter(patient => patient.edit_lock_user_id).forEach(patient => {
    const row = tbody.querySelector(`[data-open-patient-id="${patient.id}"]`);
    const details = row?.querySelector(".patient-cell > div");
    if (!details) return;
    const presence = document.createElement("small");
    presence.className = "patient-editing-presence";
    presence.textContent = Number(patient.edit_lock_user_id) === Number(state.currentUser?.id)
      ? "Você está atendendo"
      : `Em atendimento por ${patient.edit_lock_user_name}`;
    details.appendChild(presence);
  });
  $$('[data-patient-id]').forEach(button => button.addEventListener("click", () => openPatient(button.dataset.patientId)));
  $$('[data-release-patient-id]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    openReleaseDialog(button.dataset.releasePatientId);
  }));
  $$('[data-resolve-id]').forEach(button => button.addEventListener("click", () => toggleResolved(button)));
  $$('[data-open-patient-id]').forEach(row => {
    row.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      openPatient(row.dataset.openPatientId);
    });
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPatient(row.dataset.openPatientId); }
    });
  });
  applyColumnVisibility();
}

async function toggleResolved(button) {
  const resolved = button.dataset.resolved !== "1";
  try {
    await api(`/api/patients/${button.dataset.resolveId}/resolve`, { method: "POST", body: JSON.stringify({ resolved }) });
    showToast(resolved ? "Paciente marcado como verificado hoje." : "Paciente reaberto para acompanhamento.");
    await Promise.all([loadDashboard(), loadPatients(), loadDailyLog()]);
  } catch (error) { showToast(error.message, true); }
}

function stopPatientLockHeartbeat() {
  if (state.collaborationLockTimer) clearInterval(state.collaborationLockTimer);
  state.collaborationLockTimer = null;
}

async function releasePatientEditLock({ silent = true } = {}) {
  stopPatientLockHeartbeat();
  const patientId = state.collaborationLock?.patientId;
  state.collaborationLock = null;
  if (!patientId) return;
  try {
    await api(`/api/patients/${patientId}/edit-lock`, { method: "DELETE" });
  } catch (error) {
    if (!silent) showToast(error.message, true);
  }
}

function startPatientLockHeartbeat(patientId) {
  stopPatientLockHeartbeat();
  state.collaborationLockTimer = setInterval(async () => {
    if (!state.collaborationLock || Number(state.collaborationLock.patientId) !== Number(patientId)) return;
    try {
      const lock = await api(`/api/patients/${patientId}/edit-lock`, { method: "POST" });
      if (!lock.acquired) {
        state.collaborationLock = null;
        stopPatientLockHeartbeat();
        setPatientLocked(true, { reason: "collaboration", lockedBy: lock.locked_by });
        showToast(`O prontuário passou a ser atendido por ${lock.locked_by}.`, true);
      }
    } catch (error) {
      console.warn("Não foi possível renovar a reserva do prontuário.", error);
    }
  }, 30_000);
}

async function loadPatients({ silent = false } = {}) {
  if (!silent) $("#patientsTable").innerHTML = `<tr class="loading-row"><td colspan="${visibleColumnCount()}"><span class="loader"></span> Atualizando carteira...</td></tr>`;
  const params = new URLSearchParams({ page: state.page, per_page: state.perPage });
  if (state.search) params.set("search", state.search);
  if (state.status) params.set("status", state.status);
  if (state.month) params.set("month", state.month);
  if (state.nextSchedule) params.set("next_schedule", state.nextSchedule);
  if (state.sort) params.set("sort", state.sort);
  if (state.attention) params.set("attention", state.attention);
  const data = await api(`/api/patients?${params}`);
  state.total = data.total;
  renderPatients(data.items);
  const start = data.total ? (state.page - 1) * state.perPage + 1 : 0;
  const end = Math.min(state.page * state.perPage, data.total);
  $("#resultCount").textContent = data.total;
  $("#pageInfo").textContent = data.total ? `${start}–${end} de ${data.total}` : "Nenhum resultado";
  $("#prevPage").disabled = state.page === 1;
  $("#nextPage").disabled = end >= data.total;
}

async function openPatient(id) {
  if (state.collaborationLock && Number(state.collaborationLock.patientId) !== Number(id)) {
    await releasePatientEditLock();
  }
  const patient = await api(`/api/patients/${id}`);
  let collaboration = null;
  if (!patient.is_resolved_today) {
    collaboration = await api(`/api/patients/${id}/edit-lock`, { method: "POST" });
    if (collaboration.acquired) {
      state.collaborationLock = { patientId: Number(id), ...collaboration };
      startPatientLockHeartbeat(id);
    } else {
      state.collaborationLock = null;
      stopPatientLockHeartbeat();
    }
  }
  state.mode = "edit";
  state.selected = patient;
  $("#patientId").value = patient.id;
  $("#drawerAvatar").textContent = initials(patient.name);
  $("#drawerName").textContent = patient.name;
  $("#drawerEyebrow").textContent = "Ficha do paciente";
  $("#drawerProfessional").textContent = `Carteira da ${patient.professional}`;
  $("#drawerLastVisit").textContent = formatDate(patient.last_visit);
  $("#drawerDays").textContent = returnStatus(patient);
  $("#drawerNextDisplay").textContent = formatDate(patient.next_appointment);
  $("#fieldStatus").value = patient.status;
  $("#fieldName").value = patient.name;
  $("#fieldLastVisit").value = patient.last_visit || "";
  $("#fieldNextAppointment").value = patient.next_appointment || "";
  $("#fieldNextAppointmentType").value = patient.next_appointment_type || "Agendado";
  syncNextAppointmentType();
  renderNextActionChecklist(patient.next_action || "");
  syncNiverFromStatus();
  state.observationsExpanded = false;
  $("#fieldObservation").value = "";
  renderObservations(patient.observations || []);
  renderPatientJourney(patient.journey || []);
  $("#fieldPhone").value = patient.phone || "";
  $("#fieldLastContact").value = patient.last_contact || "";
  $("#fieldReference").value = patient.reference || "";
  $("#fieldNotes").value = patient.notes || "";
  $("#fieldHealthChange").value = patient.health_change ? "1" : "0";
  $("#fieldHealthCondition").value = patient.health_condition || "";
  $("#fieldHealthCare").value = patient.health_care || "";
  renderProcedureFields(patient.procedures || []);
  renderRelationships(patient.relationships || []);
  updateHealthSeal();
  $("#identityEditor").hidden = true;
  $("#fieldName").readOnly = true;
  resetDeletePatientButton();
  $("#savePatient").hidden = false;
  $("#saveAndForward").hidden = false;
  $("#addRelationship").hidden = false;
  $("#deletePatient").hidden = !["owner", "professional", "asb", "admin"].includes(state.currentUser?.role);
  setPatientLocked(Boolean(patient.is_resolved_today) || Boolean(collaboration && !collaboration.acquired), {
    reason: patient.is_resolved_today ? "verified" : (collaboration && !collaboration.acquired ? "collaboration" : null),
    lockedBy: collaboration?.locked_by,
  });
  if (collaboration && !collaboration.acquired) {
    showToast(`Em atendimento por ${collaboration.locked_by}. A ficha foi aberta somente para consulta.`, true);
  }
  configureJourneyStage(patient);
  openDrawer();
}

function setPatientLocked(locked, options = {}) {
  state.patientLocked = locked;
  state.patientLockReason = locked ? (options.reason || "verified") : null;
  const drawer = $("#patientDrawer");
  drawer.classList.toggle("is-locked", locked);
  const banner = $("#lockedBanner");
  banner.hidden = !locked;
  banner.classList.toggle("collaboration-lock", state.patientLockReason === "collaboration");
  const bannerTitle = banner.querySelector("strong");
  const bannerInfo = banner.querySelector("small");
  if (state.patientLockReason === "collaboration") {
    bannerTitle.textContent = `Em atendimento por ${options.lockedBy || "outro usuário"}`;
    bannerInfo.textContent = "A ficha está temporariamente protegida. Você pode consultar, mas não alterar enquanto o atendimento estiver aberto.";
  } else {
    bannerTitle.textContent = "Paciente verificado";
    bannerInfo.textContent = "Ficha bloqueada. Para liberar uma alteração, use Verificados e confirme sua senha.";
  }
  $("#patientForm").querySelectorAll("input:not([type=hidden]), select, textarea").forEach(field => field.disabled = locked);
  $("#addProcedure").disabled = locked;
  $("#savePatient").disabled = locked;
  $("#saveAndForward").disabled = locked;
  $("#deletePatient").disabled = locked;
  $("#addRelationship").disabled = locked;
  $("#fieldHealthCondition").disabled = locked;
  $("#fieldHealthCare").disabled = locked;
  $("#applyHealthDialog").hidden = locked;
  $$(".remove-procedure").forEach(button => button.disabled = locked);
  if (locked && state.patientLockReason === "verified" && ["owner", "professional", "asb"].includes(state.currentUser?.role)) {
    $("#saveAndForward").disabled = false;
  }
  $$(".remove-relationship").forEach(button => button.disabled = locked);
  const crcProtected = !state.currentUser?.permissions?.crc_fields;
  $$("#procedureSection input, #procedureSection select, #procedureSection button, #contactSection input").forEach(field => field.disabled = locked || crcProtected);
}

function openDrawer() {
  $("#patientDrawer").classList.add("open");
  $("#patientDrawer").setAttribute("aria-hidden", "false");
  $("#drawerBackdrop").classList.add("open");
  document.body.style.overflow = "hidden";
}

function openNewPatient() {
  releasePatientEditLock();
  state.mode = "create";
  state.selected = null;
  $("#patientForm").reset();
  $("#patientId").value = "";
  $("#drawerAvatar").textContent = "＋";
  $("#drawerEyebrow").textContent = "Novo cadastro";
  $("#drawerName").textContent = "Novo paciente";
  $("#drawerProfessional").textContent = `Carteira de ${state.currentUser?.name || "profissional"}`;
  $("#drawerLastVisit").textContent = "A informar";
  $("#drawerDays").textContent = "—";
  $("#drawerNextDisplay").textContent = "Sem agendamento";
  $("#fieldStatus").value = "Consulta";
  $("#fieldNextAppointmentType").value = "Agendado";
  syncNextAppointmentType();
  renderNextActionChecklist("");
  state.observationsExpanded = false;
  $("#fieldObservation").value = "";
  renderObservations([]);
  $("#fieldHealthChange").value = "0";
  $("#fieldHealthCondition").value = "";
  $("#fieldHealthCare").value = "";
  renderProcedureFields([]);
  renderRelationships([]);
  updateHealthSeal();
  $("#identityEditor").hidden = false;
  $("#fieldName").readOnly = false;
  resetDeletePatientButton();
  $("#deletePatient").hidden = true;
  setPatientLocked(false);
  openDrawer();
  $("#fieldName").focus();
}

function procedureTemplate(item = {}) {
  const match = state.catalog.find(entry => entry.active && entry.name.toLocaleLowerCase("pt-BR") === String(item.name || "").toLocaleLowerCase("pt-BR"));
  const selectedValue = match ? String(match.id) : (item.name ? "__manual__" : "");
  const options = state.catalog.filter(entry => entry.active).map(entry => `<option value="${entry.id}" data-value="${entry.default_value_cents}" ${String(entry.id) === selectedValue ? "selected" : ""}>${escapeHtml(entry.name)}</option>`).join("");
  return `<div class="procedure-row">
    <label>Procedimento<select class="procedure-catalog"><option value="">Selecione...</option>${options}<option value="__manual__" ${selectedValue === "__manual__" ? "selected" : ""}>Outro / personalizado</option></select><input class="procedure-name manual-name" type="text" value="${escapeHtml(item.name || "")}" placeholder="Digite o procedimento" ${selectedValue === "__manual__" ? "" : "hidden"}></label>
    <label>Valor (R$)<input class="procedure-value" type="text" inputmode="decimal" value="${item.value_cents ? (item.value_cents / 100).toFixed(2).replace(".", ",") : ""}" placeholder="0,00"></label>
    <label>Desconto (R$)<input class="procedure-discount" type="text" inputmode="decimal" value="${item.discount_cents ? (item.discount_cents / 100).toFixed(2).replace(".", ",") : ""}" placeholder="0,00"></label>
    <label>Etapa<select class="procedure-stage"><option>Indicado</option><option>Aprovado</option><option>Agendado</option><option>Em andamento</option><option>Concluído</option></select></label>
    <button class="remove-procedure" type="button" aria-label="Remover procedimento">×</button>
  </div>`;
}

function renderProcedureFields(items) {
  $("#procedureList").innerHTML = items.map(procedureTemplate).join("");
  items.forEach((item, index) => {
    const rows = $$(".procedure-row");
    if (rows[index]) rows[index].querySelector(".procedure-stage").value = item.stage || "Indicado";
  });
  bindProcedureRows();
  updateProcedureTotal();
}

function bindProcedureRows() {
  $$(".remove-procedure").forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = "1";
    button.addEventListener("click", () => { button.closest(".procedure-row")?.remove(); updateProcedureTotal(); });
  });
  $$(".procedure-value, .procedure-discount, .procedure-stage").forEach(field => {
    if (field.dataset.bound) return;
    field.dataset.bound = "1";
    field.addEventListener("input", updateProcedureTotal);
  });
  $$(".procedure-catalog").forEach(select => {
    if (select.dataset.bound) return;
    select.dataset.bound = "1";
    select.addEventListener("change", () => {
    const row = select.closest(".procedure-row");
    const nameInput = row.querySelector(".procedure-name");
    const valueInput = row.querySelector(".procedure-value");
    if (select.value === "__manual__") {
      nameInput.hidden = false;
      nameInput.value = "";
      nameInput.focus();
    } else if (select.value) {
      const item = state.catalog.find(entry => String(entry.id) === select.value);
      nameInput.hidden = true;
      nameInput.value = item?.name || "";
      valueInput.value = item?.default_value_cents ? (item.default_value_cents / 100).toFixed(2).replace(".", ",") : "";
    } else {
      nameInput.hidden = true;
      nameInput.value = "";
    }
    updateProcedureTotal();
    });
  });
  $("#emptyProcedures").hidden = $$(".procedure-row").length > 0;
}

function parseMoney(value) {
  const normalized = String(value || "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(Math.max(0, number) * 100) : 0;
}

function collectProcedures() {
  return $$(".procedure-row").map(row => ({
    name: row.querySelector(".procedure-name").value.trim(),
    value_cents: parseMoney(row.querySelector(".procedure-value").value),
    discount_cents: parseMoney(row.querySelector(".procedure-discount").value),
    stage: row.querySelector(".procedure-stage").value,
  })).filter(item => item.name);
}

function updateProcedureTotal() {
  const total = collectProcedures().filter(item => item.stage !== "Concluído").reduce((sum, item) => sum + Math.max(0, item.value_cents - item.discount_cents), 0);
  $("#procedureTotal").textContent = currency(total);
  $("#emptyProcedures").hidden = $$(".procedure-row").length > 0;
}

function relationshipTemplate(item = {}) {
  return `<div class="relationship-row">
    <label>Vínculo<input class="relationship-type" type="text" list="relationshipTypes" value="${escapeHtml(item.relationship_type || "")}" placeholder="Ex.: Mãe"></label>
    <label class="relationship-name-search">Nome<input class="relationship-name" type="text" autocomplete="off" value="${escapeHtml(item.related_name || "")}" placeholder="Digite para pesquisar"><div class="relationship-suggestions" hidden></div></label>
    <button class="remove-relationship" type="button" aria-label="Remover vínculo">×</button>
  </div>`;
}

function renderRelationships(items) {
  $("#relationshipList").innerHTML = items.map(relationshipTemplate).join("");
  bindRelationshipRows();
}

function bindRelationshipRows() {
  $$(".relationship-name").forEach(input => {
    if (input.dataset.searchBound) return;
    input.dataset.searchBound = "1";
    let timer = null;
    const suggestions = input.parentElement.querySelector(".relationship-suggestions");
    const close = () => { suggestions.hidden = true; suggestions.innerHTML = ""; };
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const search = input.value.trim();
      if (search.length < 2) return close();
      timer = setTimeout(async () => {
        try {
          const data = await api(`/api/relationship-directory?search=${encodeURIComponent(search)}&limit=8`);
          suggestions.innerHTML = data.items.length
            ? data.items.map(item => `<button class="relationship-suggestion" type="button" data-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`).join("")
            : `<div class="relationship-suggestion-empty">Nenhum nome encontrado</div>`;
          suggestions.hidden = false;
          suggestions.querySelectorAll(".relationship-suggestion").forEach(button => button.addEventListener("mousedown", event => {
            event.preventDefault(); input.value = button.dataset.name; close(); input.focus();
          }));
        } catch (_) { close(); }
      }, 180);
    });
    input.addEventListener("keydown", event => {
      const options = [...suggestions.querySelectorAll(".relationship-suggestion")];
      if (!options.length || suggestions.hidden) return;
      let index = options.findIndex(option => option.classList.contains("active"));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); options.forEach(option => option.classList.remove("active"));
        index = event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1);
        options[index].classList.add("active"); options[index].scrollIntoView({block:"nearest"});
      } else if (event.key === "Enter" && index >= 0) {
        event.preventDefault(); input.value = options[index].dataset.name; close();
      } else if (event.key === "Escape") close();
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
  });
  $$(".remove-relationship").forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      button.closest(".relationship-row")?.remove();
      $("#emptyRelationships").hidden = $$(".relationship-row").length > 0;
    });
  });
  $("#emptyRelationships").hidden = $$(".relationship-row").length > 0;
}

function collectRelationships() {
  return $$(".relationship-row").map(row => ({
    relationship_type: row.querySelector(".relationship-type").value.trim(),
    related_name: row.querySelector(".relationship-name").value.trim(),
  })).filter(item => item.relationship_type || item.related_name);
}

function updateHealthSeal() {
  const active = $("#fieldHealthChange").value === "1";
  $("#headerHealthSeal").hidden = !active;
  const condition = $("#fieldHealthCondition").value.trim();
  $("#headerHealthSeal").title = condition || "Paciente com alerta de saúde";
  $("#headerHealthSeal").setAttribute("aria-label", condition ? `Alerta de saúde: ${condition}` : "Abrir alerta de saúde");
}

function openHealthDialog() {
  state.healthDialogSnapshot = {
    condition: $("#fieldHealthCondition").value,
    care: $("#fieldHealthCare").value,
  };
  $("#healthDialog").showModal();
}

function closeHealthDialog(restore = false) {
  if (restore && state.healthDialogSnapshot) {
    $("#fieldHealthCondition").value = state.healthDialogSnapshot.condition;
    $("#fieldHealthCare").value = state.healthDialogSnapshot.care;
  }
  state.healthDialogSnapshot = null;
  $("#healthDialog").close();
  updateHealthSeal();
}

function renderCatalog() {
  const tbody = $("#catalogTable");
  $("#catalogCount").textContent = `${state.catalog.length} ${state.catalog.length === 1 ? "item" : "itens"}`;
  if (!state.catalog.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="4">Nenhum procedimento cadastrado. Use o formulário ao lado para começar.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.catalog.map(item => `<tr data-catalog-row="${item.id}">
    <td><input class="catalog-name" value="${escapeHtml(item.name)}" aria-label="Nome de ${escapeHtml(item.name)}" disabled></td>
    <td><input class="catalog-value" inputmode="decimal" value="${(item.default_value_cents / 100).toFixed(2).replace(".", ",")}" aria-label="Valor de ${escapeHtml(item.name)}" disabled></td>
    <td><label class="catalog-active"><input class="catalog-enabled" type="checkbox" ${item.active ? "checked" : ""} disabled> <span>${item.active ? "Ativo" : "Inativo"}</span></label></td>
    <td><div class="catalog-row-actions"><button class="catalog-edit" type="button" data-edit-catalog="${item.id}">Editar</button><button class="catalog-delete" type="button" data-delete-catalog="${item.id}">Excluir</button></div></td>
  </tr>`).join("");
  $$('[data-edit-catalog]').forEach(button => button.addEventListener("click", () => toggleCatalogEdit(button)));
  $$('[data-delete-catalog]').forEach(button => button.addEventListener("click", () => deleteCatalogRow(button)));
  $$(".catalog-enabled").forEach(input => input.addEventListener("change", () => { input.parentElement.querySelector("span").textContent = input.checked ? "Ativo" : "Inativo"; }));
}

function toggleCatalogEdit(button) {
  const row = $(`[data-catalog-row="${button.dataset.editCatalog}"]`);
  const editing = button.dataset.editing === "1";
  if (editing) return saveCatalogRow(button.dataset.editCatalog);
  row.querySelectorAll("input").forEach(input => input.disabled = false);
  button.dataset.editing = "1";
  button.textContent = "Salvar";
  row.querySelector(".catalog-name").focus();
}

async function deleteCatalogRow(button) {
  if (button.dataset.confirming !== "1") {
    button.dataset.confirming = "1";
    button.classList.add("confirming");
    button.textContent = "Confirmar";
    setTimeout(() => {
      if (!button.isConnected) return;
      button.dataset.confirming = "0";
      button.classList.remove("confirming");
      button.textContent = "Excluir";
    }, 4000);
    return;
  }
  try {
    await api(`/api/procedure-catalog/${button.dataset.deleteCatalog}`, { method: "DELETE" });
    await loadCatalog();
    showToast("Procedimento excluído do catálogo.");
  } catch (error) { showToast(error.message, true); }
}

async function saveCatalogRow(id) {
  const row = $(`[data-catalog-row="${id}"]`);
  const payload = {
    name: row.querySelector(".catalog-name").value.trim(),
    default_value_cents: parseMoney(row.querySelector(".catalog-value").value),
    active: row.querySelector(".catalog-enabled").checked,
  };
  try { await api(`/api/procedure-catalog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); await loadCatalog(); showToast("Procedimento atualizado."); }
  catch (error) { showToast(error.message, true); }
}

async function loadAdmin() {
  state.admin = await api("/api/admin");
  renderAdmin();
}

function renderAdmin() {
  const data = state.admin;
  if (!data) return;
  $("#adminPatients").textContent = data.summary.patients;
  $("#adminProfessionals").textContent = data.summary.professionals;
  $("#adminAccesses").textContent = data.summary.active_accesses;
  $("#adminPotential").textContent = currency(data.summary.potential_value_cents);
  $("#adminOfficeCount").textContent = data.summary.offices;
  $("#adminSpecialtyCount").textContent = data.summary.specialties;
  $("#adminUnassigned").textContent = data.summary.unassigned;
  $("#adminProfessionalCount").textContent = `${data.professionals.length} cadastrados`;
  $("#adminTeamOverview").innerHTML = data.professionals.slice(0, 5).map(item => `<div class="admin-overview-item"><span class="admin-overview-avatar">${escapeHtml(initials(item.name))}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.specialties || item.role || "Sem especialidade")}</small></div><span>${item.patient_count} pacientes</span></div>`).join("");
  $("#adminOfficeOverview").innerHTML = data.offices.map(item => `<div class="admin-overview-item"><span class="admin-overview-avatar">${escapeHtml(String(item.name).replace(/\D/g, "").slice(-2) || "IEA")}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.responsibles || "Sem responsável definido")}</small></div><span>${item.professional_count} profissionais</span></div>`).join("");
  $("#adminProfessionalsTable").innerHTML = data.professionals.map(item => `<tr><td><div class="admin-person"><strong>${escapeHtml(item.name)}${item.is_owner ? " · Proprietária" : ""}</strong><small>${escapeHtml(item.email || "Sem e-mail")}</small></div></td><td>${escapeHtml(item.specialties || "Não definida")}</td><td>${escapeHtml(item.offices || "Não definido")}</td><td>${item.patient_count} pacientes</td><td><span class="access-badge ${item.access_active ? "" : "off"}">${item.access_active ? "Ativo" : "Bloqueado"}</span></td><td><button class="admin-edit-button" type="button" data-edit-professional="${item.id}">Editar</button></td></tr>`).join("");
  $("#adminSpecialtiesList").innerHTML = data.specialties.map(item => `<div class="admin-master-item"><div><strong>${escapeHtml(item.name)}</strong><small>${item.professional_count} profissionais vinculados</small></div><span>${item.active ? "Ativa" : "Off"}</span></div>`).join("");
  $("#adminOfficesList").innerHTML = data.offices.map(item => `<div class="admin-master-item"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.responsibles || "Sem responsável")} · ${item.professional_count} profissionais</small></div><span>${item.active ? "Ativo" : "Off"}</span></div>`).join("");
  const specialtyValue = $("#adminProfessionalSpecialty").value;
  const officeValue = $("#adminProfessionalOffice").value;
  $("#adminProfessionalSpecialty").innerHTML = `<option value="">Selecione</option>${data.specialties.filter(item => item.active).map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  $("#adminProfessionalOffice").innerHTML = `<option value="">Selecione</option>${data.offices.filter(item => item.active).map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
  if (specialtyValue) $("#adminProfessionalSpecialty").value = specialtyValue;
  if (officeValue) $("#adminProfessionalOffice").value = officeValue;
  $$('[data-edit-professional]').forEach(button => button.addEventListener("click", () => editAdminProfessional(button.dataset.editProfessional)));
}

function setAdminTab(tab) {
  state.adminTab = tab;
  $$('[data-admin-tab]').forEach(button => button.classList.toggle("active", button.dataset.adminTab === tab));
  $$('[data-admin-panel]').forEach(panel => { panel.hidden = panel.dataset.adminPanel !== tab; });
  if (tab === "audit") loadAdminAudit();
}

function resetAdminProfessionalForm() {
  $("#adminProfessionalForm").reset();
  $("#adminProfessionalId").value = "";
  $("#adminProfessionalActive").checked = true;
  $("#adminProfessionalFormTitle").textContent = "Novo profissional";
  $("#cancelProfessionalEdit").hidden = true;
}

function editAdminProfessional(id) {
  const item = state.admin?.professionals.find(professional => String(professional.id) === String(id));
  if (!item) return;
  $("#adminProfessionalId").value = item.id;
  $("#adminProfessionalName").value = item.name;
  $("#adminProfessionalEmail").value = item.email || "";
  $("#adminAccessRole").value = item.access_role || "professional";
  $("#adminProfessionalSpecialty").value = item.specialty_id || "";
  $("#adminProfessionalOffice").value = item.office_id || "";
  $("#adminOfficeResponsible").checked = Boolean(item.office_responsible);
  $("#adminProfessionalActive").checked = Boolean(item.active);
  $("#adminProfessionalFormTitle").textContent = "Editar profissional";
  $("#cancelProfessionalEdit").hidden = false;
  $("#adminProfessionalForm").scrollIntoView({behavior: "smooth", block: "start"});
}

async function loadAdminAudit() {
  const data = await api("/api/admin/audit?limit=100");
  $("#adminAuditTable").innerHTML = data.items.length ? data.items.map(item => `<tr><td>${escapeHtml(new Date(item.created_at.replace(" ", "T") + "-04:00").toLocaleString("pt-BR"))}</td><td>${escapeHtml(item.patient_name)}</td><td><span class="status-badge status-controle">${escapeHtml(item.event_type)}</span></td><td>${escapeHtml(item.description || "—")}</td></tr>`).join("") : `<tr class="loading-row"><td colspan="4">Nenhuma movimentação registrada.</td></tr>`;
}

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

async function runPatientImport(dryRun) {
  try {
    const result = await api("/api/admin/import/patients", {method: "POST", body: JSON.stringify({rows: state.importRows, dry_run: dryRun})});
    const box = $("#adminImportResult");
    box.hidden = false;
    box.classList.toggle("error", result.errors.length > 0);
    box.innerHTML = `<strong>${dryRun ? "Validação concluída" : "Importação concluída"}</strong><br>${result.valid} válidos · ${result.duplicates} duplicados · ${result.errors.length} com erro${dryRun ? "" : ` · ${result.imported} importados`}`;
    state.importValidated = dryRun && result.errors.length === 0;
    $("#confirmImport").disabled = !state.importValidated;
    if (!dryRun) { state.importValidated = false; await Promise.all([loadAdmin(), loadDashboard(), loadPatients()]); }
  } catch (error) { showToast(error.message, true); }
}

async function loadJourneys() {
  const data = await api("/api/journeys");
  const items = data.items || [];
  const list = $("#journeyList");
  $("#journeyCount").textContent = items.length;
  $("#journeyCount").hidden = items.length === 0;
  list.innerHTML = items.length ? items.map(item => `<article class="journey-card"><div class="journey-card-avatar">${initials(item.name)}</div><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.forwarded_by || "Profissional")} → ${escapeHtml(item.forwarded_to || "Profissional")}</small><p>${escapeHtml(item.forward_reason || "Encaminhamento sem observação.")}</p></div><button class="secondary-button journey-open" type="button" data-journey-patient="${item.id}">Ver prontuário</button></article>`).join("") : `<p class="empty-journey">Nenhum paciente em jornada compartilhada no momento.</p>`;
  $$('[data-journey-patient]').forEach(button => button.addEventListener("click", () => openPatient(button.dataset.journeyPatient)));
}

async function openForwardDialog(patient) {
  const data = await api("/api/journey/professionals");
  $("#forwardProfessional").value = "";
  $("#forwardProfessionalList").innerHTML = (data.items || []).map(item => `<button class="forward-professional-card" type="button" data-forward-professional="${item.id}"><span class="forward-photo">${item.photo_url ? `<img src="${item.photo_url}" alt="">` : escapeHtml(initials(item.name))}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.specialties || "Especialidade não definida")}</small></span><i>Selecionar</i></button>`).join("") || `<p class="empty-journey">Nenhuma profissional disponível.</p>`;
  $$('[data-forward-professional]').forEach(button => button.addEventListener("click", () => {
    button.classList.toggle("selected");
    $("#forwardProfessional").value = $$('[data-forward-professional].selected').map(card => card.dataset.forwardProfessional).join(",");
  }));
  $("#forwardReason").value = "";
  $("#forwardDialogInfo").textContent = `${patient.name} será compartilhado com a profissional escolhida. O histórico e os retornos permanecem no mesmo prontuário.`;
  $("#forwardDialog").showModal();
}

function showView(view) {
  state.view = view;
  const isDashboard = view === "dashboard";
  const isProcedures = view === "procedures";
  const isDailyLog = view === "daily";
  const isJourney = view === "journey";
  $("#dashboardView").hidden = !isDashboard;
  $("#procedureView").hidden = !isProcedures;
  $("#dailyLogView").hidden = !isDailyLog;
  $("#journeyView").hidden = !isJourney;
  $("#adminView").hidden = true;
  $("#dashboardNav").classList.toggle("active", isDashboard);
  $("#proceduresNav").classList.toggle("active", isProcedures);
  $("#dailyLogNav").classList.toggle("active", isDailyLog);
  $("#journeyNav").classList.toggle("active", isJourney);
  $("#dashboardNav").toggleAttribute("aria-current", isDashboard);
  $("#proceduresNav").toggleAttribute("aria-current", isProcedures);
  $("#dailyLogNav").toggleAttribute("aria-current", isDailyLog);
  $("#journeyNav").toggleAttribute("aria-current", isJourney);
  $("#newPatientButton").hidden = !isDashboard;
  const titles = { procedures: "Catálogo de procedimentos", daily: "Verificados" };
  if (isDashboard) updateCurrentDate();
  else $("#pageTitle").textContent = titles[view] || "";
  if (isJourney) $("#pageTitle").textContent = "Jornada do paciente";
  if (isDailyLog) loadDailyLog();
  if (isJourney) loadJourneys();
  if (window.innerWidth <= 820) $(".sidebar").classList.remove("open");
}

async function loadDailyLog() {
  const data = await api("/api/daily-log?days=30");
  $("#dailyToday").textContent = data.summary.today;
  $("#dailyYesterday").textContent = data.summary.yesterday;
  $("#dailyWeek").textContent = data.summary.last_7_days;
  const tbody = $("#dailyLogTable");
  if (!data.records.length) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="4">Nenhum paciente foi marcado como verificado nos últimos 30 dias.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.records.map(record => {
    const date = new Date(`${record.date}T12:00:00`);
    const day = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
    return `<tr class="daily-summary-row"><td><strong>${formatDate(record.date)}</strong></td><td>${day[0].toUpperCase() + day.slice(1)}</td><td><span class="daily-total" title="${record.total} pacientes verificados">${record.total}</span></td><td><div class="daily-patient-list daily-patient-list-open">${record.patients.map(patient => `<article class="daily-patient-entry"><div><strong>${escapeHtml(patient.name)}</strong><small>Verificado às ${escapeHtml(patient.time)}</small></div><button class="daily-release-entry" type="button" data-release-patient-id="${patient.id}">Liberar alteração</button></article>`).join("")}</div></td></tr>`;
  }).join("");
  $$("[data-release-patient-id]").forEach(button => {
    button.addEventListener("click", () => {
    openReleaseDialog(button.dataset.releasePatientId);
    });
  });
}

function closeDrawer() {
  releasePatientEditLock();
  $("#patientDrawer").classList.remove("open");
  $("#patientDrawer").setAttribute("aria-hidden", "true");
  $("#drawerBackdrop").classList.remove("open");
  document.body.style.overflow = "";
}

function showToast(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.style.background = error ? "#b4514c" : "#46745d";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function openCompletionDialog(mode) {
  state.completionMode = mode;
  const isForward = mode === "forward";
  $("#completionDialogEyebrow").textContent = isForward ? "Confirmação de encaminhamento" : "Finalização do prontuário";
  $("#completionDialogTitle").textContent = isForward ? "Confirmar encaminhamento?" : "Finalizou as anotações?";
  $("#completionDialogInfo").textContent = isForward
    ? "Revise os profissionais selecionados. Ao confirmar, o prontuário será compartilhado com eles, mantendo todo o histórico registrado."
    : "Revise as anotações antes de concluir. Ao confirmar, a ficha será salva e o paciente ficará marcado como verificado.";
  $("#cancelCompletion").textContent = isForward ? "Revisar seleção" : "Continuar editando";
  $("#confirmCompletion").textContent = isForward ? "Confirmar encaminhamento" : "Salvar e verificar";
  $("#completionDialog").showModal();
}

async function submitForward() {
  const pending = state.pendingForward;
  if (!pending || !state.selected?.id) return;
  try {
    const updated = await api(`/api/patients/${state.selected.id}/forward`, { method: "POST", body: JSON.stringify(pending) });
    state.selected = updated;
    renderPatientJourney(updated.journey || []);
    await api(`/api/patients/${updated.id}/resolve`, { method: "POST", body: JSON.stringify({ resolved: true }) });
    await releasePatientEditLock();
    setPatientLocked(true, { reason: "verified" });
    $("#forwardDialog").close();
    showToast("Paciente encaminhado, salvo e marcado como verificado.");
    await Promise.all([loadJourneys(), loadDashboard(), loadPatients(), loadDailyLog()]);
  } catch (error) { showToast(error.message, true); }
  finally { state.pendingForward = null; }
}

$("#patientForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.saveApproved) {
    openCompletionDialog("save");
    return;
  }
  state.saveApproved = false;
  const id = $("#patientId").value;
  const payload = {
    name: $("#fieldName").value.trim(),
    last_visit: $("#fieldLastVisit").value,
    status: $("#fieldStatus").value,
    next_appointment: $("#fieldNextAppointment").value,
    next_appointment_type: $("#fieldNextAppointmentType").value,
    procedures: collectProcedures(),
    next_action: $("#fieldNextAction").value.trim(),
    phone: $("#fieldPhone").value.trim(),
    last_contact: $("#fieldLastContact").value,
    reference: $("#fieldReference").value.trim(),
    notes: $("#fieldNotes").value.trim(),
    observation: $("#fieldObservation").value.trim(),
    particularities: state.selected?.particularities || "",
    health_change: $("#fieldHealthChange").value === "1",
    health_condition: $("#fieldHealthCondition").value.trim(),
    health_care: $("#fieldHealthCare").value.trim(),
    relationships: collectRelationships(),
  };
  try {
    const creating = state.mode === "create";
    const forwardAfterSave = state.forwardAfterSave && !creating;
    const verifyAfterSave = state.verifyAfterSave;
    state.forwardAfterSave = false;
    state.verifyAfterSave = false;
    const updated = await api(creating ? "/api/patients" : `/api/patients/${id}`, { method: creating ? "POST" : "PATCH", body: JSON.stringify(payload) });
    state.selected = updated;
    state.mode = "edit";
    $("#patientId").value = updated.id;
    $("#drawerEyebrow").textContent = "Ficha do paciente";
    $("#drawerName").textContent = updated.name;
    $("#drawerAvatar").textContent = initials(updated.name);
    $("#drawerNextDisplay").textContent = formatDate(updated.next_appointment);
    $("#drawerDays").textContent = returnStatus(updated);
    $("#fieldObservation").value = "";
    state.observationsExpanded = false;
    renderObservations(updated.observations || []);
    $("#identityEditor").hidden = true;
    $("#fieldName").readOnly = true;
    updateHealthSeal();
    if (verifyAfterSave) {
      await api(`/api/patients/${updated.id}/resolve`, { method: "POST", body: JSON.stringify({ resolved: true }) });
      await releasePatientEditLock();
      setPatientLocked(true, { reason: "verified" });
      showToast("Anotações salvas e paciente marcado como verificado.");
    } else {
      showToast(creating ? "Paciente cadastrado com sucesso." : "Ficha atualizada com sucesso.");
    }
    await Promise.all([loadDashboard(), loadFilters(), loadPatients(), loadActionTemplates(), ...(verifyAfterSave ? [loadDailyLog()] : [])]);
    if (forwardAfterSave) openForwardDialog(updated);
  } catch (error) { showToast(error.message, true); }
});

let searchTimer;
$("#searchInput").addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.search = event.target.value.trim(); state.page = 1; loadPatients(); }, 250);
});
$("#statusFilter").addEventListener("change", (event) => { state.status = event.target.value; state.page = 1; loadPatients(); });
$("#fieldStatus").addEventListener("change", syncNiverFromStatus);
$("#saveJourneyStage").addEventListener("click", async () => {
  if (!state.selected?.id) return;
  try {
    const updated = await api(`/api/patients/${state.selected.id}/journey-stage`, { method: "POST", body: JSON.stringify({ stage_status: $("#journeyStageStatus").value, note: $("#journeyStageNote").value.trim() }) });
    state.selected = updated;
    renderPatientJourney(updated.journey || []);
    configureJourneyStage(updated);
    renderObservations(updated.observations || []);
    showToast("Sua etapa foi registrada na jornada.");
  } catch (error) { showToast(error.message, true); }
});
$("#showAllObservations").addEventListener("click", () => { state.observationsExpanded = !state.observationsExpanded; renderObservations(state.selected?.observations || []); });
$("#cancelObservationEdit").addEventListener("click", () => {
  state.editingObservationId = null;
  $("#observationEditDialog").close();
});
$("#observationEditForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selected?.id || !state.editingObservationId) return;
  try {
    const updated = await api(`/api/patients/${state.selected.id}/observations/${state.editingObservationId}`, { method: "PATCH", body: JSON.stringify({ note: $("#observationEditText").value.trim() }) });
    state.selected = updated;
    state.editingObservationId = null;
    $("#observationEditDialog").close();
    renderObservations(updated.observations || []);
    showToast("Observação atualizada no histórico.");
  } catch (error) { showToast(error.message, true); }
});
$("#monthFilter").addEventListener("change", (event) => { state.month = event.target.value; state.page = 1; loadPatients(); });
$("#nextScheduleFilter").addEventListener("change", (event) => { state.nextSchedule = event.target.value; state.page = 1; loadPatients(); });
$("#sortFilter").addEventListener("change", (event) => { state.sort = event.target.value; state.page = 1; loadPatients(); });
$("#clearFilters").addEventListener("click", () => {
  state.search = ""; state.status = ""; state.month = ""; state.nextSchedule = ""; state.sort = "last_visit_asc"; state.attention = ""; state.page = 1;
  $("#searchInput").value = ""; $("#statusFilter").value = ""; $("#monthFilter").value = ""; $("#nextScheduleFilter").value = ""; $("#sortFilter").value = state.sort;
  $$(".metric-card").forEach(card => card.classList.remove("active"));
  loadPatients();
});
$$('.metric-card').forEach(card => card.addEventListener("click", () => {
  if (card.dataset.sort) {
    state.attention = ""; state.sort = card.dataset.sort; state.page = 1; $("#sortFilter").value = state.sort;
    $$(".metric-card").forEach(item => item.classList.toggle("active", item === card));
    return loadPatients();
  }
  const next = card.dataset.attention;
  state.attention = state.attention === next ? "" : next;
  state.page = 1;
  $$(".metric-card").forEach(item => item.classList.toggle("active", state.attention === item.dataset.attention));
  loadPatients();
}));
$("#prevPage").addEventListener("click", () => { if (state.page > 1) { state.page--; loadPatients(); } });
$("#nextPage").addEventListener("click", () => { if (state.page * state.perPage < state.total) { state.page++; loadPatients(); } });
$("#closeDrawer").addEventListener("click", closeDrawer);
$("#drawerBackdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
$("#mobileMenu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
$("#columnsButton").addEventListener("click", () => {
  const menu = $("#columnsMenu");
  menu.hidden = !menu.hidden;
  $("#columnsButton").setAttribute("aria-expanded", String(!menu.hidden));
});
$$('[data-column-toggle]').forEach(input => input.addEventListener("change", () => {
  if (input.checked) state.hiddenColumns.delete(input.dataset.columnToggle);
  else state.hiddenColumns.add(input.dataset.columnToggle);
  localStorage.setItem("iea.patientTable.hiddenColumns", JSON.stringify([...state.hiddenColumns]));
  applyColumnVisibility();
}));
document.addEventListener("click", (event) => {
  if (event.target.closest(".columns-control")) return;
  $("#columnsMenu").hidden = true;
  $("#columnsButton").setAttribute("aria-expanded", "false");
});
function resetDeletePatientButton() {
  const button = $("#deletePatient");
  button.classList.remove("confirming");
  button.textContent = "Excluir paciente";
}

$("#deletePatient").addEventListener("click", () => {
  const id = $("#patientId").value;
  if (!id || state.mode === "create") return;
  $("#deletePatientForm").reset();
  $("#deletePatientName").textContent = state.selected?.name || $("#drawerName").textContent || "este paciente";
  $("#deletePatientActor").textContent = state.currentUser?.name || "usuário atual";
  $("#deletePatientDialog").showModal();
  setTimeout(() => $("#deletePatientPassword").focus(), 0);
});

$("#cancelDeletePatient").addEventListener("click", () => $("#deletePatientDialog").close());
$("#deletePatientForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#patientId").value;
  if (!id || state.mode === "create") return;
  const submitButton = event.currentTarget.querySelector("[type=submit]");
  submitButton.disabled = true;
  try {
    const result = await api(`/api/patients/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ password: $("#deletePatientPassword").value })
    });
    $("#deletePatientDialog").close();
    closeDrawer();
    state.selected = null;
    state.page = 1;
    showToast(`${result.patient_name || "Paciente"} excluído por ${result.deleted_by || state.currentUser?.name}.`);
    await Promise.all([loadDashboard(), loadFilters(), loadPatients(), loadDailyLog()]);
  } catch (error) {
    $("#deletePatientPassword").select();
    showToast(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});
$("#newPatientButton").addEventListener("click", openNewPatient);
$("#dashboardNav").addEventListener("click", () => showView("dashboard"));
$("#proceduresNav").addEventListener("click", () => showView("procedures"));
$("#dailyLogNav").addEventListener("click", () => showView("daily"));
$("#journeyNav").addEventListener("click", () => showView("journey"));
$("#saveAndForward").addEventListener("click", () => {
  if (state.mode !== "edit" || !state.selected?.id) return showToast("Cadastre o paciente antes de encaminhar.", true);
  if (!["owner", "professional", "asb"].includes(state.currentUser?.role)) return showToast("Este acesso não pode encaminhar pacientes.", true);
  if (state.patientLocked || state.journeyRecipient) return openForwardDialog(state.selected);
  state.forwardAfterSave = true;
  state.saveApproved = true;
  $("#patientForm").requestSubmit();
});
$("#cancelForward").addEventListener("click", () => $("#forwardDialog").close());
$("#forwardForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selected?.id) return;
  try {
    const professional_ids = $("#forwardProfessional").value.split(",").filter(Boolean);
    if (!professional_ids.length) throw new Error("Selecione ao menos um profissional.");
    state.pendingForward = { professional_ids, reason: $("#forwardReason").value.trim() };
    openCompletionDialog("forward");
  } catch (error) { showToast(error.message, true); }
});
$("#cancelCompletion").addEventListener("click", () => {
  state.pendingForward = null;
  $("#completionDialog").close();
});
$("#confirmCompletion").addEventListener("click", async () => {
  const mode = state.completionMode;
  $("#completionDialog").close();
  state.completionMode = null;
  if (mode === "forward") return submitForward();
  state.verifyAfterSave = true;
  state.saveApproved = true;
  $("#patientForm").requestSubmit();
});
$$('[data-admin-tab]').forEach(button => button.addEventListener("click", () => setAdminTab(button.dataset.adminTab)));
$$('[data-open-admin-tab]').forEach(button => button.addEventListener("click", () => setAdminTab(button.dataset.openAdminTab)));
$("#cancelProfessionalEdit").addEventListener("click", resetAdminProfessionalForm);
$("#adminProfessionalForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#adminProfessionalId").value;
  const payload = {
    name: $("#adminProfessionalName").value.trim(),
    email: $("#adminProfessionalEmail").value.trim(),
    role: "",
    access_role: $("#adminAccessRole").value,
    specialty_id: $("#adminProfessionalSpecialty").value,
    office_id: $("#adminProfessionalOffice").value,
    office_responsible: $("#adminOfficeResponsible").checked,
    active: $("#adminProfessionalActive").checked,
  };
  try {
    await api(id ? `/api/admin/professionals/${id}` : "/api/admin/professionals", {method: id ? "PATCH" : "POST", body: JSON.stringify(payload)});
    showToast(id ? "Profissional atualizado." : "Profissional e acesso preparados.");
    resetAdminProfessionalForm();
    await loadAdmin();
  } catch (error) { showToast(error.message, true); }
});
$("#adminSpecialtyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { await api("/api/admin/specialties", {method: "POST", body: JSON.stringify({name: $("#adminSpecialtyName").value.trim()})}); event.target.reset(); await loadAdmin(); showToast("Especialidade adicionada."); }
  catch (error) { showToast(error.message, true); }
});
$("#adminOfficeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { await api("/api/admin/offices", {method: "POST", body: JSON.stringify({name: $("#adminOfficeName").value.trim()})}); event.target.reset(); await loadAdmin(); showToast("Consultório adicionado."); }
  catch (error) { showToast(error.message, true); }
});
$("#adminImportFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  state.importRows = []; state.importValidated = false;
  $("#confirmImport").disabled = true;
  $("#adminImportResult").hidden = true;
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = file.name.toLowerCase().endsWith(".json") ? JSON.parse(text) : parseCsv(text);
    state.importRows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : []);
    $("#adminImportFileInfo").textContent = `${file.name} · ${state.importRows.length} registros encontrados`;
    $("#validateImport").disabled = !state.importRows.length;
    renderImportPreview();
  } catch { $("#adminImportFileInfo").textContent = "Não foi possível ler esse arquivo."; $("#validateImport").disabled = true; }
});
$("#validateImport").addEventListener("click", () => runPatientImport(true));
$("#confirmImport").addEventListener("click", () => runPatientImport(false));
$("#refreshAudit").addEventListener("click", loadAdminAudit);
$("#catalogForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = { name: $("#catalogName").value.trim(), default_value_cents: parseMoney($("#catalogValue").value), active: true };
  try {
    await api("/api/procedure-catalog", { method: "POST", body: JSON.stringify(payload) });
    event.target.reset();
    await loadCatalog();
    showToast("Procedimento adicionado ao catálogo.");
  } catch (error) { showToast(error.message, true); }
});
$("#addProcedure").addEventListener("click", () => {
  $("#procedureList").insertAdjacentHTML("beforeend", procedureTemplate());
  bindProcedureRows();
  const names = $$(".procedure-name");
  if (names.length) names[names.length - 1].focus();
});
$("#addRelationship").addEventListener("click", () => {
  $("#relationshipList").insertAdjacentHTML("beforeend", relationshipTemplate());
  bindRelationshipRows();
  const rows = $$(".relationship-row");
  rows.at(-1)?.querySelector(".relationship-type")?.focus();
});
$("#fieldHealthChange").addEventListener("change", updateHealthSeal);
$("#fieldNextAppointment").addEventListener("change", syncNextAppointmentType);
$("#headerHealthSeal").addEventListener("click", openHealthDialog);
$("#closeHealthDialog").addEventListener("click", () => closeHealthDialog(true));
$("#cancelHealthDialog").addEventListener("click", () => closeHealthDialog(true));
$("#applyHealthDialog").addEventListener("click", () => closeHealthDialog(false));

$("#cancelRelease").addEventListener("click", () => $("#releaseDialog").close());
$("#releaseDialog").addEventListener("cancel", () => { state.releasePatientId = null; });
$("#releaseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.releasePatientId) return;
  try {
    await api(`/api/patients/${state.releasePatientId}/reopen-with-password`, { method: "POST", body: JSON.stringify({ password: $("#releasePassword").value }) });
    $("#releaseDialog").close();
    state.releasePatientId = null;
    showToast("Ficha liberada para alteração.");
    await Promise.all([loadDashboard(), loadPatients(), loadDailyLog()]);
  } catch (error) { showToast(error.message, true); }
});
$("#healthDialog").addEventListener("cancel", (event) => { event.preventDefault(); closeHealthDialog(true); });

$('#cancelJourneyEdit').addEventListener('click', () => $('#journeyEditDialog').close());
$('#journeyEditDialog').addEventListener('cancel', () => { state.editingJourneyProfessionalId = null; });
$('#journeyEditForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.selected?.id || !state.editingJourneyProfessionalId) return;
  try {
    const updated = await api(`/api/patients/${state.selected.id}/journey/${state.editingJourneyProfessionalId}`, { method: 'PATCH', body: JSON.stringify({ reason: $('#journeyEditReason').value.trim() }) });
    state.selected = updated;
    $('#journeyEditDialog').close();
    state.editingJourneyProfessionalId = null;
    renderPatientJourney(updated.journey || []);
    showToast('Encaminhamento atualizado.');
  } catch (error) { showToast(error.message, true); }
});

$("#reopenPatient")?.addEventListener("click", async () => {
  if (!state.selected?.id) return;
  try {
    await api(`/api/patients/${state.selected.id}/resolve`, { method: "POST", body: JSON.stringify({ resolved: false }) });
    showToast("Paciente reaberto. A ficha já pode ser editada.");
    await Promise.all([loadDashboard(), loadPatients(), loadDailyLog()]);
    await openPatient(state.selected.id);
  } catch (error) { showToast(error.message, true); }
});

async function initializeApp() {
  const response = await fetch('/api/auth/status');
  const auth = await response.json();
  if (!auth.authenticated) { location.replace('/login'); return; }
  if (auth.user.role === 'crc') { location.replace('/central-crc'); return; }
  if (!auth.user.two_factor_enabled && !auth.user.two_factor_exempt) { location.replace('/two-factor-setup'); return; }
  if (auth.user.must_change_password) { location.replace('/change-password'); return; }
  state.currentUser = auth.user;
  configureMasterPatientColumn();
  $("#metricPotential")?.closest(".metric-card")?.setAttribute("hidden", "");
  $("[data-column-toggle='potential']")?.closest("label")?.setAttribute("hidden", "");
  $(".procedure-heading").closest(".form-section").id = "procedureSection";
  $("#fieldPhone").closest(".form-section").id = "contactSection";
  $("#procedureSection").hidden = true;
  $("#contactSection").hidden = true;
  $$(".nav-item[disabled]").forEach(button => {
    button.classList.add("nav-item-soon");
    const badge = button.querySelector("small");
    if (badge) badge.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><b>Em</b><b>breve</b>';
  });
  const professional = auth.user.role === 'professional';
  const isAsb = auth.user.role === 'asb';
  const portfolioName = auth.user.portfolio_professional_name || 'Dentista não definido';
  const profile = document.querySelector('.profile-mini .profile-details');
  if (profile) {
    profile.innerHTML = isAsb
      ? `<strong>${escapeHtml(auth.user.name)}</strong><span class="profile-office">ASB</span><span class="profile-portfolio">Carteira: ${escapeHtml(portfolioName)}</span>`
      : `<strong>${escapeHtml(auth.user.name)}</strong><span class="profile-office">${escapeHtml(auth.user.offices || 'Consultório não definido')}</span><span class="profile-specialty">${escapeHtml(auth.user.specialties || 'Especialidade não definida')}</span>`;
  }
  const portfolioContext = $('#asbPortfolioContext');
  const portfolioSubtitle = $('#asbPortfolioSubtitle');
  if (isAsb) {
    portfolioContext.hidden = false;
    $('#asbPortfolioName').textContent = portfolioName;
    portfolioSubtitle.hidden = false;
    portfolioSubtitle.textContent = `Pacientes sob responsabilidade de ${portfolioName}`;
  }
  const initialsElement = $('#profileInitials');
  if (initialsElement) initialsElement.textContent = initials(auth.user.name);
  const profilePhoto = $('#profilePhoto');
  if (profilePhoto) { if (auth.user.photo_url) { profilePhoto.src = `${auth.user.photo_url}?cache=${Date.now()}`; } else { profilePhoto.removeAttribute('src'); } }
  if (professional) {
    $('#fieldName').readOnly = true;
    $('#fieldLastVisit').readOnly = true;
  }
  $('#profileMenuButton').addEventListener('click', () => { const menu = $('#profileMenuPopover'); const expanded = !menu.hidden; menu.hidden = expanded; $('#profileMenuButton').setAttribute('aria-expanded', String(!expanded)); });
  $('#logoutButton').addEventListener('click', async () => { await fetch('/api/auth/logout', {method: 'POST'}); location.replace('/login'); });
  updateCurrentDate(); setInterval(updateCurrentDate, 60_000); loadColumnPreferences();
  setInterval(() => {
    if (!document.hidden && state.view === "dashboard") loadPatients({ silent: true }).catch(() => {});
  }, 8_000);
  await Promise.all([loadDashboard(), loadFilters(), loadCatalog(), loadActionTemplates(), loadDailyLog(), loadJourneys(), loadPatients()]);
}
window.addEventListener("pagehide", () => {
  const patientId = state.collaborationLock?.patientId;
  if (!patientId) return;
  fetch(`/api/patients/${patientId}/edit-lock`, { method: "DELETE", keepalive: true }).catch(() => {});
});
initializeApp().catch(error => { $("#patientsTable").innerHTML = `<tr class="loading-row"><td colspan="${visibleColumnCount()}">${escapeHtml(error.message)}</td></tr>`; showToast(error.message, true); });
