#!/usr/bin/env python3
"""Report only Evolution URL origins referenced by n8n workflows, never credentials."""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit


DB = Path("/var/lib/docker/volumes/n8n-czmx_n8n_data/_data/database.sqlite")
URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)


def origin(url: str) -> str | None:
    clean = url.rstrip("),.;]}")
    parts = urlsplit(clean)
    if not parts.scheme or not parts.netloc:
        return None
    return f"{parts.scheme}://{parts.netloc}"


with sqlite3.connect(f"file:{DB}?mode=ro", uri=True) as db:
    columns = {row[1] for row in db.execute("PRAGMA table_info(workflow_entity)")}
    if not {"name", "nodes"}.issubset(columns):
        raise SystemExit(json.dumps({"found": False, "reason": "schema inesperado"}))
    rows = db.execute('SELECT name, nodes FROM workflow_entity').fetchall()

origins: set[str] = set()
matching_workflows: set[str] = set()
for name, nodes_raw in rows:
    try:
        nodes = json.loads(nodes_raw or "[]")
    except json.JSONDecodeError:
        continue
    for value in strings(nodes):
        for match in URL_RE.findall(value):
            candidate = origin(match)
            if candidate and ("evolution" in candidate.lower() or "/instance/" in value.lower() or "/message/" in value.lower()):
                origins.add(candidate)
                matching_workflows.add(str(name))

print(json.dumps({
    "found": bool(origins),
    "origins": sorted(origins),
    "workflow_count": len(matching_workflows),
}, ensure_ascii=False))
