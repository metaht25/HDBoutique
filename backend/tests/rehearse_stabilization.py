"""Compare every business/security table and identity after a synthetic restore."""

import hashlib
import json
import os
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Engine, func, inspect, select, text

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from data_migration.target import target_engine
from tests.rehearsal_helpers import require_isolated_rehearsal


def encode(value: object) -> str:
    if isinstance(value, (Decimal, date, datetime)):
        return str(value)
    raise TypeError("Unsupported snapshot value")


def snapshot(engine: Engine) -> dict[str, object]:
    result: dict[str, object] = {}
    with engine.connect() as connection:
        names = set(inspect(connection).get_table_names())
        expected = set(Base.metadata.tables) | {"alembic_version"}
        if names != expected:
            raise RuntimeError("Rehearsal schema differs from current metadata")
        version = connection.scalar(text("SELECT version_num FROM alembic_version"))
        if version != "0004_atomic_sales":
            raise RuntimeError("Unexpected Alembic head")
        for table in Base.metadata.sorted_tables:
            rows = [
                dict(row)
                for row in connection.execute(
                    select(table).order_by(*table.primary_key.columns)
                ).mappings()
            ]
            digest = hashlib.sha256(
                json.dumps(
                    rows, sort_keys=True, default=encode, ensure_ascii=True
                ).encode()
            ).hexdigest()
            result[table.name] = {"count": len(rows), "sha256": digest}
            for column in table.columns:
                if column.identity is not None:
                    sequence = connection.scalar(
                        text("SELECT pg_get_serial_sequence(:name, :column)"),
                        {"name": table.name, "column": column.name},
                    )
                    sequence_name = sequence.split(".")[-1].strip('"')
                    last = connection.scalar(
                        text(
                            "SELECT last_value FROM pg_sequences "
                            "WHERE schemaname='public' AND sequencename=:name"
                        ),
                        {"name": sequence_name},
                    )
                    maximum = connection.scalar(select(func.max(column)))
                    if maximum is not None and (last is None or last < maximum):
                        raise RuntimeError(
                            "Identity could collide with restored records"
                        )
                    result[sequence] = last
        result["head"] = version
    return result


def main() -> None:
    require_isolated_rehearsal()
    engines = []
    try:
        snapshots = []
        for name in ("hdboutique_test", "hdboutique_restore_test"):
            os.environ["HDB_MIGRATION_DATABASE_NAME"] = name
            engine = target_engine(name)
            engines.append(engine)
            snapshots.append(snapshot(engine))
        if snapshots[0] != snapshots[1]:
            raise RuntimeError(
                "Restored rows, monetary values, history or identities differ"
            )
        print(
            "Synthetic restore verified: 24 tables, exact field hashes, "
            "identities and Alembic head; no values printed"
        )
    finally:
        for engine in engines:
            engine.dispose()


if __name__ == "__main__":
    main()
