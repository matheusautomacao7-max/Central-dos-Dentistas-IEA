import sys
import types
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


source = (PROJECT_ROOT / "app" / "server.py").read_text(encoding="utf-8")
compose = (PROJECT_ROOT / "compose.yaml").read_text(encoding="utf-8")
webhook_setup = (PROJECT_ROOT / "ops" / "configure_evolution_webhooks.py").read_text(encoding="utf-8")

# O webhook tem segredo próprio e não amplia um vazamento para exportações e demais integrações.
assert 'EVOLUTION_WEBHOOK_TOKEN = os.environ.get("EVOLUTION_WEBHOOK_TOKEN", "")' in source
assert "EVOLUTION_WEBHOOK_TOKEN: ${EVOLUTION_WEBHOOK_TOKEN}" in compose
assert 'os.environ["EVOLUTION_WEBHOOK_TOKEN"]' in webhook_setup
assert "webhook_key=" in source

# URLs, logs e respostas não podem registrar valores de token/chave/segredo.
redacted = server.ClinicHandler.redact_log_value(
    'POST /api/integrations/evolution/webhook?webhook_key=super-secret&token=legacy HTTP/1.1'
)
assert "super-secret" not in redacted and "legacy" not in redacted
assert "[REDACTED]" in redacted

# A ativação de 2FA deve falhar de forma segura, nunca persistir segredo em texto claro.
original_key = server.APP_SECRET_KEY
original_aesgcm = server.AESGCM
try:
    server.APP_SECRET_KEY = None
    server.AESGCM = None
    try:
        server.ClinicHandler.encrypt_totp_secret("GEZDGNBVGY3TQOJQ")
    except RuntimeError:
        pass
    else:
        raise AssertionError("Segredo TOTP foi aceito sem criptografia")
finally:
    server.APP_SECRET_KEY = original_key
    server.AESGCM = original_aesgcm

# Trocar a senha invalida as demais sessões e deixa trilha de auditoria.
change_password_source = source[source.index("    def change_password"):source.index("    def request_password_reset")]
assert "DELETE FROM auth_sessions WHERE user_id=?" in change_password_source
assert "password_changed" in change_password_source

# Readiness precisa testar o PostgreSQL e o container deve usar essa sonda.
assert 'db.execute("SELECT 1")' in source
assert '"database": "ok"' in source
assert "healthcheck:" in compose and "http://127.0.0.1:8000/api/health" in compose

# Restrições adicionadas em produção não podem permanecer indefinidamente sem validação.
assert "VALIDATE CONSTRAINT" in source
assert "convalidated" in source

# Integrações Clinicorp não podem ser usadas como proxy para hosts arbitrários.
assert server.ClinicHandler.valid_clinicorp_url("https://api.clinicorp.com/rest/v1")
assert not server.ClinicHandler.valid_clinicorp_url("https://clinicorp.com.evil.example/api")
assert not server.ClinicHandler.valid_clinicorp_url("https://127.0.0.1/internal")

# Payloads técnicos com dados pessoais têm descarte/redação configurável.
assert "def cleanup_retention_data" in source
assert "WEBHOOK_PAYLOAD_RETENTION_DAYS" in source
assert '{"retention":"redacted"}' in source and "UPDATE crm_webhook_events SET payload_json" in source

print("security-hardening-tests-ok")
