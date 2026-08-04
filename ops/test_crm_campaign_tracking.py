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

if "qrcode" not in sys.modules:
    qrcode = types.ModuleType("qrcode")
    qrcode_image = types.ModuleType("qrcode.image")
    qrcode_svg = types.ModuleType("qrcode.image.svg")
    qrcode_svg.SvgPathImage = object
    qrcode.image = qrcode_image
    sys.modules.update({"qrcode": qrcode, "qrcode.image": qrcode_image, "qrcode.image.svg": qrcode_svg})
if "openpyxl" not in sys.modules:
    openpyxl = types.ModuleType("openpyxl")
    openpyxl.load_workbook = lambda *args, **kwargs: None
    sys.modules["openpyxl"] = openpyxl
if "psycopg" not in sys.modules:
    psycopg = types.ModuleType("psycopg")
    psycopg_sql = types.ModuleType("psycopg.sql")
    psycopg_errors = types.ModuleType("psycopg.errors")
    psycopg.Error = Exception
    psycopg.connect = lambda *args, **kwargs: None
    psycopg.sql = psycopg_sql
    psycopg_errors.IntegrityError = sqlite3.IntegrityError
    sys.modules.update({"psycopg": psycopg, "psycopg.sql": psycopg_sql, "psycopg.errors": psycopg_errors})

from app import server


class SQLiteTestConnection:
    backend = "sqlite"

    def __init__(self, database):
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


def make_handler():
    handler = server.ClinicHandler.__new__(server.ClinicHandler)
    handler.authenticated_user = {"id": 1, "name": "Admin CRM", "access_role": "crc"}
    handler.headers = {}
    handler.responses = []
    handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))
    handler.require_crc_access = lambda: True
    handler.require_crm_feature = lambda feature: True
    handler.crm_event_channel_scope_clause = lambda alias: ("1=1", ())
    handler.shared_integration_authorized = lambda query: True
    handler.crm_n8n_run_event_authorized = lambda payload: False
    handler.crm_n8n_callback_authorized = lambda: False
    return handler


with tempfile.TemporaryDirectory(prefix="crm-campaign-", ignore_cleanup_errors=True) as directory:
    database = Path(directory) / "clinic.db"
    original_connect = server.connect
    original_data = server.DATA
    original_media = server.CRM_MEDIA_DIR
    original_seed = server.SEED_PATH
    server.DATA = Path(directory)
    server.CRM_MEDIA_DIR = Path(directory) / "media"
    server.SEED_PATH = Path(directory) / "patients.seed.json"
    server.SEED_PATH.write_text("[]", encoding="utf-8")
    server.connect = lambda: SQLiteTestConnection(database)
    try:
        server.initialize_database()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with sqlite3.connect(database) as db:
            db.execute("INSERT INTO users(name,email,access_role,active) VALUES('Admin CRM','admin-crm@test','crc',1)")
            db.execute("INSERT INTO crm_channels(instance_name,display_name,active) VALUES('iea','iea',1)")
            db.execute("INSERT INTO crm_contacts(name,phone) VALUES('Paciente Campanha','65999991111')")
            db.execute(
                """INSERT INTO crm_conversations
                   (channel_id,contact_id,status,last_direction,last_message_at,queue_entered_at)
                   VALUES(1,1,'Aberta','inbound',?,NULL)""",
                (now,),
            )

        handler = make_handler()
        handler.receive_crm_automation_event({
            "event_id": "reply-1",
            "event_type": "patient.replied",
            "phone": "65999991111",
            "campaign_id": "Confirmação Clinicorp",
            "patient_name": "Paciente Campanha",
            "occurred_at": now,
        }, {})
        assert handler.responses[-1][1]["conversation_id"] == 1

        # Um segundo evento do mesmo paciente não pode inflar o total de pessoas.
        handler.receive_crm_automation_event({
            "event_id": "reply-2",
            "event_type": "message.received",
            "phone": "65999991111",
            "campaign_id": "Confirmação Clinicorp",
            "patient_name": "Paciente Campanha",
            "occurred_at": now,
        }, {})

        handler.get_crm_campaigns({"days": ["30"]})
        campaign = handler.responses[-1][1]["items"][0]
        assert campaign["replies"] == 1, campaign
        assert campaign["linked_replies"] == 1, campaign
        assert campaign["campaign_key"] == "Confirmação Clinicorp"

        handler.get_crm_campaign_responses({"days": ["30"], "campaign": ["Confirmação Clinicorp"]})
        response = handler.responses[-1][1]
        assert response["total"] == 1, response
        assert response["items"][0]["name"] == "Paciente Campanha"
        assert response["items"][0]["inbox_status"] == "Na fila"
        assert response["items"][0]["campaign_tag"] == "Campanha: Confirmação de agenda"

        with sqlite3.connect(database) as db:
            db.row_factory = sqlite3.Row
            conversation = db.execute(
                "SELECT queue_entered_at,handoff_reason FROM crm_conversations WHERE id=1"
            ).fetchone()
            tags = [row[0] for row in db.execute(
                """SELECT t.name FROM crm_conversation_tags ctt
                   JOIN crm_tags t ON t.id=ctt.tag_id WHERE ctt.conversation_id=1"""
            ).fetchall()]
            assert conversation["queue_entered_at"] is not None
            assert conversation["handoff_reason"] == "Resposta de campanha aguardando CRC"
            assert "Campanha: Confirmação de agenda" in tags

            # Evento legado sem conversation_id: a abertura da tela reconcilia
            # pelo telefone, sem criar uma conversa artificial.
            db.execute("INSERT INTO crm_contacts(name,phone) VALUES('Paciente Legado','65999992222')")
            db.execute(
                """INSERT INTO crm_conversations
                   (channel_id,contact_id,status,last_direction,last_message_at)
                   VALUES(1,2,'Aberta','inbound',?)""",
                (now,),
            )
            db.execute(
                """INSERT INTO crm_n8n_patient_events
                   (event_key,campaign_id,flow_name,patient_name,phone,event_type,occurred_at)
                   VALUES('legacy-reply','Campanha Recuperação','Fluxo recuperação','Paciente Legado',
                          '65999992222','patient.replied',?)""",
                (now,),
            )

        handler.get_crm_campaigns({"days": ["30"]})
        with sqlite3.connect(database) as db:
            linked = db.execute(
                "SELECT conversation_id FROM crm_n8n_patient_events WHERE event_key='legacy-reply'"
            ).fetchone()[0]
            assert linked == 2
            assert db.execute("SELECT queue_entered_at FROM crm_conversations WHERE id=2").fetchone()[0]
    finally:
        server.connect = original_connect
        server.DATA = original_data
        server.CRM_MEDIA_DIR = original_media
        server.SEED_PATH = original_seed

bridge = (ROOT / "app" / "public" / "crm-evolution-bridge.js").read_text(encoding="utf-8")
html = (ROOT / "app" / "public" / "crm-whatsapp.html").read_text(encoding="utf-8")
assert "data-campaign-replies" in bridge
assert "/api/crm/campaign-responses" in bridge
assert "Localizar no Inbox" in bridge
assert "20260803-campaign-header-v3" in html
assert 'priority.insertAdjacentElement("beforebegin", makeBadge(item, "before"))' in bridge

print("crm-campaign-tracking-regression-ok")
