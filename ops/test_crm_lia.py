"""Static regression checks for the internal Lia assistant boundaries and UI bridge."""

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER = (ROOT / "app" / "server.py").read_text(encoding="utf-8")
SCHEMA = (ROOT / "app" / "schema.sql").read_text(encoding="utf-8")
BRIDGE = (ROOT / "app" / "public" / "crm-lia.js").read_text(encoding="utf-8")
HTML = (ROOT / "app" / "public" / "crm-whatsapp.html").read_text(encoding="utf-8")


def methods(source: str) -> dict[str, str]:
    tree = ast.parse(source)
    return {
        node.name: ast.get_source_segment(source, node) or ""
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }


source_methods = methods(SERVER)
for name in ("get_crm_lia_knowledge", "save_crm_lia_knowledge", "ask_crm_lia", "get_crm_lia_settings", "save_crm_lia_settings", "get_crm_lia_usage"):
    assert name in source_methods
    assert "require_crc_access" in source_methods[name]
    assert "require_crm_any_feature" in source_methods[name]

assert "can_manage_crm(self.authenticated_user)" in source_methods["save_crm_lia_knowledge"]
assert "status='active'" in source_methods["ask_crm_lia"]
assert "OPENAI_API_KEY" in source_methods["ask_crm_lia"]
assert "monthly_budget_cents" in source_methods["ask_crm_lia"]
assert "daily_limit_per_user" in source_methods["ask_crm_lia"]
assert "CREATE TABLE IF NOT EXISTS crm_lia_knowledge" in SCHEMA
assert "idx_crm_lia_knowledge_status" in SCHEMA
assert "CREATE TABLE IF NOT EXISTS crm_lia_settings" in SCHEMA
assert "general_assistance" in SCHEMA
assert "general_assistance" in source_methods["ask_crm_lia"]
assert "general_assistance" in source_methods["save_crm_lia_settings"]
assert "CREATE TABLE IF NOT EXISTS crm_lia_usage" in SCHEMA
assert '"/api/crm/lia/knowledge"' in SERVER and '"/api/crm/lia/ask"' in SERVER
assert "crm-lia.js?v=20260804-lia-knowledge-v1" in HTML
assert "Não envio mensagens nem altera atendimentos." in BRIDGE
assert "Base oficial da Lia" in BRIDGE
assert "openKnowledgeManager" not in BRIDGE  # avoid an orphan manager implementation
assert "function showManager" in BRIDGE and "function showEditor" in BRIDGE
assert "function showSettings" in BRIDGE
assert "Configurar IA e limites" in BRIDGE
assert "Permitir Assistência geral" in BRIDGE

print("crm-lia-tests-ok")
