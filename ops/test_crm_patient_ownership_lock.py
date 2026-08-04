import sys
import types
from http import HTTPStatus
from pathlib import Path


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
psycopg_errors.IntegrityError = RuntimeError
sys.modules.update({
    "qrcode": qrcode,
    "qrcode.image": qrcode_image,
    "qrcode.image.svg": qrcode_svg,
    "openpyxl": openpyxl,
    "psycopg": psycopg,
    "psycopg.sql": psycopg_sql,
    "psycopg.errors": psycopg_errors,
})
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "app"))
from app import server


OWNER = {
    "conversation_id": 271268,
    "assigned_user_id": 19,
    "assigned_to": "Mateus Defendi",
}


class FakeCursor:
    def __init__(self, row=None, rows=None, rowcount=1):
        self.row = row
        self.rows = rows or []
        self.rowcount = rowcount
        self.lastrowid = 1

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows


class FakeDatabase:
    def __init__(self, mode):
        self.mode = mode

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query, parameters=()):
        compact = " ".join(query.split())
        if "SELECT cv.id AS conversation_id" in compact:
            return FakeCursor(OWNER)
        if compact.startswith("SELECT id FROM crm_channels"):
            return FakeCursor({"id": 34})
        if compact.startswith("SELECT id FROM crm_contacts"):
            return FakeCursor({"id": 316842})
        if compact == "SELECT contact_id FROM crm_conversations WHERE id=?":
            return FakeCursor({"contact_id": 316842})
        if compact.startswith("SELECT cv.channel_id,cv.contact_id,cv.assigned_user_id,cv.status"):
            return FakeCursor({
                "channel_id": 34,
                "contact_id": 316842,
                "assigned_user_id": 20,
                "status": "Aberta",
                "is_internal": 0,
                "assigned_to": "Matheus Henrique",
            })
        if compact.startswith("SELECT cv.channel_id,ct.id AS contact_id"):
            return FakeCursor({
                "channel_id": 34,
                "contact_id": 316842,
                "phone": "67999999999",
                "is_internal": 0,
                "instance_name": "iea",
                "display_name": "iea",
                "evolution_base_url": "https://evolution.test",
                "evolution_api_key": "secret",
                "assigned_user_id": 20,
                "assigned_to": "Matheus Henrique",
            })
        if compact == "SELECT * FROM crm_conversations WHERE id=?":
            return FakeCursor({
                "id": 246862,
                "channel_id": 34,
                "contact_id": 316842,
                "priority": "Normal",
                "queue_name": "Entrada",
                "pipeline_stage": "Em atendimento",
                "internal_note": "",
                "assigned_user_id": 20,
                "scheduled_return_at": None,
                "status": "Aberta",
            })
        if compact.startswith("SELECT id FROM users"):
            return FakeCursor({"id": 20})
        if compact.startswith("SELECT cv.*,ct.id AS contact_id"):
            return FakeCursor({
                "id": 246862,
                "channel_id": 34,
                "contact_id": 316842,
                "assigned_user_id": 20,
                "assigned_to": "Matheus Henrique",
                "status": "Aberta",
                "automation_state": "paused",
                "automation_flow": None,
                "queue_entered_at": None,
                "first_response_at": None,
                "assigned_at": "2026-07-31 15:04:27",
            })
        return FakeCursor()


def make_handler():
    handler = server.ClinicHandler.__new__(server.ClinicHandler)
    handler.authenticated_user = {"id": 20, "name": "Matheus Henrique", "access_role": "crc"}
    handler.require_crc_access = lambda: True
    handler.require_crm_feature = lambda feature_key: True
    handler.require_crm_any_feature = lambda feature_keys: True
    handler.crm_channel_allowed = lambda *args, **kwargs: True
    handler.responses = []
    handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))
    return handler


original_connect = server.connect
try:
    scenarios = []

    handler = make_handler()
    server.connect = lambda: FakeDatabase("start")
    handler.start_crm_conversation({"name": "Paciente", "phone": "(67) 99999-9999", "channel_id": 34, "open_only": True})
    scenarios.append(("start", handler.responses[-1]))

    handler = make_handler()
    server.connect = lambda: FakeDatabase("claim")
    handler.claim_crm_conversation(246862)
    scenarios.append(("claim", handler.responses[-1]))

    handler = make_handler()
    server.connect = lambda: FakeDatabase("send")
    handler.send_crm_message(246862, {"text": "Mensagem bloqueada"})
    scenarios.append(("send", handler.responses[-1]))

    handler = make_handler()
    server.connect = lambda: FakeDatabase("update")
    handler.update_crm_conversation(246862, {"assigned_user_id": "me"})
    scenarios.append(("update", handler.responses[-1]))

    handler = make_handler()
    server.connect = lambda: FakeDatabase("resolve")
    handler.resolve_crm_conversation(246862, {"category": "Controle", "outcome": "Outros", "notes": "Teste"})
    scenarios.append(("resolve", handler.responses[-1]))

    for name, (status, payload) in scenarios:
        assert status == HTTPStatus.CONFLICT, (name, status, payload)
        assert payload["code"] == "PATIENT_ASSIGNED_TO_ANOTHER_USER", (name, payload)
        assert payload["assigned_to"] == "Mateus Defendi", (name, payload)

    source = Path(server.__file__).read_text(encoding="utf-8")
    assert "CRM_PATIENT_OWNERSHIP_LOCK_V16" in source
    assert "patient_ownership_transfer" in source
    assert "COUNT(DISTINCT CASE WHEN COALESCE(ct.is_internal,0)=0 AND cv.status<>'Resolvida' THEN ct.id END) AS active_count" in source
finally:
    server.connect = original_connect

print("crm-patient-ownership-lock-regression-ok")
