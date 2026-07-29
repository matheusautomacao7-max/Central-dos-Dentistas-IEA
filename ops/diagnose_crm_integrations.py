#!/usr/bin/env python3
"""Auditoria agregada e somente leitura das integrações; nunca imprime payloads ou credenciais."""

from __future__ import annotations

import json
import sqlite3
from collections import Counter
from pathlib import Path


CRM_DB = Path("/opt/instituto-ayub/data/clinic.db")
N8N_DB = Path("/var/lib/docker/volumes/n8n-czmx_n8n_data/_data/database.sqlite")


report: dict = {"channels": [], "webhooks": {}, "automation_events": {}, "n8n_workflows": []}

with sqlite3.connect(f"file:{CRM_DB}?mode=ro", uri=True) as db:
    db.row_factory = sqlite3.Row
    report["channels"] = [dict(row) for row in db.execute("""
        SELECT id,display_name,instance_name,connection_status,sync_enabled,last_event_at
        FROM crm_channels WHERE active=1 ORDER BY display_name
    """)]
    webhook_rows = db.execute("""
        SELECT COALESCE(NULLIF(instance_name,''),'SEM_ORIGEM') AS origin,
               COALESCE(NULLIF(event_type,''),'SEM_TIPO') AS event_type,
               processing_status,COUNT(*) AS total,MAX(received_at) AS last_received
        FROM crm_webhook_events GROUP BY origin,event_type,processing_status
        ORDER BY last_received DESC
    """).fetchall()
    report["webhooks"] = {
        "groups": [dict(row) for row in webhook_rows[:60]],
        "missing_origin": db.execute("SELECT COUNT(*) FROM crm_webhook_events WHERE TRIM(COALESCE(instance_name,''))='' ").fetchone()[0],
        "failures_last_24h": db.execute("SELECT COUNT(*) FROM crm_webhook_events WHERE processing_status='Falhou' AND received_at>=datetime('now','-24 hours')").fetchone()[0],
    }
    automation_rows = db.execute("""
        SELECT COALESCE(NULLIF(flow_name,''),'SEM_FLUXO') AS flow_name,
               COALESCE(NULLIF(event_type,''),'SEM_TIPO') AS event_type,
               COALESCE(NULLIF(outcome,''),'SEM_RESULTADO') AS outcome,
               COUNT(*) AS total,MAX(received_at) AS last_received
        FROM crm_automation_events GROUP BY flow_name,event_type,outcome
        ORDER BY last_received DESC
    """).fetchall()
    report["automation_events"] = {
        "groups": [dict(row) for row in automation_rows[:80]],
        "total": db.execute("SELECT COUNT(*) FROM crm_automation_events").fetchone()[0],
        "missing_flow": db.execute("SELECT COUNT(*) FROM crm_automation_events WHERE TRIM(COALESCE(flow_name,''))='' ").fetchone()[0],
    }

if N8N_DB.exists():
    with sqlite3.connect(f"file:{N8N_DB}?mode=ro", uri=True) as db:
        columns = {row[1] for row in db.execute("PRAGMA table_info(workflow_entity)")}
        wanted = [name for name in ("id", "name", "active", "updatedAt") if name in columns]
        if wanted:
            query = f"SELECT {','.join(wanted)} FROM workflow_entity ORDER BY name COLLATE NOCASE"
            report["n8n_workflows"] = [dict(zip(wanted, row)) for row in db.execute(query).fetchall()]

print(json.dumps(report, ensure_ascii=False, indent=2))
