"""Authenticated production smoke test for the two core CRM read endpoints."""
from __future__ import annotations

import hashlib
import json
import secrets
import sys
from datetime import datetime, timedelta
from urllib.request import Request, urlopen

sys.path.insert(0, "/app")
from server import connect


token = secrets.token_urlsafe(32)
token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

with connect() as db:
    user = db.execute(
        """
        SELECT id
          FROM users
         WHERE active=1 AND access_role IN ('crc','admin')
         ORDER BY CASE WHEN access_role='crc' THEN 0 ELSE 1 END, id
         LIMIT 1
        """
    ).fetchone()
    if not user:
        raise RuntimeError("No active CRM user is available for the smoke test.")
    db.execute(
        "INSERT INTO auth_sessions (user_id,token_hash,expires_at) VALUES (?,?,?)",
        (
            user["id"],
            token_hash,
            (datetime.utcnow() + timedelta(minutes=5)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
    )

try:
    for path in (
        "/api/crm/conversations?view=operational",
        "/api/crm/conversations?view=queue&search=",
        "/api/crm/metrics",
        "/api/crm/agents",
        "/api/crm/resolution-reports?period=30d",
        "/api/crm/patient-control?period=30d&page=1&per_page=10",
        "/api/journey/professionals",
        "/api/dashboard",
        "/api/patients?search=&status=&next_schedule=&attention=&month=&professional=&crc_stage=&patient=null&per_page=50",
    ):
        request = Request(
            f"http://127.0.0.1:8000{path}",
            headers={"Cookie": f"iea_session={token}"},
        )
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
            print(
                json.dumps(
                    {
                        "path": path,
                        "status": response.status,
                        "payload_type": type(payload).__name__,
                        "keys": sorted(payload.keys()) if isinstance(payload, dict) else [],
                    },
                    ensure_ascii=False,
                )
            )
finally:
    with connect() as db:
        db.execute("DELETE FROM auth_sessions WHERE token_hash=?", (token_hash,))
