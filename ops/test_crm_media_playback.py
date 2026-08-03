import io
import sys
import tempfile
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


class FakeCursor:
    def __init__(self, mime_type="audio/mpeg"):
        self.mime_type = mime_type

    def fetchall(self):
        return [{"channel_id": 1, "mime_type": self.mime_type, "message_type": "audio"}]


class FakeDatabase:
    def __init__(self, mime_type="audio/mpeg"):
        self.mime_type = mime_type

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, *_args, **_kwargs):
        return FakeCursor(self.mime_type)


def make_handler(range_header=None):
    handler = server.ClinicHandler.__new__(server.ClinicHandler)
    handler.headers = {"Range": range_header} if range_header else {}
    handler.wfile = io.BytesIO()
    handler.status = None
    handler.response_headers = {}
    handler.require_crc_access = lambda: True
    handler.require_crm_any_feature = lambda _features: True
    handler.crm_channel_allowed = lambda *_args, **_kwargs: True
    handler.send_response = lambda status: setattr(handler, "status", int(status))
    handler.send_header = lambda name, value: handler.response_headers.__setitem__(name, value)
    handler.send_security_headers = lambda: None
    handler.end_headers = lambda: None
    return handler


with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as directory:
    original_connect = server.connect
    original_media_dir = server.CRM_MEDIA_DIR
    file_name = "a" * 32 + ".mp3"
    content = b"ID3-audio-content-for-range-test"
    try:
        server.connect = lambda: FakeDatabase()
        server.CRM_MEDIA_DIR = Path(directory)
        (server.CRM_MEDIA_DIR / file_name).write_bytes(content)

        full = make_handler()
        full.get_crm_media(file_name)
        assert full.status == HTTPStatus.OK
        assert full.wfile.getvalue() == content
        assert full.response_headers["Content-Type"] == "audio/mpeg"
        assert full.response_headers["Accept-Ranges"] == "bytes"

        partial = make_handler("bytes=4-10")
        partial.get_crm_media(file_name)
        assert partial.status == HTTPStatus.PARTIAL_CONTENT
        assert partial.wfile.getvalue() == content[4:11]
        assert partial.response_headers["Content-Range"] == f"bytes 4-10/{len(content)}"
        assert partial.response_headers["Content-Length"] == "7"

        suffix = make_handler("bytes=-5")
        suffix.get_crm_media(file_name)
        assert suffix.status == HTTPStatus.PARTIAL_CONTENT
        assert suffix.wfile.getvalue() == content[-5:]

        invalid = make_handler("bytes=999-1000")
        invalid.get_crm_media(file_name)
        assert invalid.status == HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE
        assert invalid.wfile.getvalue() == b""
        assert invalid.response_headers["Content-Range"] == f"bytes */{len(content)}"

        legacy_name = "b" * 32 + ".mp4"
        (server.CRM_MEDIA_DIR / legacy_name).write_bytes(content)
        server.connect = lambda: FakeDatabase("application/octet-stream")
        legacy = make_handler()
        legacy.get_crm_media(legacy_name)
        assert legacy.response_headers["Content-Type"] == "audio/mp4"

        assert server.ClinicHandler.crm_media_extension("audio/mpeg") == "mp3"
        assert server.ClinicHandler.crm_media_extension("audio/x-m4a") == "m4a"
    finally:
        server.connect = original_connect
        server.CRM_MEDIA_DIR = original_media_dir

print("crm-media-playback-range-regression-ok")
