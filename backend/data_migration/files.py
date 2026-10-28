"""Versioned local artifacts. Exports contain private data; reports omit values."""

import json
import os
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from data_migration.mapping import MAPPING_VERSION, MAPPINGS

type Row = dict[str, object]
type Tables = dict[str, list[Row]]


class MigrationError(Exception):
    """Static operator message, without driver errors or source values."""


def json_value(value: object) -> str:
    if isinstance(value, Decimal) and value.is_finite():
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise MigrationError("Unsupported export value; no implicit conversion performed")


def write_document(path: Path, document: object) -> None:
    # Exclusive creation prevents overwriting evidence, exports or backups.
    payload = (
        json.dumps(
            document, default=json_value, ensure_ascii=False, indent=2, allow_nan=False
        )
        + "\n"
    )
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)


def read_document(path: Path) -> object:
    def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise MigrationError("Duplicate JSON key")
            result[key] = value
        return result

    def reject_constant(value: str) -> object:
        raise MigrationError("Non-finite JSON number")

    return json.loads(
        path.read_text(encoding="utf-8"),
        parse_float=Decimal,
        parse_constant=reject_constant,
        object_pairs_hook=reject_duplicate_keys,
    )


def bundle(tables: Tables, *, stage: str) -> dict[str, object]:
    return {
        "format_version": 1,
        "mapping_version": MAPPING_VERSION,
        "stage": stage,
        "tables": tables,
    }


def read_bundle(path: Path, *, stage: str) -> Tables:
    document = read_document(path)
    if (
        not isinstance(document, dict)
        or document.get("format_version") != 1
        or document.get("mapping_version") != MAPPING_VERSION
        or document.get("stage") != stage
        or not isinstance(document.get("tables"), dict)
    ):
        raise MigrationError("Invalid or incompatible dataset manifest")
    tables = document["tables"]
    expected = {item.source if stage == "source" else item.target for item in MAPPINGS}
    if set(tables) != expected:
        raise MigrationError("Dataset must contain exactly the 17 mapped tables")
    result: Tables = {}
    for name, rows in tables.items():
        if not isinstance(rows, list):
            raise MigrationError("Invalid table rows")
        result[name] = []
        for row in rows:
            if not isinstance(row, dict) or not all(isinstance(k, str) for k in row):
                raise MigrationError("Invalid dataset row")
            result[name].append(row)
    return result
