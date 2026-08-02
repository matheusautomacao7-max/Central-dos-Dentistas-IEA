import sqlite3
import sys
import tempfile
import types
from contextlib import contextmanager
from http import HTTPStatus
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app"))
sys.path.insert(0, str(ROOT))

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

from app import server


def handler_for(user_id: int, name: str):
    handler = server.ClinicHandler.__new__(server.ClinicHandler)
    handler.authenticated_user = {"id": user_id, "name": name, "access_role": "crc"}
    handler.require_crc_access = lambda: True
    handler.require_crm_feature = lambda feature_key: True
    handler.responses = []
    handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))
    return handler


with tempfile.TemporaryDirectory() as directory:
    database = Path(directory) / "claim.db"
    connection = sqlite3.connect(database)
    connection.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            access_role TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            crm_channel_scope_enabled INTEGER NOT NULL DEFAULT 0,
            crm_manage_automation INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE crm_channels (id INTEGER PRIMARY KEY);
        CREATE TABLE crm_user_channels (user_id INTEGER, channel_id INTEGER, can_reply INTEGER DEFAULT 1);
        CREATE TABLE crm_contacts (id INTEGER PRIMARY KEY, is_internal INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE crm_conversations (
            id INTEGER PRIMARY KEY,
            channel_id INTEGER NOT NULL,
            contact_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'Aberta',
            pipeline_stage TEXT NOT NULL DEFAULT 'Novo',
            assigned_user_id INTEGER,
            assigned_at TEXT,
            automation_state TEXT NOT NULL DEFAULT 'manual',
            updated_at TEXT
        );
        CREATE TABLE crm_conversation_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            actor_user_id INTEGER,
            actor_name TEXT,
            details_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users(id,name,access_role) VALUES(1,'Atendente Um','crc');
        INSERT INTO users(id,name,access_role) VALUES(2,'Atendente Dois','crc');
        INSERT INTO users(id,name,access_role,crm_channel_scope_enabled) VALUES(3,'Somente Leitura','crc',1);
        INSERT INTO crm_channels(id) VALUES(1);
        INSERT INTO crm_user_channels(user_id,channel_id,can_reply) VALUES(3,1,0);
        INSERT INTO crm_contacts(id,is_internal) VALUES(1,0),(2,1);
        INSERT INTO crm_conversations(id,channel_id,contact_id) VALUES(1,1,1),(2,1,2);
        """
    )
    connection.commit()
    connection.close()

    class SQLiteAdapter:
        def __init__(self, connection):
            self.connection = connection

        def execute(self, query, params=()):
            return self.connection.execute(query.replace(" FOR UPDATE", ""), params)

        def __getattr__(self, name):
            return getattr(self.connection, name)

    @contextmanager
    def test_connect():
        db = sqlite3.connect(database)
        db.row_factory = sqlite3.Row
        try:
            yield SQLiteAdapter(db)
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    original_connect = server.connect
    server.connect = test_connect
    try:
        first = handler_for(1, "Atendente Um")
        second = handler_for(2, "Atendente Dois")
        read_only = handler_for(3, "Somente Leitura")

        read_only.claim_crm_conversation(1)
        assert read_only.responses[-1][0] == 403, read_only.responses

        first.claim_crm_conversation(1)
        assert first.responses[-1] == (200, {"claimed": True, "id": 1})

        with test_connect() as db:
            conversation = db.execute(
                "SELECT assigned_user_id,pipeline_stage,automation_state FROM crm_conversations WHERE id=1"
            ).fetchone()
            assert tuple(conversation) == (1, "Em atendimento", "paused")
            assert db.execute(
                "SELECT COUNT(*) FROM crm_conversation_events WHERE conversation_id=1 AND event_type='conversation.assigned'"
            ).fetchone()[0] == 1

        first.claim_crm_conversation(1)
        assert first.responses[-1][0] == 200
        assert first.responses[-1][1]["already_owned"] is True

        second.claim_crm_conversation(1)
        assert second.responses[-1][0] == 409
        assert "Atendente Um" in second.responses[-1][1]["error"]

        first.claim_crm_conversation(2)
        assert first.responses[-1] == (200, {"claimed": False, "internal": True, "id": 2})
        with test_connect() as db:
            assert db.execute("SELECT assigned_user_id FROM crm_conversations WHERE id=2").fetchone()[0] is None
    finally:
        server.connect = original_connect

print("crm-claim-tests-ok")
