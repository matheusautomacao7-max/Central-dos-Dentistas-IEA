import sqlite3
import sys
import tempfile
import types
from datetime import datetime
from http import HTTPStatus
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

from app import server


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


with tempfile.TemporaryDirectory(prefix="crm-resolution-flow-", ignore_cleanup_errors=True) as directory:
    data = Path(directory)
    database = data / "clinic.db"
    original_connect = server.connect
    original_data = server.DATA
    original_media = server.CRM_MEDIA_DIR
    server.DATA = data
    server.CRM_MEDIA_DIR = data / "media"
    server.connect = lambda: SQLiteTestConnection(database)
    try:
        server.initialize_database()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with sqlite3.connect(database) as db:
            cursor = db.execute(
                """INSERT INTO users(name,email,access_role,active,crm_access_level,crm_operational_agent)
                   VALUES('Atendente Teste','resolution-flow@test.local','crc',1,'admin',1)"""
            )
            user_id = cursor.lastrowid
            channel_id = db.execute(
                """INSERT INTO crm_channels(instance_name,display_name,active,sync_enabled,connection_status)
                   VALUES('teste-resolucao','Canal Teste',1,1,'Conectado')"""
            ).lastrowid
            contact_id = db.execute(
                "INSERT INTO crm_contacts(name,phone,is_internal) VALUES('Paciente Resolvido','65999990000',0)"
            ).lastrowid
            conversation_id = db.execute(
                """INSERT INTO crm_conversations(
                       channel_id,contact_id,status,pipeline_stage,assigned_user_id,assigned_at,
                       queue_entered_at,first_response_at,last_message_at,created_at
                   ) VALUES(?,?,'Aberta','Em atendimento',?,?,?,?,?,?)""",
                (channel_id, contact_id, user_id, now, now, now, now, now),
            ).lastrowid

        handler = server.ClinicHandler.__new__(server.ClinicHandler)
        handler.authenticated_user = {
            "id": user_id,
            "name": "Atendente Teste",
            "access_role": "crc",
            "crm_access_level": "admin",
        }
        handler.responses = []
        handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))
        handler.require_crc_access = lambda: True
        handler.require_crm_feature = lambda _feature: True
        handler.require_crm_any_feature = lambda _features: True
        handler.crm_channel_allowed = lambda *_args, **_kwargs: True

        handler.resolve_crm_conversation(conversation_id, {
            "patient_type": "Retorno s/ Tratamento",
            "category": "Controle",
            "outcome": "Outros",
            "loss_reason": "Atendimento concluído no teste de regressão.",
        })
        status, payload = handler.responses[-1]
        assert status == 200, payload
        assert payload["resolved"] is True

        handler.get_crm_conversations({"view": ["operational"]})
        status, funnel = handler.responses[-1]
        assert status == 200, funnel
        funnel_item = next(item for item in funnel["items"] if item["id"] == conversation_id)
        assert funnel_item["status"] == "Resolvida"
        assert funnel_item["pipeline_stage"] == "Resolvido"

        handler.get_crm_patient_control({"period": ["today"], "per_page": ["50"]})
        status, control = handler.responses[-1]
        assert status == 200, control
        assert control["summary"]["total"] == 1
        assert len(control["rows"]) == 1
        row = control["rows"][0]
        assert row["contact_name"] == "Paciente Resolvido"
        assert row["resolved_by_name"] == "Atendente Teste"
        assert row["outcome"] == "Outros"
    finally:
        server.connect = original_connect
        server.DATA = original_data
        server.CRM_MEDIA_DIR = original_media

operations = (ROOT / "app" / "public" / "crm-operations-bridge.js").read_text(encoding="utf-8")
assert "data.rows || data.items || []" in operations
assert "row.contact_name || row.patient_name || row.name" in operations
assert "row.resolved_by_name || row.agent_name || row.attendant_name" in operations

print("crm-resolution-pipeline-control-regression-ok")
