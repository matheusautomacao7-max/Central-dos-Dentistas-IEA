"""Regression checks for CRM feature/channel authorization.

These tests intentionally use only the standard library so the permission matrix
can run in CI before optional application dependencies are installed.
"""

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = ROOT / "app" / "server.py"
SCHEMA_PATH = ROOT / "app" / "schema.sql"
CRM_HTML_PATH = ROOT / "app" / "public" / "crm-whatsapp.html"
BRIDGE_PATH = ROOT / "app" / "public" / "crm-operations-bridge.js"
ADMIN_JS_PATH = ROOT / "app" / "public" / "admin.js"


def method_sources(source: str) -> dict[str, str]:
    tree = ast.parse(source)
    methods = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            segment = ast.get_source_segment(source, node)
            if segment:
                methods[node.name] = segment
    return methods


server_source = SERVER_PATH.read_text(encoding="utf-8")
methods = method_sources(server_source)

exact_feature_guards = {
    "get_crm_contacts": "contacts",
    "cleanup_crm_imported_contacts": "contacts",
    "get_crm_campaigns": "campaigns",
    "get_crm_campaign_responses": "campaigns",
    "get_crm_quick_replies": "inbox",
    "create_crm_quick_reply": "inbox",
    "update_crm_quick_reply": "inbox",
    "delete_crm_quick_reply": "inbox",
    "send_crm_message": "inbox",
    "update_crm_contact": "contacts",
    "start_crm_conversation": "contacts",
    "resolve_crm_conversation": "inbox",
    "claim_crm_conversation": "inbox",
    "get_crm_resolution_reports": "management",
    "get_crm_patient_control": "management",
    "update_crm_channel": "integrations",
    "save_crm_channel": "integrations",
    "get_crm_integration_health": "integrations",
    "get_crm_webhook_events": "integrations",
    "get_crm_automation_events": "integrations",
}
for method_name, feature in exact_feature_guards.items():
    source = methods[method_name]
    expected = f'require_crm_feature("{feature}")'
    assert expected in source, f"{method_name} must require {feature}"

assert "can_manage_crm(self.authenticated_user)" in methods["save_crm_goals"]
assert "can_manage_crm(self.authenticated_user)" in methods["get_crm_goals"]

workspace_guards = {
    "get_crm_contact_profile_photo",
    "get_crm_channels",
    "get_crm_conversation_timeline",
    "get_crm_agents",
    "get_crm_tags",
    "create_crm_tag",
    "get_crm_metrics",
    "get_crm_messages",
    "get_crm_message_media",
    "get_crm_media",
    "update_crm_conversation",
}
for method_name in workspace_guards:
    assert "require_crm_any_feature" in methods[method_name], f"{method_name} must fail closed"

conversation_source = methods["get_crm_conversations"]
assert "require_crm_feature(self.crm_conversation_view_feature(view))" in conversation_source
view_mapping = methods["crm_conversation_view_feature"]
assert 'view == "queue"' in view_mapping and 'return "queue"' in view_mapping
assert 'view == "operational"' in view_mapping and 'return "funnel"' in view_mapping
assert view_mapping.rstrip().endswith('return "inbox"')

for method_name in (
    "get_crm_contacts",
    "get_crm_campaigns",
    "get_crm_campaign_responses",
    "get_crm_agents",
    "get_crm_metrics",
    "get_crm_resolution_reports",
    "get_crm_patient_control",
):
    source = methods[method_name]
    assert "scope_clause" in source, f"{method_name} must enforce channel scope in SQL"

media_source = methods["get_crm_media"]
assert "crm_messages" in media_source and "crm_channel_allowed" in media_source

permission_save = methods["save_admin_crm_channel_access"]
validation_position = permission_save.index("set(feature_keys) - set(CRM_FEATURE_KEYS)")
transaction_position = permission_save.index("with connect() as db")
assert validation_position < transaction_position, "validate the full payload before changing permissions"
assert "INSERT INTO crm_permission_audit" in permission_save
assert "before_json" in permission_save and "after_json" in permission_save
assert permission_save.count(" is True") >= 3, "permission writes must use strict booleans"
assert "crm_manage_automation" in permission_save
assert "crm_operational_agent" in permission_save
assert "permission.can_manage_automation=1" in server_source

n8n_manager = methods["require_crm_n8n_manager"]
assert "crm_can_manage_automation" in n8n_manager, "n8n management must require the explicit automation capability"

admin_audit = methods["get_admin_audit"]
assert "details_before" in admin_audit and "details_after" in admin_audit
assert "ip_address" in admin_audit and "permission_change_summary" in admin_audit

schema = SCHEMA_PATH.read_text(encoding="utf-8")
for constraint in (
    "CHECK (crm_channel_scope_enabled IN (0, 1))",
    "CHECK (crm_feature_scope_enabled IN (0, 1))",
    "CHECK (crm_operational_agent IN (0, 1))",
    "CHECK (crm_manage_automation IN (0, 1))",
    "CHECK (crm_access_level IN ('attendant', 'admin'))",
    "CHECK (can_reply IN (0, 1))",
    "CHECK (can_manage_automation IN (0, 1))",
    "CHECK (feature_key IN ('inbox','queue','funnel','management','contacts','campaigns','integrations','settings'))",
):
    assert constraint in schema
for migration_constraint in (
    "users_crm_channel_scope_bool",
    "users_crm_feature_scope_bool",
    "users_crm_operational_agent_bool",
    "users_crm_manage_automation_bool",
    "users_crm_access_level_valid",
    "crm_user_channels_reply_bool",
    "crm_user_channels_automation_bool",
    "crm_user_features_key_valid",
):
    assert migration_constraint in server_source
assert "CREATE TABLE IF NOT EXISTS crm_permission_audit" in schema
assert 'crm_access_level TEXT NOT NULL DEFAULT \'attendant\'' in schema
assert 'def can_manage_crm' in server_source
assert 'user.get("access_role") == "crc" and user.get("crm_access_level") == "admin"' in server_source
assert "lower(email) IN ('matheuscrc@instituto.local','melocrc@instituto.local')" in server_source

admin_js = ADMIN_JS_PATH.read_text(encoding="utf-8")
assert "data-crm-operational-agent" in admin_js
assert "operational_agent:" in admin_js
assert "crm_manage_automation" in admin_js
assert "adminCrmAccessLevel" in admin_js
assert "crm_access_level:" in admin_js
assert "item.change_summary" in admin_js and "item.ip_address" in admin_js

crm_html = CRM_HTML_PATH.read_text(encoding="utf-8")
assert "allowedFeatures:[],permissionsReady:false" in crm_html
assert "const permissions=await this.loadCrmPermissions();" in crm_html
assert "if(!permissions)return;" in crm_html
assert "allowedFeatures:[],permissionsReady:false,permissionsError" in crm_html
assert "isInbox:S.permissionsReady&&S.screen==='inbox'" in crm_html

bridge = BRIDGE_PATH.read_text(encoding="utf-8")
assert "crm_feature_scope_enabled" in bridge
assert 'feature_scope_enabled: card.querySelector("[data-feature-scope]").checked' in bridge
assert "feature_scope_enabled: true" not in bridge
assert "permissionState={feature_scope_enabled:true,allowed_features:[]}" in bridge
assert "featureMatches.length === 1" in bridge
assert "originalNavDisplays = new WeakMap()" in bridge
assert 'nav.style.display = visible ? originalNavDisplays.get(nav) : "none"' in bridge
assert "crm-operations-bridge.js?v=20260803-sidebar-center-v4" in crm_html

print("crm-feature-permission-tests-ok")
