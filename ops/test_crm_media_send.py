import base64
import json
import sys
import tempfile
import types
import zipfile
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


def ooxml_bytes(folder: str, file_name: str) -> bytes:
    buffer = __import__("io").BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types />")
        archive.writestr(f"{folder}/{file_name}", "<document />")
    return buffer.getvalue()


class FakeCursor:
    def __init__(self, row=None, lastrowid=None):
        self.row = row
        self.lastrowid = lastrowid

    def fetchone(self):
        return self.row


class FakeDatabase:
    def __init__(self):
        self.message_id = 0
        self.active_contexts = 0

    def __enter__(self):
        self.active_contexts += 1
        return self

    def __exit__(self, *args):
        self.active_contexts -= 1
        return False

    def execute(self, query, parameters=()):
        compact = " ".join(query.split())
        if "SELECT cv.channel_id" in compact:
            return FakeCursor({
                "channel_id": 1,
                "phone": "65999999999",
                "is_internal": 1,
                "instance_name": "Canal Teste",
                "display_name": "Canal Teste",
                "evolution_base_url": "https://evolution.test",
                "evolution_api_key": "secret",
                "assigned_user_id": None,
                "assigned_to": None,
            })
        if compact.startswith("INSERT INTO crm_messages"):
            assert "ON CONFLICT(external_message_id) DO UPDATE SET" in compact
            assert "RETURNING id" in compact
            self.message_id += 1
            return FakeCursor(row={"id": self.message_id}, lastrowid=self.message_id)
        if compact.startswith("SELECT id,conversation_id,direction,message_type"):
            return FakeCursor({
                "id": self.message_id,
                "conversation_id": 1,
                "direction": "outbound",
                "message_type": "document",
                "body": "arquivo",
                "media_url": "/api/crm/media/test",
                "mime_type": "application/octet-stream",
                "duration_seconds": None,
                "sender_name": "Atendente Teste",
                "author_type": "human",
                "author_label": "Atendente Teste · CRC",
                "source_channel": "crm",
                "delivery_status": "Enviada",
                "message_at": "2026-07-31 20:00:00",
            })
        return FakeCursor()


class FakeEvolutionResponse:
    def __init__(self, external_id):
        self.external_id = external_id

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps({"key": {"id": self.external_id}}).encode()


with tempfile.TemporaryDirectory() as directory:
    database = FakeDatabase()
    requests = []
    original_connect = server.connect
    original_urlopen = server.urlopen
    original_media_dir = server.CRM_MEDIA_DIR
    server.connect = lambda: database
    server.CRM_MEDIA_DIR = Path(directory)

    def fake_urlopen(request, **kwargs):
        assert database.active_contexts == 0, "rede externa não pode segurar conexão/transação do banco"
        payload = json.loads(request.data.decode())
        requests.append((request.full_url, payload))
        return FakeEvolutionResponse(f"media-{len(requests)}")

    server.urlopen = fake_urlopen
    handler = server.ClinicHandler.__new__(server.ClinicHandler)
    handler.authenticated_user = {"id": 9, "name": "Atendente Teste", "access_role": "crc", "service_sector": "CRC"}
    handler.require_crc_access = lambda: True
    handler.require_crm_feature = lambda feature_key: True
    handler.crm_channel_allowed = lambda *args, **kwargs: True
    handler.crm_evolution_connection_state = lambda *args, **kwargs: "open"
    handler.crm_record_event = lambda *args, **kwargs: None
    handler.responses = []
    handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))

    try:
        samples = (
            ("image", "image/png", "imagem.png", b"\x89PNG\r\n\x1a\nvalid", "png"),
            ("video", "video/mp4", "video.mp4", b"\x00\x00\x00\x18ftypmp42valid", "mp4"),
            ("document", "application/pdf", "documento.pdf", b"%PDF-1.7\nvalid", "pdf"),
            ("document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "documento.docx", ooxml_bytes("word", "document.xml"), "docx"),
        )
        for message_type, mime_type, file_name, content, extension in samples:
            handler.send_crm_message(1, {
                "message_type": message_type,
                "media_base64": base64.b64encode(content).decode("ascii"),
                "mime_type": mime_type,
                "file_name": file_name,
            })
            assert handler.responses[-1][0] == HTTPStatus.CREATED
            url, payload = requests[-1]
            assert url.endswith("/message/sendMedia/Canal%20Teste")
            assert payload["mediatype"] == message_type
            assert payload["mimetype"] == mime_type
            assert payload["fileName"] == file_name
            stored = list(Path(directory).glob(f"*.{extension}"))[-1]
            assert stored.read_bytes() == content

        request_count = len(requests)
        handler.send_crm_message(1, {
            "message_type": "image",
            "media_base64": base64.b64encode(b"arquivo-falso").decode("ascii"),
            "mime_type": "image/png",
            "file_name": "imagem.png",
        })
        assert handler.responses[-1][0] == HTTPStatus.BAD_REQUEST
        assert "conteúdo" in handler.responses[-1][1]["error"].lower()
        assert len(requests) == request_count
    finally:
        server.connect = original_connect
        server.urlopen = original_urlopen
        server.CRM_MEDIA_DIR = original_media_dir

print("crm-media-send-regression-ok")
