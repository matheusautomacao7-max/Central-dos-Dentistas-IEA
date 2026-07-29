#!/usr/bin/env python3
"""Connect the CRM to the local Evolution installation without exposing secrets."""

from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


EVOLUTION_CONTAINER = os.environ.get("EVOLUTION_CONTAINER", "evolution-api-1myd-api-1")
CRM_DB = Path(os.environ.get("CRM_DB", "/opt/instituto-ayub/data/clinic.db"))
EXPECTED_NAMES = {"Zero Carie", "iea", "Envio em massa IEA", "Piso Terreo", "Orto"}


def container_environment() -> dict[str, str]:
    raw = subprocess.check_output(
        ["docker", "inspect", EVOLUTION_CONTAINER, "--format", "{{json .Config.Env}}"],
        text=True,
    )
    entries = json.loads(raw)
    return dict(entry.split("=", 1) for entry in entries if "=" in entry)


def fetch_instances(base_url: str, api_key: str) -> list[dict]:
    request = Request(
        f"{base_url.rstrip('/')}/instance/fetchInstances",
        headers={"apikey": api_key, "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(f"Evolution respondeu HTTP {exc.code}") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("A Evolution não respondeu pelo domínio público configurado") from exc

    items = payload if isinstance(payload, list) else payload.get("instances") or payload.get("data") or []
    if isinstance(items, dict):
        items = list(items.values())
    if not isinstance(items, list):
        raise RuntimeError("Formato inesperado na lista de instâncias da Evolution")
    return [item for item in items if isinstance(item, dict)]


def instance_summary(item: dict) -> tuple[str, bool]:
    instance = item.get("instance") if isinstance(item.get("instance"), dict) else item
    name = str(instance.get("instanceName") or instance.get("name") or "").strip()
    state = str(
        instance.get("connectionStatus")
        or instance.get("state")
        or item.get("connectionStatus")
        or ""
    ).lower()
    connected = bool(instance.get("ownerJid") or item.get("ownerJid")) or state == "open"
    return name, connected


def main() -> int:
    env = container_environment()
    base_url = str(env.get("SERVER_URL") or "").strip().rstrip("/")
    api_key = str(env.get("AUTHENTICATION_API_KEY") or "").strip()
    if not base_url.startswith("https://"):
        raise RuntimeError("SERVER_URL HTTPS não configurada no contêiner Evolution")
    if not api_key:
        raise RuntimeError("AUTHENTICATION_API_KEY não encontrada no contêiner Evolution")

    instances = fetch_instances(base_url, api_key)
    summaries = [instance_summary(item) for item in instances]
    names = {name for name, _ in summaries if name}
    expected_found = sorted(EXPECTED_NAMES.intersection(names), key=str.casefold)
    if len(expected_found) < 3:
        raise RuntimeError(
            "A instalação validada não contém as instâncias oficiais esperadas; "
            f"nomes retornados: {sorted(names, key=str.casefold)}; nenhuma alteração foi feita"
        )
    if not CRM_DB.exists():
        raise RuntimeError(f"Banco do CRM não encontrado: {CRM_DB}")

    backup_dir = CRM_DB.parent / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir / f"pre-evolution-config-{stamp}.db"
    source = sqlite3.connect(CRM_DB)
    backup = sqlite3.connect(backup_path)
    try:
        source.backup(backup)
    finally:
        backup.close()
        source.close()
    os.chmod(backup_path, 0o600)

    with sqlite3.connect(CRM_DB, timeout=30) as db:
        db.execute("PRAGMA foreign_keys=ON")
        db.execute(
            """
            INSERT INTO integration_configs(name, api_base_url, api_token, updated_at, updated_by)
            VALUES('evolution_crm', ?, ?, datetime('now', 'localtime'), NULL)
            ON CONFLICT(name) DO UPDATE SET
                api_base_url=excluded.api_base_url,
                api_token=excluded.api_token,
                updated_at=datetime('now', 'localtime')
            """,
            (base_url, api_key),
        )
        for name, connected in summaries:
            if not name:
                continue
            db.execute(
                """
                INSERT INTO crm_channels(instance_name, display_name, active, connection_status)
                VALUES(?, ?, 1, ?)
                ON CONFLICT(instance_name) DO UPDATE SET
                    active=1,
                    connection_status=excluded.connection_status,
                    updated_at=datetime('now', 'localtime')
                """,
                (name, name, "Conectado" if connected else "Desconectado"),
            )
        db.commit()

    print(json.dumps({
        "configured": True,
        "base_url": base_url,
        "instances_found": len(summaries),
        "official_instances": expected_found,
        "backup": str(backup_path),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"configured": False, "error": str(exc)}, ensure_ascii=False))
        raise SystemExit(1)
