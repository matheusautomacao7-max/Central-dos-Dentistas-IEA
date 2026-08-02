CREATE TABLE IF NOT EXISTS professionals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT,
    is_owner INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    photo_data TEXT,
    photo_mime TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS professional_offices (
    professional_id INTEGER NOT NULL,
    office_id INTEGER NOT NULL,
    is_responsible INTEGER NOT NULL DEFAULT 0,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (professional_id, office_id),
    FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE,
    FOREIGN KEY (office_id) REFERENCES offices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS specialties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS professional_specialties (
    professional_id INTEGER NOT NULL,
    specialty_id INTEGER NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (professional_id, specialty_id),
    FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE,
    FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    professional_id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    access_role TEXT NOT NULL CHECK(access_role IN ('owner', 'professional', 'admin', 'crc', 'asb')),
    linked_professional_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    password_hash TEXT,
    password_salt TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    permissions_json TEXT NOT NULL DEFAULT '{}',
    last_login_at TEXT,
    two_factor_secret TEXT,
    two_factor_enabled INTEGER NOT NULL DEFAULT 0,
    two_factor_enrolled_at TEXT,
    two_factor_exempt INTEGER NOT NULL DEFAULT 0,
    crm_channel_scope_enabled INTEGER NOT NULL DEFAULT 0 CHECK (crm_channel_scope_enabled IN (0, 1)),
    crm_feature_scope_enabled INTEGER NOT NULL DEFAULT 0 CHECK (crm_feature_scope_enabled IN (0, 1)),
    crm_operational_agent INTEGER NOT NULL DEFAULT 1 CHECK (crm_operational_agent IN (0, 1)),
    crm_manage_automation INTEGER NOT NULL DEFAULT 0 CHECK (crm_manage_automation IN (0, 1)),
    crm_access_level TEXT NOT NULL DEFAULT 'attendant' CHECK (crm_access_level IN ('attendant', 'admin')),
    service_sector TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (professional_id) REFERENCES professionals(id),
    FOREIGN KEY (linked_professional_id) REFERENCES professionals(id)
);

CREATE TABLE IF NOT EXISTS app_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_professional_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asb_professional_links (
    user_id INTEGER NOT NULL,
    professional_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, professional_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled')),
    completed_at TEXT,
    completed_by_user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (completed_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS login_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    successful INTEGER NOT NULL DEFAULT 0,
    attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    detail TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS import_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    created_by_user_id INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT,
    name TEXT NOT NULL,
    phone TEXT,
    reference TEXT,
    status TEXT NOT NULL DEFAULT 'Consulta' CHECK(status IN ('Consulta', 'Controle', 'Tratamento', 'Inativo')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_assignments (
    patient_id INTEGER NOT NULL,
    professional_id INTEGER NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 1,
    journey_status TEXT NOT NULL DEFAULT 'Ativo',
    origin_professional_id INTEGER,
    forward_reason TEXT,
    completed_at TEXT,
    stage_status TEXT NOT NULL DEFAULT 'Aguardando início',
    stage_note TEXT,
    stage_updated_at TEXT,
    assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (patient_id, professional_id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (professional_id) REFERENCES professionals(id)
    ,FOREIGN KEY (origin_professional_id) REFERENCES professionals(id)
);

CREATE TABLE IF NOT EXISTS patient_followup (
    patient_id INTEGER PRIMARY KEY,
    last_visit TEXT,
    next_appointment TEXT,
    next_appointment_type TEXT CHECK(next_appointment_type IN ('Agendado', 'Programado') OR next_appointment_type IS NULL),
    procedure_name TEXT,
    last_contact TEXT,
    next_action TEXT,
    custom_status TEXT,
    resolved_at TEXT,
    crc_status TEXT,
    crc_started_at TEXT,
    crc_completed_at TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS patient_clinical_profile (
    patient_id INTEGER PRIMARY KEY,
    particularities TEXT,
    health_change INTEGER NOT NULL DEFAULT 0 CHECK(health_change IN (0, 1)),
    health_condition TEXT,
    health_care TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_visit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    author_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL,
    related_name TEXT NOT NULL,
    connection TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relationship_name_directory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,
    source TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS procedures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value_cents INTEGER NOT NULL DEFAULT 0 CHECK(value_cents >= 0),
    discount_cents INTEGER NOT NULL DEFAULT 0 CHECK(discount_cents >= 0),
    stage TEXT NOT NULL DEFAULT 'Indicado' CHECK(stage IN ('Indicado', 'Aprovado', 'Agendado', 'Em andamento', 'Concluído')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS action_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS procedure_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_value_cents INTEGER NOT NULL DEFAULT 0 CHECK(default_value_cents >= 0),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_resolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    resolution_date TEXT NOT NULL,
    resolved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reopened_at TEXT,
    UNIQUE(patient_id, resolution_date),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS patient_deletion_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    patient_name TEXT NOT NULL,
    professional_name TEXT,
    deleted_by_user_id INTEGER,
    deleted_by_name TEXT NOT NULL,
    deleted_by_role TEXT NOT NULL,
    ip_address TEXT,
    deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crc_export_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    export_key TEXT NOT NULL UNIQUE,
    patient_name TEXT NOT NULL,
    phone TEXT,
    last_visit TEXT,
    professional_name TEXT,
    observation_text TEXT,
    status TEXT NOT NULL DEFAULT 'Pendente',
    message_created TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    claim_token TEXT,
    claimed_at TEXT,
    exported_at TEXT,
    message_created_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration_configs (
    name TEXT PRIMARY KEY,
    api_base_url TEXT,
    subscriber_id TEXT,
    api_user TEXT,
    api_token TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS api_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    api_base_url TEXT,
    subscriber_id TEXT,
    api_user TEXT,
    api_token TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sync_interval_seconds INTEGER NOT NULL DEFAULT 60,
    last_sync_at TEXT,
    last_sync_status TEXT,
    last_sync_message TEXT,
    last_sync_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Configuração persistente do n8n: independente do catálogo administrativo de APIs.
CREATE TABLE IF NOT EXISTS crm_n8n_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    api_base_url TEXT NOT NULL,
    api_token TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS api_integration_backups (
    integration_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    api_base_url TEXT,
    subscriber_id TEXT,
    api_user TEXT,
    api_token TEXT,
    active INTEGER NOT NULL,
    sync_interval_seconds INTEGER NOT NULL DEFAULT 60,
    saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES api_integrations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    integration_id INTEGER NOT NULL,
    patient_id INTEGER,
    external_id TEXT,
    phone_result TEXT,
    status TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    FOREIGN KEY (integration_id) REFERENCES api_integrations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_api_sync_logs_integration ON api_sync_logs(integration_id, id DESC);

CREATE TABLE IF NOT EXISTS api_sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    integration_id INTEGER NOT NULL,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'Em andamento',
    attempted_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    FOREIGN KEY (integration_id) REFERENCES api_integrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_sync_runs_integration ON api_sync_runs(integration_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_login_challenges_token ON login_challenges(token_hash);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_ip ON login_attempts(email, ip_address, attempted_at);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_import_batches_token ON import_batches(token_hash);
CREATE INDEX IF NOT EXISTS idx_professional_offices_office ON professional_offices(office_id);
CREATE INDEX IF NOT EXISTS idx_professional_specialties_specialty ON professional_specialties(specialty_id);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_followup_last_visit ON patient_followup(last_visit);
CREATE INDEX IF NOT EXISTS idx_followup_next_appointment ON patient_followup(next_appointment);
CREATE INDEX IF NOT EXISTS idx_relationships_patient ON patient_relationships(patient_id);
CREATE INDEX IF NOT EXISTS idx_relationships_name ON patient_relationships(related_name);
CREATE INDEX IF NOT EXISTS idx_relationship_directory_name ON relationship_name_directory(normalized_name);
CREATE INDEX IF NOT EXISTS idx_procedures_patient ON procedures(patient_id);
CREATE INDEX IF NOT EXISTS idx_procedures_stage ON procedures(stage);
CREATE INDEX IF NOT EXISTS idx_procedure_catalog_name ON procedure_catalog(name);
CREATE INDEX IF NOT EXISTS idx_daily_resolutions_date ON daily_resolutions(resolution_date);
CREATE INDEX IF NOT EXISTS idx_crc_export_queue_status ON crc_export_queue(status, id);

CREATE TABLE IF NOT EXISTS crm_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    phone TEXT,
    evolution_base_url TEXT,
    evolution_api_key TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sync_enabled INTEGER NOT NULL DEFAULT 1,
    sync_from_date TEXT NOT NULL DEFAULT '2026-07-20',
    connection_status TEXT NOT NULL DEFAULT 'Pendente',
    last_event_at TEXT,
    sla_minutes INTEGER NOT NULL DEFAULT 60,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    profile_picture_url TEXT,
    is_internal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crm_user_channels (
    user_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    can_reply INTEGER NOT NULL DEFAULT 1 CHECK (can_reply IN (0, 1)),
    can_manage_automation INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_automation IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, channel_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crm_user_features (
    user_id INTEGER NOT NULL,
    feature_key TEXT NOT NULL CHECK (feature_key IN ('inbox','queue','funnel','management','contacts','campaigns','integrations','settings')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, feature_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crm_permission_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    changed_by_user_id INTEGER,
    target_user_id INTEGER,
    before_json TEXT NOT NULL,
    after_json TEXT NOT NULL,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_permission_audit_created
ON crm_permission_audit(created_at DESC);

CREATE TABLE IF NOT EXISTS crm_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Aberta',
    priority TEXT NOT NULL DEFAULT 'Normal',
    queue_name TEXT NOT NULL DEFAULT 'Entrada',
    pipeline_stage TEXT NOT NULL DEFAULT 'Novo',
    internal_note TEXT NOT NULL DEFAULT '',
    assigned_user_id INTEGER,
    assigned_at TEXT,
    queue_entered_at TEXT,
    first_response_at TEXT,
    resolved_by_user_id INTEGER,
    automation_state TEXT NOT NULL DEFAULT 'manual',
    automation_flow TEXT,
    automation_turns INTEGER NOT NULL DEFAULT 0,
    handoff_reason TEXT,
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_direction TEXT,
    last_message_at TEXT,
    resolved_at TEXT,
    resolution_reason TEXT,
    scheduled_return_at TEXT,
    reopened_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, contact_id),
    FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crm_service_resolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    attendance_number INTEGER NOT NULL DEFAULT 1,
    patient_type TEXT,
    is_recovery INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    outcome TEXT NOT NULL,
    interest TEXT,
    origin TEXT,
    responsible_professional TEXT,
    notes TEXT,
    scheduled_date TEXT,
    scheduled_time TEXT,
    schedule_type TEXT,
    next_contact_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    loss_reason TEXT,
    resolved_by_user_id INTEGER NOT NULL,
    resolved_by_name TEXT NOT NULL,
    resolved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ai_involved INTEGER NOT NULL DEFAULT 0,
    final_actor TEXT NOT NULL DEFAULT 'Humano',
    campaign_name TEXT,
    workflow_name TEXT,
    wait_seconds INTEGER,
    service_seconds INTEGER,
    metadata_json TEXT,
    FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES crm_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_crm_service_resolutions_period
ON crm_service_resolutions(resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_service_resolutions_category
ON crm_service_resolutions(category, outcome, resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_service_resolutions_agent
ON crm_service_resolutions(resolved_by_user_id, resolved_at DESC);

CREATE TABLE IF NOT EXISTS crm_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month_start TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    monthly_target INTEGER NOT NULL DEFAULT 0,
    daily_target INTEGER NOT NULL DEFAULT 0,
    celebration_enabled INTEGER NOT NULL DEFAULT 1,
    celebration_message TEXT,
    created_by_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month_start, metric_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_crm_goals_period
ON crm_goals(month_start, user_id);

CREATE TABLE IF NOT EXISTS crm_goal_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER,
    user_id INTEGER NOT NULL,
    metric_key TEXT NOT NULL,
    achievement_type TEXT NOT NULL,
    period_key TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    realized_value INTEGER NOT NULL,
    message TEXT NOT NULL,
    source_resolution_id INTEGER,
    achieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, metric_key, achievement_type, period_key, target_value),
    FOREIGN KEY (goal_id) REFERENCES crm_goals(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (source_resolution_id) REFERENCES crm_service_resolutions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_goal_achievements_user
ON crm_goal_achievements(user_id, achieved_at DESC);

CREATE TABLE IF NOT EXISTS crm_profile_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon_key TEXT NOT NULL DEFAULT 'trophy'
        CHECK (icon_key IN ('trophy','medal','star','heart','target','sparkles')),
    accent_color TEXT NOT NULL DEFAULT '#2563EB',
    awarded_by_user_id INTEGER NOT NULL,
    awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (awarded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_crm_profile_achievements_user
ON crm_profile_achievements(user_id, active, awarded_at DESC);

CREATE TABLE IF NOT EXISTS crm_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    external_message_id TEXT UNIQUE,
    direction TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    body TEXT,
    media_url TEXT,
    mime_type TEXT,
    duration_seconds REAL,
    sender_name TEXT,
    sent_by_user_id INTEGER,
    author_type TEXT NOT NULL DEFAULT 'unknown',
    author_label TEXT,
    source_channel TEXT,
    delivery_status TEXT NOT NULL DEFAULT 'Recebida',
    message_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sent_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_messages_conversation_id_id
ON crm_messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS crm_message_attributions (
    external_message_id TEXT PRIMARY KEY,
    author_type TEXT NOT NULL,
    author_label TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_key TEXT NOT NULL UNIQUE,
    instance_name TEXT,
    event_type TEXT,
    payload_json TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'Recebido',
    error_message TEXT,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT
);

CREATE TABLE IF NOT EXISTS crm_automation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_key TEXT NOT NULL UNIQUE,
    conversation_id INTEGER,
    campaign_id TEXT,
    flow_name TEXT,
    event_type TEXT NOT NULL,
    outcome TEXT,
    payload_json TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crm_conversation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    actor_user_id INTEGER,
    actor_name TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_conversation_events_conversation
ON crm_conversation_events(conversation_id, id DESC);

CREATE TABLE IF NOT EXISTS crm_quick_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Geral',
    active INTEGER NOT NULL DEFAULT 1,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crm_integration_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    integration_type TEXT NOT NULL,
    integration_name TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS crm_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#8696a0'
);

CREATE TABLE IF NOT EXISTS crm_conversation_tags (
    conversation_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (conversation_id, tag_id),
    FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES crm_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_conversations_status ON crm_conversations(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_messages_conversation ON crm_messages(conversation_id, message_at, id);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_events_received ON crm_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_automation_events_received ON crm_automation_events(received_at DESC);
-- Suporta as subconsultas por conversa em get_crm_conversations (jornada
-- compartilhada e último evento de automação), que antes faziam varredura
-- completa das tabelas a cada uma das até 500 linhas retornadas.
CREATE INDEX IF NOT EXISTS idx_crm_conversations_contact_id ON crm_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_automation_events_conversation ON crm_automation_events(conversation_id, id);

CREATE TABLE IF NOT EXISTS crm_n8n_workflow_settings (
    workflow_id TEXT PRIMARY KEY,
    workflow_name TEXT NOT NULL,
    workflow_kind TEXT NOT NULL DEFAULT 'automatic',
    manual_enabled INTEGER NOT NULL DEFAULT 0,
    webhook_path TEXT,
    webhook_method TEXT NOT NULL DEFAULT 'POST',
    source_label TEXT NOT NULL DEFAULT '',
    channel_label TEXT NOT NULL DEFAULT '',
    requires_confirmation INTEGER NOT NULL DEFAULT 1,
    max_items INTEGER NOT NULL DEFAULT 25,
    test_mode INTEGER NOT NULL DEFAULT 1,
    updated_by_user_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crm_n8n_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_key TEXT NOT NULL UNIQUE,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    n8n_execution_id TEXT,
    mode TEXT NOT NULL DEFAULT 'test',
    status TEXT NOT NULL DEFAULT 'requested',
    requested_by_user_id INTEGER,
    request_payload_json TEXT NOT NULL DEFAULT '{}',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    sent_items INTEGER NOT NULL DEFAULT 0,
    delivered_items INTEGER NOT NULL DEFAULT 0,
    replied_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    appointment_items INTEGER NOT NULL DEFAULT 0,
    handoff_items INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crm_n8n_patient_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_key TEXT NOT NULL UNIQUE,
    run_id INTEGER,
    workflow_id TEXT,
    execution_id TEXT,
    flow_name TEXT,
    conversation_id INTEGER,
    campaign_id TEXT,
    contact_id INTEGER,
    patient_name TEXT,
    phone TEXT,
    channel_name TEXT,
    event_type TEXT NOT NULL,
    outcome TEXT,
    appointment_source TEXT,
    external_message_id TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    occurred_at TEXT,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES crm_n8n_runs(id) ON DELETE SET NULL,
    FOREIGN KEY (conversation_id) REFERENCES crm_conversations(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_n8n_runs_workflow_started
ON crm_n8n_runs(workflow_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_n8n_patient_events_run_received
ON crm_n8n_patient_events(run_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_n8n_patient_events_phone
ON crm_n8n_patient_events(phone, received_at DESC);

CREATE TABLE IF NOT EXISTS crm_n8n_workflow_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    action TEXT NOT NULL,
    workflow_json TEXT NOT NULL,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_n8n_workflow_versions_workflow
ON crm_n8n_workflow_versions(workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_n8n_callback_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_n8n_callback_keys_active
ON crm_n8n_callback_keys(active, id DESC);

CREATE INDEX IF NOT EXISTS idx_crm_user_channels_channel ON crm_user_channels(channel_id, user_id);

CREATE TABLE IF NOT EXISTS patient_edit_locks (
    patient_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_patient_edit_locks_expires
ON patient_edit_locks(expires_at);
