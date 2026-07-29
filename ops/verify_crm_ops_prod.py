import sqlite3

db = sqlite3.connect("/app/data/clinic.db")
assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
conversation_columns = {row[1] for row in db.execute("PRAGMA table_info(crm_conversations)")}
channel_columns = {row[1] for row in db.execute("PRAGMA table_info(crm_channels)")}
tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert {"resolution_reason", "scheduled_return_at", "reopened_at"} <= conversation_columns
assert "sla_minutes" in channel_columns
assert {"crm_quick_replies", "crm_conversation_events", "crm_integration_alerts"} <= tables
print("crm-operations-production-ok")
