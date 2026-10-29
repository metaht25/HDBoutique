"""Read-only field/identity fingerprints for an explicitly named database."""

import argparse
import hashlib
import json
import os
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, MetaData, Table, inspect, select, text

from app.core.config import Settings
from app.infrastructure.database.connection import build_engine


def encode(value: object) -> str:
    if isinstance(value, (Decimal, date, datetime)):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    raise TypeError("Unsupported snapshot value")


def capture(engine: Engine) -> dict[str, Any]:
    result: dict[str, Any] = {"tables": {}, "sequences": {}}
    with engine.connect().execution_options(
        isolation_level="REPEATABLE READ"
    ) as connection:
        connection.execute(text("SET TRANSACTION READ ONLY"))
        connection.execute(text("SET LOCAL TIME ZONE 'UTC'"))
        inspector = inspect(connection)
        for name in sorted(inspector.get_table_names(schema="public")):
            table = Table(name, MetaData(), schema="public", autoload_with=connection)
            if not list(table.primary_key):
                raise ValueError("A stable primary key is required for fingerprints")
            digest = hashlib.sha256()
            count = 0
            for row in connection.execute(
                select(table).order_by(*table.primary_key.columns)
            ).mappings():
                digest.update(
                    json.dumps(dict(row), sort_keys=True, default=encode).encode()
                )
                digest.update(b"\n")
                count += 1
            result["tables"][name] = {
                "count": count,
                "sha256": digest.hexdigest(),
                "columns": [
                    {
                        "name": column.name,
                        "type": str(column.type),
                        "nullable": column.nullable,
                    }
                    for column in table.columns
                ],
            }
        quote = connection.dialect.identifier_preparer.quote
        for sequence in connection.execute(
            text(
                "SELECT sequencename, start_value, increment_by, min_value, max_value, "
                "cycle FROM pg_sequences WHERE schemaname='public' "
                "ORDER BY sequencename"
            )
        ).mappings():
            name = sequence["sequencename"]
            state = (
                connection.execute(
                    text("SELECT last_value, is_called FROM public." + quote(name))
                )
                .mappings()
                .one()
            )
            result["sequences"][name] = {**dict(sequence), **dict(state)}
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    engine = None
    try:
        settings = Settings()
        if args.database != settings.database_name:
            raise ValueError("Explicit database must match configured target")
        if args.output.exists():
            raise ValueError("Evidence already exists")
        engine = build_engine(settings)
        if engine is None:
            raise ValueError("Explicit database configuration required")
        result = capture(engine)
        descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(result, handle, sort_keys=True, indent=2)
            handle.write("\n")
        print("Read-only database fingerprints saved; no raw values exported")
        return 0
    except Exception:
        print("Snapshot failed; check the explicit target and private evidence path")
        return 2
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
