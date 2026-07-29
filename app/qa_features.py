"""Teste reversível das melhorias clínicas, vínculos e filtros."""

from __future__ import annotations

import json
import os
import threading
import urllib.error
import urllib.request
from datetime import date, timedelta

import server

OWNER_TEST_PASSWORD = "qa-suite-temp-pass-1"


def cleanup_test_patients() -> None:
    with server.connect() as db:
        ids = [row[0] for row in db.execute(
            "SELECT id FROM patients WHERE name LIKE 'Paciente temporário QA%'"
        ).fetchall()]
        for patient_id in ids:
            for table in (
                "daily_resolutions", "patient_events", "procedures", "patient_relationships",
                "patient_clinical_profile", "patient_followup", "patient_assignments",
            ):
                db.execute(f"DELETE FROM {table} WHERE patient_id = ?", (patient_id,))
            db.execute("DELETE FROM patients WHERE id = ?", (patient_id,))


def main() -> None:
    server.initialize_database()
    cleanup_test_patients()
    httpd = server.ClinicServer(("127.0.0.1", 0), server.ClinicHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{httpd.server_port}"
    created_id: int | None = None
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

    def login_as_owner() -> None:
        nonlocal session_cookie
        setup_token = os.environ.get("AUTH_SETUP_TOKEN", "")
        password = OWNER_TEST_PASSWORD
        with server.connect() as db:
            owner_email = db.execute(
                "SELECT email FROM users WHERE access_role='owner' AND active=1 ORDER BY id LIMIT 1"
            ).fetchone()["email"]
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    base + "/api/auth/setup",
                    data=json.dumps({"setup_token": setup_token, "password": password}).encode("utf-8"),
                    method="POST",
                    headers={"Content-Type": "application/json"},
                ),
                timeout=5,
            )
        except urllib.error.HTTPError as error:
            if error.code != 409:  # already activated by a previous run
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

    login_as_owner()
    payload = {
        "name": "Paciente temporário QA recursos clínicos",
        "last_visit": (date.today() - timedelta(days=10)).isoformat(),
        "status": "Controle",
        "next_appointment": (date.today() + timedelta(days=15)).isoformat(),
        "next_appointment_type": "Agendado",
        "procedures": [],
        "next_action": "Confirmar retorno",
        "phone": "",
        "last_contact": "",
        "reference": "QA",
        "notes": "Observação no acompanhamento",
        "particularities": "Prefere atendimento pela manhã",
        "health_change": True,
        "health_condition": "Alergia medicamentosa",
        "health_care": "Confirmar medicação antes do procedimento",
        "relationships": [
            {"relationship_type": "Mãe", "related_name": "Maria QA", "connection": "Responsável financeira"},
            {"relationship_type": "Irmão", "related_name": "João QA", "connection": "Indicação"},
        ],
    }

    try:
        status, created = request("/api/patients", "POST", payload)
        assert status in (200, 201)
        created_id = created["id"]
        assert created["health_change"] == 1
        assert created["particularities"] == payload["particularities"]
        assert len(created["relationships"]) == 2
        assert created["relationships"][0]["connection"] == "Responsável financeira"

        status, filtered = request("/api/patients?next_schedule=scheduled&sort=next_asc&per_page=100")
        assert status == 200
        assert created_id in {item["id"] for item in filtered["items"]}

        status, related_search = request("/api/patients?search=Maria%20QA&per_page=100")
        assert status == 200
        assert created_id in {item["id"] for item in related_search["items"]}

        payload["relationships"] = [{"relationship_type": "Pai", "related_name": "Carlos QA", "connection": "Contato principal"}]
        payload["health_care"] = "Cuidado atualizado"
        # O papel "owner" (usado neste teste) não administra os campos de CRC;
        # o servidor já os zera na criação, então repassá-los inalterados aqui
        # evita o 403 "Contato e referência são controlados pela CRC".
        payload["phone"] = None
        payload["reference"] = None
        payload["last_contact"] = None
        status, updated = request(f"/api/patients/{created_id}", "PATCH", payload)
        assert status == 200
        assert updated["health_care"] == "Cuidado atualizado"
        assert updated["relationships"][0]["related_name"] == "Carlos QA"
        assert updated["relationships"][0]["connection"] == "Contato principal"

        status, deleted = request(f"/api/patients/{created_id}", "DELETE", {"password": OWNER_TEST_PASSWORD})
        assert status == 200 and deleted["deleted"] is True
        created_id = None
        print("QA das melhorias aprovado; dados temporários removidos.")
    finally:
        if created_id is not None:
            request(f"/api/patients/{created_id}", "DELETE", {"password": OWNER_TEST_PASSWORD})
        cleanup_test_patients()
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=2)


if __name__ == "__main__":
    main()
