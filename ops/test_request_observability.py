import io
import json
import sys
import types
from contextlib import redirect_stdout
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

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "app"))
from app import server


handler = server.ClinicHandler.__new__(server.ClinicHandler)
handler.request_id = "req-test-123"
handler.request_started_at = 10.0
handler.command = "GET"
handler.path = "/api/test?api_key=segredo"
handler.client_address = ("127.0.0.1", 12345)

original_monotonic = server.time.monotonic
server.time.monotonic = lambda: 10.125
try:
    output = io.StringIO()
    with redirect_stdout(output):
        handler.log_message('"GET /api/test?api_key=segredo HTTP/1.1" 200 -')
finally:
    server.time.monotonic = original_monotonic

event = json.loads(output.getvalue())
assert event["request_id"] == "req-test-123"
assert event["method"] == "GET"
assert event["duration_ms"] == 125
assert "segredo" not in json.dumps(event)
assert event["remote_ip"] == "127.0.0.1"

# O handler padrão usa %d ao registrar respostas de erro. Os tipos precisam
# ser preservados até a formatação, ou uma simples resposta 404 vira conexão
# encerrada/502 no proxy.
error_output = io.StringIO()
with redirect_stdout(error_output):
    handler.log_message("code %d, message %s", 404, "Not Found")
error_event = json.loads(error_output.getvalue())
assert error_event["message"] == "code 404, message Not Found"

assert "X-Request-ID" in (PROJECT_ROOT / "app" / "server.py").read_text(encoding="utf-8")
print("request-observability-tests-ok")
