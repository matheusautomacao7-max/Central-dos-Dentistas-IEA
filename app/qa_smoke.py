"""Teste integrado reversível das regras críticas da ficha do paciente.

Reescrito para PostgreSQL: cria seu próprio servidor efêmero e seu próprio
paciente de teste (como qa_features.py já faz), em vez de depender de um
PATIENT_ID fixo e de sqlite3.connect() direto num arquivo que não existe
mais desde a migração para PostgreSQL (ver relatório de qualidade,
2026-07-29, achado "qa_smoke.py bloqueado").

Usa duas contas de teste porque as regras de acesso não se sobrepõem:
- "owner" cria o paciente e resolve/reabre o dia (rotas POST bloqueadas
  para o papel "crc").
- "crc" edita procedimentos/desconto (campos controlados exclusivamente
  pela CRC, ver can_manage_crc_fields).
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import threading
import urllib.error
import urllib.request
from datetime import date, timedelta

import server

CRC_TEST_EMAIL = "qa.smoke.crc@iea.local"
CRC_TEST_PASSWORD = "qa-smoke-crc-pass-1"
OWNER_TEST_PASSWORD = "qa-suite-temp-pass-1"
TEST_ACTION = "Validação automática — ação reutilizável"


def ensure_crc_test_user() -> None:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", CRC_TEST_PASSWORD.encode("utf-8"), salt.encode("utf-8"), 600_000).hex()
    with server.connect() as db:
        existing = db.execute("SELECT id FROM users WHERE email=?", (CRC_TEST_EMAIL,)).fetchone()
        if existing:
            db.execute(
                "UPDATE users SET password_hash=?, password_salt=?, active=1, two_factor_exempt=1 WHERE id=?",
                (digest, salt, existing["id"]),
            )
        else:
            db.execute(
                "INSERT INTO users (name, email, access_role, active, password_hash, password_salt, "
                "must_change_password, two_factor_exempt, service_sector) VALUES (?,?,?,?,?,?,?,?,?)",
                ("QA Smoke CRC", CRC_TEST_EMAIL, "crc", 1, digest, salt, 0, 1, "CRC"),
            )


def cleanup_test_patients() -> None:
    with server.connect() as db:
        ids = [row["id"] for row in db.execute(
            "SELECT id FROM patients WHERE name LIKE 'Paciente temporário QA smoke%'"
        ).fetchall()]
        for patient_id in ids:
            for table in (
                "daily_resolutions", "patient_events", "procedures", "patient_relationships",
                "patient_clinical_profile", "patient_followup", "patient_assignments",
            ):
                db.execute(f"DELETE FROM {table} WHERE patient_id = ?", (patient_id,))
            db.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        db.execute("DELETE FROM action_templates WHERE description = ?", (TEST_ACTION,))


def main() -> None:
    server.initialize_database()
    cleanup_test_patients()
    httpd = server.ClinicServer(("127.0.0.1", 0), server.ClinicHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{httpd.server_port}"
    active_cookie: str | None = None

    def request(path: str, method: str = "GET", body: dict | None = None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"}
        if active_cookie:
            headers["Cookie"] = active_cookie
        req = urllib.request.Request(base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def login(email: str, password: str) -> str:
        login_req = urllib.request.Request(
            base + "/api/auth/login",
            data=json.dumps({"email": email, "password": password}).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(login_req, timeout=5) as response:
            cookie_header = response.headers.get("Set-Cookie", "")
        return cookie_header.split(";", 1)[0]

    def login_owner() -> str:
        setup_token = os.environ.get("AUTH_SETUP_TOKEN", "")
        with server.connect() as db:
            owner_email = db.execute(
                "SELECT email FROM users WHERE access_role='owner' AND active=1 ORDER BY id LIMIT 1"
            ).fetchone()["email"]
        try:
            urllib.request.urlopen(
                urllib.request.Request(
                    base + "/api/auth/setup",
                    data=json.dumps({"setup_token": setup_token, "password": OWNER_TEST_PASSWORD}).encode("utf-8"),
                    method="POST",
                    headers={"Content-Type": "application/json"},
                ),
                timeout=5,
            )
        except urllib.error.HTTPError as error:
            if error.code != 409:  # já ativada por uma rodada anterior
                raise
        return login(owner_email, OWNER_TEST_PASSWORD)

    ensure_crc_test_user()
    owner_cookie = login_owner()
    crc_cookie = login(CRC_TEST_EMAIL, CRC_TEST_PASSWORD)

    try:
        active_cookie = owner_cookie
        create_payload = {
            "name": "Paciente temporário QA smoke",
            "last_visit": (date.today() - timedelta(days=5)).isoformat(),
            "status": "Controle",
            "procedures": [],
            "next_action": "",
            "phone": None,
            "last_contact": None,
            "reference": None,
            "notes": "",
        }
        status, created = request("/api/patients", "POST", create_payload)
        assert status in (200, 201), (status, created)
        created_id = created["id"]

        # Regra: desconto em procedimento deve reduzir o valor potencial
        # (procedimentos só podem ser definidos pela CRC, via a rota dedicada
        # /api/patients/{id}/crc — a rota geral de PATCH bloqueia o papel crc).
        active_cookie = crc_cookie
        crc_payload = {
            "procedures": [
                {
                    "name": "Validação automática de desconto",
                    "value_cents": 100_000,
                    "discount_cents": 10_000,
                    "stage": "Indicado",
                    "notes": "",
                }
            ],
            "crc_status": "Aguardando contato",
        }
        status, updated = request(f"/api/patients/{created_id}/crc", "PATCH", crc_payload)
        assert status == 200, updated
        assert updated["procedures"][0]["discount_cents"] == 10_000
        assert updated["potential_value_cents"] == 90_000

        # Regra: a próxima ação digitada deve ficar disponível como sugestão reutilizável.
        # (o papel "owner" não administra procedimentos — precisa reenviar os
        # mesmos procedimentos já salvos pela CRC, sem alterá-los.)
        active_cookie = owner_cookie
        owner_payload = {**create_payload, "next_action": TEST_ACTION, "procedures": updated["procedures"]}
        status, body = request(f"/api/patients/{created_id}", "PATCH", owner_payload)
        assert status == 200, body
        status, templates = request("/api/action-templates")
        assert status == 200
        assert TEST_ACTION in {item["description"] for item in templates["items"]}

        # Regra: paciente resolvido hoje trava edição (bloqueio diário).
        status, _ = request(f"/api/patients/{created_id}/resolve", "POST", {"resolved": True})
        assert status == 200
        status, locked = request(f"/api/patients/{created_id}")
        assert status == 200 and locked["is_resolved_today"] == 1

        locked_payload = {**create_payload, "notes": "Esta alteração deve ser recusada"}
        status, error = request(f"/api/patients/{created_id}", "PATCH", locked_payload)
        assert status == 409 and "bloqueado" in error["error"].lower(), (status, error)

        # Reabrir libera a edição de novo (rota dedicada "área Verificados",
        # exige confirmação de senha; POST /resolve com resolved=False é
        # sempre recusado por design).
        status, _ = request(f"/api/patients/{created_id}/reopen-with-password", "POST", {"password": OWNER_TEST_PASSWORD})
        assert status == 200
        status, reopened = request(f"/api/patients/{created_id}")
        assert status == 200 and reopened["is_resolved_today"] == 0

        print("QA smoke aprovado; removendo dados temporários...")
    finally:
        cleanup_test_patients()
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=2)


if __name__ == "__main__":
    main()
