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


with tempfile.TemporaryDirectory() as directory:
    database = Path(directory) / "manual-start.db"
    db = sqlite3.connect(database)
    db.executescript("""
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE crm_channels (id INTEGER PRIMARY KEY, active INTEGER, sync_enabled INTEGER);
        CREATE TABLE crm_user_channels (user_id INTEGER, channel_id INTEGER, can_reply INTEGER);
        CREATE TABLE crm_contacts (
            id INTEGER PRIMARY KEY, name TEXT, phone TEXT UNIQUE, is_internal INTEGER DEFAULT 0,
            updated_at TEXT
        );
        CREATE TABLE crm_conversations (
            id INTEGER PRIMARY KEY, channel_id INTEGER, contact_id INTEGER,
            status TEXT DEFAULT 'Aberta', pipeline_stage TEXT DEFAULT 'Novo',
            assigned_user_id INTEGER, assigned_at TEXT, unread_count INTEGER DEFAULT 0,
            resolved_at TEXT, resolved_by_user_id INTEGER, automation_state TEXT DEFAULT 'manual', updated_at TEXT,
            UNIQUE(channel_id, contact_id)
        );
        CREATE TABLE crm_conversation_events (
            id INTEGER PRIMARY KEY, conversation_id INTEGER, event_type TEXT,
            actor_user_id INTEGER, actor_name TEXT, details_json TEXT
        );
        INSERT INTO users VALUES(20,'Matheus Henrique');
        INSERT INTO users VALUES(21,'Matheus Defende');
        INSERT INTO crm_channels VALUES(2,1,1);
        INSERT INTO crm_channels VALUES(3,1,1);
        INSERT INTO crm_contacts(id,name,phone,is_internal) VALUES(1,'Paciente salvo','6796150513',1);
    """)
    db.commit()
    db.close()

    class SQLiteAdapter:
        def __init__(self, connection):
            self.connection = connection

        def execute(self, query, params=()):
            return self.connection.execute(query.replace(" FOR UPDATE", ""), params)

        def __getattr__(self, name):
            return getattr(self.connection, name)

    @contextmanager
    def test_connect():
        connection = sqlite3.connect(database)
        connection.row_factory = sqlite3.Row
        try:
            yield SQLiteAdapter(connection)
            connection.commit()
        finally:
            connection.close()

    original_connect = server.connect
    server.connect = test_connect
    try:
        handler = server.ClinicHandler.__new__(server.ClinicHandler)
        handler.authenticated_user = {
            "id": 20, "name": "Matheus Henrique", "access_role": "crc",
            "crm_channel_scope_enabled": 0,
        }
        handler.require_crc_access = lambda: True
        handler.require_crm_feature = lambda feature_key: True
        handler.crm_channel_allowed = lambda *_args: True
        handler.responses = []
        handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))

        handler.start_crm_conversation({
            "name": "Paciente salvo", "phone": "(67) 9615-0513",
            "channel_id": 2, "open_only": True,
        })
        assert handler.responses[-1][0] == 200
        with test_connect() as check:
            row = check.execute("""SELECT ct.is_internal,cv.assigned_user_id,cv.pipeline_stage
                FROM crm_contacts ct JOIN crm_conversations cv ON cv.contact_id=ct.id""").fetchone()
            assert tuple(row) == (0, 20, "Em atendimento")
            event = check.execute("SELECT event_type,actor_user_id FROM crm_conversation_events").fetchone()
            assert tuple(event) == ("conversation.started", 20)

        handler.start_crm_conversation({
            "name": "Paciente salvo", "phone": "6796150513",
            "channel_id": 3, "open_only": True,
        })
        assert handler.responses[-1][1]["reused"] is True
        with test_connect() as check:
            assert check.execute("SELECT COUNT(*) FROM crm_conversations").fetchone()[0] == 1

        with test_connect() as check:
            check.execute("UPDATE crm_conversations SET assigned_user_id=21 WHERE id=1")
        handler.start_crm_conversation({
            "name": "Paciente salvo", "phone": "6796150513",
            "channel_id": 2, "open_only": True,
        })
        status, payload = handler.responses[-1]
        assert status == 409
        assert payload["code"] == "PATIENT_ASSIGNED_TO_ANOTHER_USER"
        assert payload["assigned_to"] == "Matheus Defende"
        with test_connect() as check:
            assert check.execute("SELECT assigned_user_id FROM crm_conversations WHERE id=1").fetchone()[0] == 21
    finally:
        server.connect = original_connect

print("crm-manual-start-tests-ok")
