from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path


CRM_DB = Path("/opt/instituto-ayub/data/clinic.db")
N8N_DB = Path("/var/lib/docker/volumes/n8n-czmx_n8n_data/_data/database.sqlite")
PERSISTED_CONFIG = Path("/opt/instituto-ayub/data/n8n-crm-config.json")
N8N_INTERNAL_URL = "http://n8n-czmx-n8n-1:5678"


def main() -> None:
    if not CRM_DB.exists():
        raise SystemExit("Banco do CRM não encontrado.")
    if not N8N_DB.exists():
        raise SystemExit("Banco interno do n8n não encontrado.")

    with sqlite3.connect(f"file:{N8N_DB}?mode=ro", uri=True) as n8n:
        row = n8n.execute(
            """SELECT apiKey
               FROM user_api_keys
               WHERE apiKey IS NOT NULL AND trim(apiKey) != ''
               ORDER BY COALESCE(lastUsedAt, updatedAt, createdAt) DESC
               LIMIT 1"""
        ).fetchone()
    if not row or not str(row[0]).strip():
        raise SystemExit("Nenhuma chave de API ativa foi localizada no n8n.")
    api_key = str(row[0]).strip()

    with sqlite3.connect(CRM_DB) as crm:
        existing = crm.execute(
            """SELECT id FROM api_integrations
               WHERE lower(name) IN ('n8n', 'n8n crm', 'n8n · automações e ia')
               ORDER BY CASE WHEN lower(name)='n8n' THEN 0 ELSE 1 END, id
               LIMIT 1"""
        ).fetchone()
        if existing:
            crm.execute(
                """UPDATE api_integrations
                   SET name='n8n',
                       description=?,
                       api_base_url=?,
                       api_token=?,
                       active=1,
                       updated_at=datetime('now','localtime')
                   WHERE id=?""",
                (
                    "Controla fluxos, execuções e eventos de automação do CRM.",
                    N8N_INTERNAL_URL,
                    api_key,
                    existing[0],
                ),
            )
        else:
            crm.execute(
                """INSERT INTO api_integrations
                   (name, description, api_base_url, api_token, active, sync_interval_seconds)
                   VALUES ('n8n', ?, ?, ?, 1, 60)""",
                (
                    "Controla fluxos, execuções e eventos de automação do CRM.",
                    N8N_INTERNAL_URL,
                    api_key,
                ),
            )

    payload = {
        "api_base_url": N8N_INTERNAL_URL,
        "api_token": api_key,
        "active": True,
        "updated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    temporary = PERSISTED_CONFIG.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    os.chmod(temporary, 0o600)
    os.replace(temporary, PERSISTED_CONFIG)
    os.chmod(PERSISTED_CONFIG, 0o600)

    print("Configuração n8n restaurada sem exibir a credencial.")


if __name__ == "__main__":
    main()
