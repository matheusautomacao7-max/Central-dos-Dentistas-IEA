from __future__ import annotations

import sqlite3
import sys
import types
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app"))

# The bundled test runtime intentionally does not install production-only
# image/PostgreSQL drivers. Lightweight import stubs keep this unit test local
# to goal calculations without opening a database or generating QR codes.
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


def test_goal_math() -> None:
    first, last = server.crm_goal_month_bounds("2026-08")
    assert first == date(2026, 8, 1)
    assert last == date(2026, 8, 31)
    assert server.crm_open_days_remaining(date(2026, 8, 1), first) == 26
    assert server.crm_open_days_remaining(date(2026, 8, 31), first) == 1
    assert server.crm_open_days_remaining(date(2026, 9, 1), first) == 0
    assert server.crm_goal_progress(40, 28, 8) == {
        "target": 40,
        "minimum": 0,
        "realized": 28,
        "percentage": 70.0,
        "gap": 12,
        "minimum_gap": 0,
        "minimum_reached": False,
        "required_per_open_day": 2,
        "reached": False,
    }


def test_goal_actuals_are_individual_and_ignore_internal_contacts() -> None:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE crm_contacts(id INTEGER PRIMARY KEY,is_internal INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE crm_service_resolutions(
          id INTEGER PRIMARY KEY,contact_id INTEGER,resolved_by_user_id INTEGER,resolved_at TEXT,
          patient_type TEXT,is_recovery INTEGER,category TEXT,outcome TEXT
        );
        INSERT INTO crm_contacts VALUES(1,0),(2,0),(3,0),(4,1),(5,0);
        INSERT INTO crm_service_resolutions VALUES
          (1,1,7,'2026-08-03 09:00:00','Primeira consulta',0,'Primeira consulta','Agendou'),
          (2,1,7,'2026-08-03 10:00:00','Primeira consulta',0,'Primeira consulta','Quer agendar'),
          (3,2,7,'2026-08-03 11:00:00','Retorno s/ Tratamento',0,'Controle','Agendou'),
          (4,2,7,'2026-08-03 12:00:00','Retorno s/ Tratamento',1,'Controle','Agendou'),
          (5,3,7,'2026-08-03 13:00:00','Retorno s/ Tratamento',0,'Orçamento','Outros'),
          (6,4,7,'2026-08-03 14:00:00','Primeira consulta',0,'Primeira consulta','Agendou'),
          (7,5,8,'2026-08-03 15:00:00','Primeira consulta',0,'Primeira consulta','Agendou');
    """)
    actuals = server.ClinicHandler.crm_goal_actuals(
        db, 7, date(2026, 8, 1), date(2026, 8, 31)
    )
    assert actuals == {
        "attendances": 5,
        "first_total": 2,
        "first_converted": 1,
        "recurring_total": 3,
        "recurring_converted": 2,
        "recoveries": 1,
        "first_consultations": 1,
    }


def test_schema_and_frontend_contract() -> None:
    schema = (ROOT / "app" / "schema.sql").read_text(encoding="utf-8")
    db = sqlite3.connect(":memory:")
    db.executescript(schema)
    columns = {row[1] for row in db.execute("PRAGMA table_info(crm_service_resolutions)")}
    assert {"patient_type", "is_recovery"} <= columns
    user_columns = {row[1] for row in db.execute("PRAGMA table_info(users)")}
    assert "crm_operational_agent" in user_columns
    assert "crm_access_level" in user_columns
    tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"crm_goals", "crm_goal_achievements"} <= tables

    goal_js = (ROOT / "app" / "public" / "crm-goals.js").read_text(encoding="utf-8")
    resolution_js = (ROOT / "app" / "public" / "crm-resolution-flow.js").read_text(encoding="utf-8")
    html = (ROOT / "app" / "public" / "crm-whatsapp.html").read_text(encoding="utf-8")
    assert "data-iea-goals-nav" in goal_js
    assert "prefers-reduced-motion" in goal_js
    assert "setInterval" in goal_js and "15000" in goal_js
    assert "patient_type" in resolution_js and "is_recovery" in resolution_js
    assert "/crm-goals.js" in html


def test_crm_access_levels_are_separate_from_general_admin() -> None:
    handler = server.ClinicHandler
    attendant = {"access_role": "crc", "crm_access_level": "attendant", "permissions_json": "{}"}
    crm_admin = {"access_role": "crc", "crm_access_level": "admin", "permissions_json": "{}"}
    general_admin = {"access_role": "admin", "crm_access_level": "attendant", "permissions_json": "{}"}
    assert handler.can_manage_crm(attendant) is False
    assert handler.can_manage_crm(crm_admin) is True
    assert handler.can_admin_portal(crm_admin) is False
    assert handler.can_manage_crm(general_admin) is True


def test_crm_access_level_applies_safe_defaults() -> None:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE users(
          id INTEGER PRIMARY KEY,access_role TEXT,crm_access_level TEXT,
          crm_channel_scope_enabled INTEGER,crm_feature_scope_enabled INTEGER,
          crm_operational_agent INTEGER,crm_manage_automation INTEGER
        );
        CREATE TABLE crm_channels(id INTEGER PRIMARY KEY);
        CREATE TABLE crm_user_channels(
          user_id INTEGER,channel_id INTEGER,can_reply INTEGER,can_manage_automation INTEGER
        );
        CREATE TABLE crm_user_features(user_id INTEGER,feature_key TEXT);
        INSERT INTO users VALUES(7,'crc','attendant',1,1,1,0);
        INSERT INTO crm_channels VALUES(3);
        INSERT INTO crm_user_channels VALUES(7,3,1,0);
        INSERT INTO crm_user_features VALUES(7,'inbox');
    """)
    server.ClinicHandler.replace_crm_user_channels(db, 7, "crc", "admin", {})
    admin = db.execute("SELECT * FROM users WHERE id=7").fetchone()
    assert dict(admin) == {
        "id": 7, "access_role": "crc", "crm_access_level": "admin",
        "crm_channel_scope_enabled": 0, "crm_feature_scope_enabled": 0,
        "crm_operational_agent": 0, "crm_manage_automation": 1,
    }
    assert db.execute("SELECT COUNT(*) FROM crm_user_channels").fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM crm_user_features").fetchone()[0] == 0

    server.ClinicHandler.replace_crm_user_channels(
        db, 7, "crc", "attendant", {"crm_channel_ids": [3], "crm_can_manage_automation": False}
    )
    attendant = db.execute("SELECT * FROM users WHERE id=7").fetchone()
    assert attendant["crm_access_level"] == "attendant"
    assert attendant["crm_operational_agent"] == 1
    assert attendant["crm_channel_scope_enabled"] == 1


def test_achievements_are_emitted_once_per_target() -> None:
    today = server.datetime.now(server.CLINIC_TIMEZONE).date()
    month_start = today.replace(day=1).isoformat()
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT);
        CREATE TABLE crm_contacts(id INTEGER PRIMARY KEY,is_internal INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE crm_service_resolutions(
          id INTEGER PRIMARY KEY,contact_id INTEGER,resolved_by_user_id INTEGER,resolved_at TEXT,
          patient_type TEXT,is_recovery INTEGER,category TEXT,outcome TEXT
        );
        CREATE TABLE crm_goals(
          id INTEGER PRIMARY KEY,user_id INTEGER,month_start TEXT,metric_key TEXT,
          monthly_target INTEGER,monthly_minimum INTEGER,daily_target INTEGER,daily_minimum INTEGER,
          reward_cents INTEGER,payout_threshold_percent INTEGER,achievement_bonus_percent INTEGER,
          celebration_enabled INTEGER,celebration_message TEXT
        );
        CREATE TABLE crm_goal_achievements(
          id INTEGER PRIMARY KEY AUTOINCREMENT,goal_id INTEGER,user_id INTEGER,metric_key TEXT,
          achievement_type TEXT,period_key TEXT,target_value INTEGER,realized_value INTEGER,
          message TEXT,source_resolution_id INTEGER,achieved_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id,metric_key,achievement_type,period_key,target_value)
        );
        INSERT INTO users VALUES(7,'Atendente Teste');
        INSERT INTO crm_contacts VALUES(1,0),(2,0);
    """)
    timestamp = today.isoformat() + " 10:00:00"
    db.executemany(
        "INSERT INTO crm_service_resolutions VALUES(?,?,?,?,?,?,?,?)",
        [
            (1, 1, 7, timestamp, "Primeira consulta", 0, "Primeira consulta", "Agendou"),
            (2, 2, 7, timestamp, "Retorno s/ Tratamento", 1, "Controle", "Agendou"),
        ],
    )
    db.executemany(
        "INSERT INTO crm_goals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
            (1, 7, month_start, "first_consultations", 1, 0, 1, 0, 25000, 75, 110, 1, None),
            (2, 7, month_start, "recoveries", 1, 0, 1, 0, 50000, 75, 110, 1, None),
            (3, 7, month_start, "attendances", 2, 0, 2, 0, 25000, 75, 110, 1, None),
        ],
    )
    handler = server.ClinicHandler.__new__(server.ClinicHandler)
    first = handler.crm_evaluate_goal_achievements(db, 7, 2)
    second = handler.crm_evaluate_goal_achievements(db, 7, 2)
    assert len(first) == 8
    assert second == []
    assert db.execute("SELECT COUNT(*) FROM crm_goal_achievements").fetchone()[0] == 8


def test_goal_configuration_can_be_applied_to_every_operational_agent() -> None:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript((ROOT / "app" / "schema.sql").read_text(encoding="utf-8"))
    db.executemany(
        """INSERT INTO users(
               id,name,email,password_hash,access_role,crm_access_level,crm_operational_agent,active
           ) VALUES(?,?,?,?,?,?,?,1)""",
        (
            (1, "Gestor", "gestor@example.test", "x", "crc", "admin", 0),
            (2, "Isabela", "isabela@example.test", "x", "crc", "attendant", 1),
            (3, "Defendi", "defendi@example.test", "x", "crc", "attendant", 1),
        ),
    )
    original_connect = server.connect
    server.connect = lambda: db
    try:
        handler = server.ClinicHandler.__new__(server.ClinicHandler)
        sent = []
        handler.send_json = lambda payload, status=200: sent.append((payload, status))
        handler.authenticated_user = {
            "id": 1, "name": "Gestor", "access_role": "crc",
            "crm_access_level": "admin", "permissions_json": "{}",
        }
        goal = {
            "monthly_target": 1000, "monthly_minimum": 800,
            "daily_target": 50, "daily_minimum": 40,
            "celebration_enabled": True, "celebration_message": "Meta alcançada",
        }
        handler.save_crm_goals({
            "month": "2026-08", "user_id": 2, "apply_to_all": True,
            "goals": {metric: dict(goal) for metric in server.CRM_GOAL_METRICS},
        })
        assert sent[-1][0]["applied_scope"] == "all"
        assert sent[-1][0]["applied_user_count"] == 2
        assert db.execute("SELECT COUNT(*) FROM crm_goals").fetchone()[0] == 6
        rows = db.execute(
            "SELECT DISTINCT monthly_target,monthly_minimum,daily_target,daily_minimum FROM crm_goals"
        ).fetchall()
        assert [tuple(row) for row in rows] == [(1000, 800, 50, 40)]
    finally:
        server.connect = original_connect


if __name__ == "__main__":
    test_goal_math()
    test_goal_actuals_are_individual_and_ignore_internal_contacts()
    test_schema_and_frontend_contract()
    test_crm_access_levels_are_separate_from_general_admin()
    test_crm_access_level_applies_safe_defaults()
    test_achievements_are_emitted_once_per_target()
    test_goal_configuration_can_be_applied_to_every_operational_agent()
    print("crm-goals-regression-ok")
