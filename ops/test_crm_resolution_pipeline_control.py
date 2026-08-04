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
    original_seed = server.SEED_PATH
    server.DATA = data
    server.CRM_MEDIA_DIR = data / "media"
    server.SEED_PATH = data / "patients.seed.json"
    server.SEED_PATH.write_text("[]", encoding="utf-8")
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

        handler.resolve_crm_conversation(conversation_id, {
            "patient_type": "Retorno s/ Tratamento",
            "category": "Controle",
            "outcome": "Outros",
            "loss_reason": "Tentativa duplicada.",
        })
        duplicate_status, duplicate_payload = handler.responses[-1]
        assert duplicate_status == 409, duplicate_payload
        with sqlite3.connect(database) as db:
            assert db.execute(
                "SELECT COUNT(*) FROM crm_service_resolutions WHERE conversation_id=?",
                (conversation_id,),
            ).fetchone()[0] == 1

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

        # O relatório pode limitar as linhas visíveis, mas totais e grupos
        # precisam considerar todo o filtro, inclusive acima de 500 itens.
        with sqlite3.connect(database) as db:
            db.executemany(
                """INSERT INTO crm_service_resolutions(
                       conversation_id,contact_id,channel_id,category,outcome,
                       resolved_by_user_id,resolved_by_name,resolved_at,final_actor)
                   VALUES(?,?,?,?,?,?,?,?,?)""",
                [
                    (
                        conversation_id, contact_id, channel_id,
                        "Orçamento" if index == 499 else "Controle",
                        "Agendou" if index % 2 == 0 else "Retorno",
                        user_id, "Atendente Teste", now, "Humano",
                    )
                    for index in range(500)
                ],
            )
        handler.get_crm_resolution_reports({"period": ["today"]})
        status, report = handler.responses[-1]
        assert status == 200, report
        assert report["summary"]["total"] == 501
        assert report["summary"]["budgets"] == 1
        assert len(report["rows"]) == 500
        assert sum(item["total"] for item in report["by_category"]) == 501

        with sqlite3.connect(database) as db:
            due_contact_id = db.execute(
                "INSERT INTO crm_contacts(name,phone,is_internal) VALUES('Retorno Vencido','65999990001',0)"
            ).lastrowid
            due_conversation_id = db.execute(
                """INSERT INTO crm_conversations(
                       channel_id,contact_id,status,pipeline_stage,scheduled_return_at,created_at)
                   VALUES(?,?,'Resolvida','Aguardando cliente','2026-01-01 08:00:00',?)""",
                (channel_id, due_contact_id, now),
            ).lastrowid
        with SQLiteTestConnection(database) as db:
            assert handler.crm_activate_due_returns(db) == 1
            assert handler.crm_activate_due_returns(db) == 0
            assert db.execute(
                "SELECT COUNT(*) FROM crm_conversation_events WHERE conversation_id=? AND event_type='return.reopened'",
                (due_conversation_id,),
            ).fetchone()[0] == 1
    finally:
        server.connect = original_connect
        server.DATA = original_data
        server.CRM_MEDIA_DIR = original_media
        server.SEED_PATH = original_seed

operations = (ROOT / "app" / "public" / "crm-operations-bridge.js").read_text(encoding="utf-8")
assert "data.rows || data.items || []" in operations
assert "row.contact_name || row.patient_name || row.name" in operations
assert "row.resolved_by_name || row.agent_name || row.attendant_name" in operations

print("crm-resolution-pipeline-control-regression-ok")
