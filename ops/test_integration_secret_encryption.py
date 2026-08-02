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


class FakeAESGCM:
    def __init__(self, key):
        assert key == b"k" * 32

    def encrypt(self, nonce, plaintext, aad):
        assert len(nonce) == 12
        assert aad == server.INTEGRATION_SECRET_AAD
        return bytes(value ^ 0xA5 for value in plaintext) + b"tag"

    def decrypt(self, nonce, ciphertext, aad):
        assert len(nonce) == 12
        assert aad == server.INTEGRATION_SECRET_AAD
        assert ciphertext.endswith(b"tag")
        return bytes(value ^ 0xA5 for value in ciphertext[:-3])


original_key = server.APP_SECRET_KEY
original_aesgcm = server.AESGCM
try:
    server.APP_SECRET_KEY = b"k" * 32
    server.AESGCM = FakeAESGCM
    first = server.encrypt_integration_secret("token-super-secreto")
    second = server.encrypt_integration_secret("token-super-secreto")
    assert first.startswith(server.INTEGRATION_SECRET_PREFIX)
    assert "token-super-secreto" not in first
    assert first != second, "Cada cifra precisa de nonce exclusivo"
    assert server.decrypt_integration_secret(first) == "token-super-secreto"
    assert server.decrypt_integration_secret("legado-em-texto-claro") == "legado-em-texto-claro"
    assert server.encrypt_integration_secret(first) == first, "Valor cifrado não pode ser cifrado novamente"

    server.APP_SECRET_KEY = None
    try:
        server.encrypt_integration_secret("novo-segredo")
    except RuntimeError:
        pass
    else:
        raise AssertionError("Novo segredo foi aceito sem APP_SECRET_KEY")
finally:
    server.APP_SECRET_KEY = original_key
    server.AESGCM = original_aesgcm

source = (PROJECT_ROOT / "app" / "server.py").read_text(encoding="utf-8")
for table, column in (
    ("integration_configs", "api_token"),
    ("api_integrations", "api_token"),
    ("api_integration_backups", "api_token"),
    ("crm_n8n_config", "api_token"),
    ("crm_channels", "evolution_api_key"),
):
    assert f'("{table}", "{column}")' in source

assert '"api_token": encrypted_token' in source
print("integration-secret-encryption-tests-ok")
