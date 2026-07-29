"""One-time, complete and verifiable SQLite -> PostgreSQL migration."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

import psycopg
from psycopg import sql

APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR))
from db_backend import convert_schema  # noqa: E402


def canonical(value):
    if isinstance(value, bytes):
        return {"__bytes__": base64.b64encode(value).decode("ascii")}
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def table_digest(rows) -> str:
    row_hashes = []
    for row in rows:
        payload = json.dumps([canonical(value) for value in row], ensure_ascii=False, separators=(",", ":"))
        row_hashes.append(hashlib.sha256(payload.encode("utf-8")).hexdigest())
    row_hashes.sort()
    return hashlib.sha256("".join(row_hashes).encode("ascii")).hexdigest()


def sqlite_tables(source):
    return [
        row[0]
        for row in source.execute(
            """SELECT name FROM sqlite_master
               WHERE type='table' AND name NOT LIKE 'sqlite_%'
               ORDER BY name"""
        ).fetchall()
    ]


def sqlite_columns(source, table):
    return [(row[1], (row[2] or "TEXT").upper()) for row in source.execute(f'PRAGMA table_info("{table}")')]


def pg_columns(target, table):
    with target.cursor() as cursor:
        cursor.execute(
            """SELECT column_name FROM information_schema.columns
               WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position""",
            (table,),
        )
        return [row[0] for row in cursor.fetchall()]


def inferred_pg_type(sqlite_type: str) -> str:
    if "INT" in sqlite_type:
        return "BIGINT"
    if any(item in sqlite_type for item in ("REAL", "FLOA", "DOUB")):
        return "DOUBLE PRECISION"
    if "BLOB" in sqlite_type:
        return "BYTEA"
    return "TEXT"


def prepare_target(target, schema_text: str, compatibility_text: str):
    with target.cursor() as cursor:
        cursor.execute("DROP SCHEMA IF EXISTS public CASCADE")
        cursor.execute("CREATE SCHEMA public")
        cursor.execute("GRANT ALL ON SCHEMA public TO CURRENT_USER")
        cursor.execute(compatibility_text + "\n" + convert_schema(schema_text))
    target.commit()


def ensure_source_shape(target, source, tables):
    with target.cursor() as cursor:
        for table in tables:
            existing = pg_columns(target, table)
            if not existing:
                columns = sqlite_columns(source, table)
                definitions = []
                for name, sqlite_type in columns:
                    definitions.append(
                        sql.SQL("{} {}").format(sql.Identifier(name), sql.SQL(inferred_pg_type(sqlite_type)))
                    )
                cursor.execute(
                    sql.SQL("CREATE TABLE {} ({})").format(
                        sql.Identifier(table), sql.SQL(", ").join(definitions)
                    )
                )
                existing = [name for name, _ in columns]
            for name, sqlite_type in sqlite_columns(source, table):
                if name not in existing:
                    cursor.execute(
                        sql.SQL("ALTER TABLE {} ADD COLUMN {} {}").format(
                            sql.Identifier(table),
                            sql.Identifier(name),
                            sql.SQL(inferred_pg_type(sqlite_type)),
                        )
                    )
    target.commit()


def copy_all(source, target, tables):
    report = {}
    with target.cursor() as cursor:
        cursor.execute("SET session_replication_role = replica")
        # Empty the complete target before inserting anything. Truncating a
        # parent with CASCADE after its children have already been copied would
        # silently erase those child rows.
        for table in tables:
            cursor.execute(sql.SQL("TRUNCATE TABLE {} CASCADE").format(sql.Identifier(table)))
        for table in tables:
            source_columns = [name for name, _ in sqlite_columns(source, table)]
            target_columns = pg_columns(target, table)
            columns = [name for name in source_columns if name in target_columns]
            quoted_sqlite_columns = ", ".join(f'"{name}"' for name in columns)
            source_rows = source.execute(
                f'SELECT {quoted_sqlite_columns} FROM "{table}"'
            ).fetchall()
            if source_rows:
                insert = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                    sql.Identifier(table),
                    sql.SQL(", ").join(map(sql.Identifier, columns)),
                    sql.SQL(", ").join(sql.Placeholder() for _ in columns),
                )
                cursor.executemany(insert, [tuple(row) for row in source_rows])
            report[table] = {"source_count": len(source_rows), "columns": columns}
        cursor.execute("SET session_replication_role = origin")
    target.commit()
    return report


def reset_identity_sequences(target):
    with target.cursor() as cursor:
        cursor.execute(
            """SELECT table_name, column_name
                 FROM information_schema.columns
                WHERE table_schema='public' AND is_identity='YES'"""
        )
        identities = cursor.fetchall()
        for table, column in identities:
            cursor.execute(
                sql.SQL("SELECT COALESCE(MAX({}), 0) FROM {}").format(
                    sql.Identifier(column), sql.Identifier(table)
                )
            )
            maximum = int(cursor.fetchone()[0] or 0)
            cursor.execute("SELECT pg_get_serial_sequence(%s, %s)", (f"public.{table}", column))
            sequence = cursor.fetchone()[0]
            if sequence:
                cursor.execute("SELECT setval(%s, %s, %s)", (sequence, max(maximum, 1), maximum > 0))
    target.commit()


def validate(source, target, tables, report):
    valid = True
    with target.cursor() as cursor:
        for table in tables:
            columns = report[table]["columns"]
            quoted_sqlite_columns = ", ".join(f'"{name}"' for name in columns)
            source_rows = source.execute(f'SELECT {quoted_sqlite_columns} FROM "{table}"').fetchall()
            cursor.execute(
                sql.SQL("SELECT {} FROM {}").format(
                    sql.SQL(", ").join(map(sql.Identifier, columns)), sql.Identifier(table)
                )
            )
            target_rows = cursor.fetchall()
            source_hash = table_digest(source_rows)
            target_hash = table_digest(target_rows)
            row_valid = len(source_rows) == len(target_rows) and source_hash == target_hash
            report[table].update(
                {
                    "target_count": len(target_rows),
                    "source_hash": source_hash,
                    "target_hash": target_hash,
                    "valid": row_valid,
                }
            )
            valid = valid and row_valid
    return valid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sqlite", required=True)
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--replace-target", action="store_true", required=True)
    args = parser.parse_args()

    source_path = Path(args.sqlite)
    if not source_path.is_file():
        raise SystemExit(f"SQLite não encontrado: {source_path}")
    source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
    source.row_factory = sqlite3.Row
    target = psycopg.connect(args.database_url)
    tables = sqlite_tables(source)
    report = {"source": str(source_path), "tables": {}, "valid": False}
    try:
        prepare_target(
            target,
            (APP_DIR / "schema.sql").read_text(encoding="utf-8"),
            (APP_DIR / "postgres_compat.sql").read_text(encoding="utf-8"),
        )
        ensure_source_shape(target, source, tables)
        report["tables"] = copy_all(source, target, tables)
        reset_identity_sequences(target)
        report["valid"] = validate(source, target, tables, report["tables"])
    finally:
        source.close()
        target.close()
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if not report["valid"]:
        raise SystemExit("MIGRAÇÃO REPROVADA: contagem ou hash divergente.")
    print(f"MIGRAÇÃO VALIDADA: {len(tables)} tabelas, dados e hashes idênticos.")


if __name__ == "__main__":
    main()
