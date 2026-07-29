"""Teste integrado e reversível do painel administrativo."""

from __future__ import annotations

import json
import os
import threading
import urllib.error
import urllib.request

import server


MARKER = "QA ADMIN TEMP"


def cleanup() -> None:
    with server.connect() as db:
        patient_ids = [row[0] for row in db.execute(
            "SELECT id FROM patients WHERE name LIKE ?", (f"%{MARKER}%",)
        )]
        for patient_id in patient_ids:
            for table in (
                "daily_resolutions", "patient_events", "procedures", "patient_relationships",
                "patient_clinical_profile", "patient_followup", "patient_assignments",
            ):
                db.execute(f"DELETE FROM {table} WHERE patient_id = ?", (patient_id,))
            db.execute("DELETE FROM patients WHERE id = ?", (patient_id,))

        professional_ids = [row[0] for row in db.execute(
            "SELECT id FROM professionals WHERE name LIKE ?", (f"%{MARKER}%",)
        )]
        for professional_id in professional_ids:
            db.execute("DELETE FROM users WHERE professional_id = ?", (professional_id,))
            db.execute("DELETE FROM professional_specialties WHERE professional_id = ?", (professional_id,))
            db.execute("DELETE FROM professional_offices WHERE professional_id = ?", (professional_id,))
            db.execute("DELETE FROM professionals WHERE id = ?", (professional_id,))

        db.execute("DELETE FROM specialties WHERE name LIKE ?", (f"%{MARKER}%",))
        db.execute("DELETE FROM offices WHERE name LIKE ?", (f"%{MARKER}%",))


def main() -> None:
    server.initialize_database()
    cleanup()
    with server.connect() as db:
        patient_count = db.execute("SELECT COUNT(*) FROM patients").fetchone()[0]

    httpd = server.ClinicServer(("127.0.0.1", 0), server.ClinicHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{httpd.server_port}"
    session_cookie: str | None = None

    def request(path: str, method: str = "GET", body: dict | None = None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"}
        if session_cookie:
            headers["Cookie"] = session_cookie
        req = urllib.request.Request(base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def login_as_owner() -> str:
        nonlocal session_cookie
        setup_token = os.environ.get("AUTH_SETUP_TOKEN", "")
        password = "qa-suite-temp-pass-1"
        with server.connect() as db:
            owner_email = db.execute("SELECT email FROM users WHERE access_role='owner' AND active=1 ORDER BY id LIMIT 1").fetchone()["email"]
        setup_req = urllib.request.Request(
            base + "/api/auth/setup",
            data=json.dumps({"setup_token": setup_token, "password": password}).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(setup_req, timeout=5)
        except urllib.error.HTTPError as error:
            if error.code != 409:  # already activated by a previous run; fine, just log in
                raise
        login_req = urllib.request.Request(
            base + "/api/auth/login",
            data=json.dumps({"email": owner_email, "password": password}).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(login_req, timeout=5) as response:
            cookie_header = response.headers.get("Set-Cookie", "")
        session_cookie = cookie_header.split(";", 1)[0]
        return session_cookie

    login_as_owner()
    try:
        status, overview = request("/api/admin")
        assert status == 200 and overview["summary"]["patients"] == patient_count

        status, specialty = request(
            "/api/admin/specialties", "POST", {"name": f"Especialidade {MARKER}"}
        )
        assert status == 201
        status, office = request(
            "/api/admin/offices", "POST", {"name": f"Consultório {MARKER}"}
        )
        assert status == 201

        professional_payload = {
            "name": f"Dra. {MARKER}",
            "email": "qa.admin.temp@iea.local",
            "role": "Cirurgião-dentista",
            "access_role": "professional",
            "specialty_id": specialty["id"],
            "office_id": office["id"],
            "office_responsible": True,
            "active": True,
            "temporary_password": "qa-temp-password-1",
        }
        status, professional = request("/api/admin/professionals", "POST", professional_payload)
        assert status == 201
        professional_payload["role"] = "Especialista QA"
        status, updated = request(
            f"/api/admin/professionals/{professional['id']}", "PATCH", professional_payload
        )
        assert status == 200 and updated["updated"] is True

        import_rows = [{
            "name": f"Paciente {MARKER}",
            "last_visit": "2026-07-14",
            "status": "Controle",
            "professional_email": professional_payload["email"],
        }]
        status, validation = request(
            "/api/admin/import/patients", "POST", {"rows": import_rows, "dry_run": True}
        )
        assert status == 200 and validation["valid"] == 1 and validation["imported"] == 0
        status, imported = request(
            "/api/admin/import/patients", "POST", {"rows": import_rows, "dry_run": False}
        )
        assert status == 200 and imported["imported"] == 1

        status, audit = request("/api/admin/audit?limit=10")
        assert status == 200 and any(item["event_type"] == "Importação" for item in audit["items"])
    finally:
        cleanup()
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=2)

    with server.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == patient_count
        assert db.execute("SELECT COUNT(*) FROM patients WHERE name LIKE ?", (f"%{MARKER}%",)).fetchone()[0] == 0
    print(f"QA administrativo aprovado; {patient_count} pacientes preservados.")


if __name__ == "__main__":
    main()
