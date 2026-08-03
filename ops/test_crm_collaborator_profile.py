"""Regression checks for CRM collaborator profiles and manual achievements."""

import sqlite3
import sys
import types
from http import HTTPStatus
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
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
    psycopg_errors = types.ModuleType("psycopg.errors")
    class PsycopgError(Exception):
        pass
    class IntegrityError(PsycopgError):
        pass
    psycopg.Error = PsycopgError
    psycopg.errors = psycopg_errors
    psycopg.sql = types.SimpleNamespace()
    psycopg_errors.IntegrityError = IntegrityError
    sys.modules.update({"psycopg": psycopg, "psycopg.errors": psycopg_errors})

import server  # noqa: E402


def test_schema_and_frontend_contract() -> None:
    schema = (ROOT / "app" / "schema.sql").read_text(encoding="utf-8")
    db = sqlite3.connect(":memory:")
    db.executescript(schema)
    columns = {row[1] for row in db.execute("PRAGMA table_info(crm_profile_achievements)")}
    assert {"user_id", "title", "description", "icon_key", "accent_color", "awarded_by_user_id", "active"} <= columns

    bridge = (ROOT / "app" / "public" / "crm-collaborator-profile.js").read_text(encoding="utf-8")
    html = (ROOT / "app" / "public" / "crm-whatsapp.html").read_text(encoding="utf-8")
    assert 'data-iea-cp-trigger' in bridge
    assert 'iea.crm.theme' in bridge and 'data-omtheme' in bridge
    assert 'prefers-reduced-motion:reduce' in bridge
    assert '/api/crm/profile/achievements' in bridge
    assert 'role="dialog"' in bridge and 'aria-modal="true"' in bridge
    assert 'crm-collaborator-profile.js?v=20260803-profile-trophies-v1' in html
    assert 'bundle legado ainda desenha o rodapé com as iniciais fixas "AS"' in bridge
    assert 'document.addEventListener("click", interceptProfileTrigger, true)' in bridge


def test_only_crm_admin_can_create_manual_achievement() -> None:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,access_role TEXT,active INTEGER);
        CREATE TABLE crm_profile_achievements(
          id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,title TEXT,description TEXT,
          icon_key TEXT,accent_color TEXT,awarded_by_user_id INTEGER,
          awarded_at TEXT DEFAULT CURRENT_TIMESTAMP,active INTEGER DEFAULT 1
        );
        CREATE TABLE security_events(
          id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,event_type TEXT,
          detail TEXT,ip_address TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users VALUES(1,'Gestor','crc',1),(2,'Atendente','crc',1);
    """)
    original_connect = server.connect
    server.connect = lambda: db
    try:
        handler = server.ClinicHandler.__new__(server.ClinicHandler)
        sent = []
        handler.send_json = lambda payload, status=HTTPStatus.OK: sent.append((payload, status))
        handler.request_ip = lambda: "127.0.0.1"
        handler.authenticated_user = {
            "id": 2, "name": "Atendente", "access_role": "crc",
            "crm_access_level": "attendant", "permissions_json": "{}",
        }
        handler.create_crm_profile_achievement({"user_id": 2, "title": "Excelência"})
        assert sent[-1][1] == HTTPStatus.FORBIDDEN
        assert db.execute("SELECT COUNT(*) FROM crm_profile_achievements").fetchone()[0] == 0

        handler.authenticated_user = {
            "id": 1, "name": "Gestor", "access_role": "crc",
            "crm_access_level": "admin", "permissions_json": "{}",
        }
        handler.create_crm_profile_achievement({
            "user_id": 2, "title": "Excelência no atendimento",
            "description": "Reconhecimento pelo cuidado com os pacientes.",
            "icon_key": "medal", "accent_color": "#7C3AED",
        })
        assert sent[-1][1] == HTTPStatus.CREATED
        row = db.execute("SELECT * FROM crm_profile_achievements").fetchone()
        assert row["user_id"] == 2 and row["awarded_by_user_id"] == 1
        assert row["title"] == "Excelência no atendimento"
        assert db.execute("SELECT event_type FROM security_events").fetchone()[0] == "crm_profile_achievement_created"
    finally:
        server.connect = original_connect


def test_profile_visibility_is_limited_to_self_or_crm_admin() -> None:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript((ROOT / "app" / "schema.sql").read_text(encoding="utf-8"))
    db.executemany(
        "INSERT INTO users(id,name,email,access_role,crm_access_level,service_sector,active) VALUES(?,?,?,?,?,?,1)",
        (
            (1, "Gestor", "gestor@example.test", "crc", "admin", "CRC"),
            (2, "Atendente", "atendente@example.test", "crc", "attendant", "CRC"),
        ),
    )
    original_connect = server.connect
    server.connect = lambda: db
    try:
        handler = server.ClinicHandler.__new__(server.ClinicHandler)
        sent = []
        handler.send_json = lambda payload, status=HTTPStatus.OK: sent.append((payload, status))
        handler.authenticated_user = {
            "id": 2, "name": "Atendente", "access_role": "crc",
            "crm_access_level": "attendant", "permissions_json": "{}",
        }
        handler.get_crm_collaborator_profile({"user_id": ["2"]})
        assert sent[-1][1] == HTTPStatus.OK
        assert sent[-1][0]["profile"]["name"] == "Atendente"
        assert sent[-1][0]["can_manage"] is False
        assert sent[-1][0]["collaborators"] == []

        handler.get_crm_collaborator_profile({"user_id": ["1"]})
        assert sent[-1][1] == HTTPStatus.FORBIDDEN

        handler.authenticated_user = {
            "id": 1, "name": "Gestor", "access_role": "crc",
            "crm_access_level": "admin", "permissions_json": "{}",
        }
        handler.get_crm_collaborator_profile({"user_id": ["2"]})
        assert sent[-1][1] == HTTPStatus.OK
        assert sent[-1][0]["profile"]["name"] == "Atendente"
        assert sent[-1][0]["can_manage"] is True
        assert len(sent[-1][0]["collaborators"]) == 2
    finally:
        server.connect = original_connect


if __name__ == "__main__":
    test_schema_and_frontend_contract()
    test_only_crm_admin_can_create_manual_achievement()
    test_profile_visibility_is_limited_to_self_or_crm_admin()
    print("crm-collaborator-profile-tests-ok")
