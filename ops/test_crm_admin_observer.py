from pathlib import Path
import sqlite3


ROOT = Path(__file__).resolve().parents[1]


def test_non_operational_crc_profile() -> None:
    schema = (ROOT / "app" / "schema.sql").read_text(encoding="utf-8")
    source = (ROOT / "app" / "server.py").read_text(encoding="utf-8")
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript(schema)

    user_columns = {row[1] for row in db.execute("PRAGMA table_info(users)")}
    assert "crm_operational_agent" in user_columns

    db.executemany(
        """INSERT INTO users(name,email,access_role,active,crm_channel_scope_enabled,
                              crm_feature_scope_enabled,crm_operational_agent)
             VALUES(?,?,?,?,?,?,?)""",
        [
            ("Gestor de testes", "gestor@example.test", "crc", 1, 0, 0, 0),
            ("Atendente A", "a@example.test", "crc", 1, 1, 1, 1),
            ("Atendente B", "b@example.test", "crc", 1, 1, 1, 1),
        ],
    )
    operational = db.execute(
        """SELECT name FROM users
             WHERE access_role='crc' AND active=1
               AND COALESCE(crm_operational_agent,1)=1
             ORDER BY name"""
    ).fetchall()
    assert [row["name"] for row in operational] == ["Atendente A", "Atendente B"]

    manager = db.execute(
        """SELECT crm_channel_scope_enabled,crm_feature_scope_enabled,crm_operational_agent
             FROM users WHERE email='gestor@example.test'"""
    ).fetchone()
    assert tuple(manager) == (0, 0, 0)

    assert "ALTER TABLE users ADD COLUMN crm_operational_agent" in source
    assert source.count("COALESCE(crm_operational_agent,1)=1") >= 3
    assert source.count("COALESCE(u.crm_operational_agent,1)=1") >= 2


if __name__ == "__main__":
    test_non_operational_crc_profile()
    print("crm-admin-observer-regression-ok")
