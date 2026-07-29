import pathlib
import sqlite3
import tempfile

import app.server as server

data = pathlib.Path(tempfile.mkdtemp(prefix="crm-ops-"))
server.DATA = data
server.DB_PATH = data / "clinic.db"
server.CRM_MEDIA_DIR = data / "media"
server.initialize_database()

with sqlite3.connect(server.DB_PATH) as db:
    conversation_columns = {row[1] for row in db.execute("PRAGMA table_info(crm_conversations)")}
    channel_columns = {row[1] for row in db.execute("PRAGMA table_info(crm_channels)")}
    tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}

assert {"resolution_reason", "scheduled_return_at", "reopened_at"} <= conversation_columns
assert "sla_minutes" in channel_columns
assert {"crm_quick_replies", "crm_conversation_events", "crm_integration_alerts"} <= tables
print("crm-operations-schema-ok")
