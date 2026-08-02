import sqlite3
import sys
import tempfile
import types
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "app"))

qrcode = types.ModuleType("qrcode")
qrcode_image = types.ModuleType("qrcode.image")
qrcode_svg = types.ModuleType("qrcode.image.svg")
qrcode_svg.SvgPathImage = object
qrcode.image = qrcode_image
openpyxl = types.ModuleType("openpyxl")
openpyxl.load_workbook = lambda *args, **kwargs: None
psycopg = types.ModuleType("psycopg")
psycopg_sql = types.ModuleType("psycopg.sql")
psycopg_errors = types.ModuleType("psycopg.errors")
psycopg.Error = Exception
psycopg.connect = lambda *args, **kwargs: None
psycopg.sql = psycopg_sql
psycopg_errors.IntegrityError = sqlite3.IntegrityError
sys.modules.update({
    "qrcode": qrcode, "qrcode.image": qrcode_image, "qrcode.image.svg": qrcode_svg,
    "openpyxl": openpyxl, "psycopg": psycopg, "psycopg.sql": psycopg_sql,
    "psycopg.errors": psycopg_errors,
})

import app.server as server


class SQLiteTestConnection:
    backend = "sqlite"

    def __init__(self, database: Path):
        self._db = sqlite3.connect(database)
        self._db.row_factory = sqlite3.Row

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            self._db.commit() if exc_type is None else self._db.rollback()
        finally:
            self._db.close()
        return False

    def execute(self, query, params=()):
        return self._db.execute(query.replace(" FOR UPDATE", ""), params)

    def executemany(self, query, params):
        return self._db.executemany(query.replace(" FOR UPDATE", ""), params)

    def __getattr__(self, name):
        return getattr(self._db, name)


with tempfile.TemporaryDirectory(prefix="crm-ops-") as directory:
    data = Path(directory)
    database = data / "clinic.db"
    original_connect = server.connect
    original_data = server.DATA
    original_media_dir = server.CRM_MEDIA_DIR
    server.DATA = data
    server.CRM_MEDIA_DIR = data / "media"
    server.connect = lambda: SQLiteTestConnection(database)
    try:
        server.initialize_database()
        db = sqlite3.connect(database)
        try:
            conversation_columns = {row[1] for row in db.execute("PRAGMA table_info(crm_conversations)")}
            channel_columns = {row[1] for row in db.execute("PRAGMA table_info(crm_channels)")}
            tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        finally:
            db.close()
    finally:
        server.connect = original_connect
        server.DATA = original_data
        server.CRM_MEDIA_DIR = original_media_dir

assert {"resolution_reason", "scheduled_return_at", "reopened_at"} <= conversation_columns
assert "sla_minutes" in channel_columns
assert {
    "crm_quick_replies", "crm_conversation_events", "crm_integration_alerts",
    "crm_user_channels", "crm_user_features", "crm_permission_audit",
} <= tables
print("crm-operations-schema-ok")
