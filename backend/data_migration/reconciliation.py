"""Exact per-field reconciliation, aggregate profiles and private-data-free reports."""

import hashlib
import json
import unicodedata
from collections import Counter
from decimal import Decimal

from sqlalchemy import Integer, Numeric, String

from data_migration.files import Row, Tables, json_value
from data_migration.mapping import MAPPING_VERSION, MAPPINGS


def profile(tables: Tables) -> dict[str, object]:
    summaries: dict[str, object] = {}
    for item in MAPPINGS:
        rows = tables[item.target]
        columns: dict[str, object] = {}
        for column in item.table.c:
            values = [row[column.name] for row in rows if row[column.name] is not None]
            summary: Row = {"nulls": len(rows) - len(values)}
            if isinstance(column.type, (Integer, Numeric)):
                numbers = [Decimal(str(value)) for value in values]
                summary.update(
                    sum=str(sum(numbers, Decimal(0))),
                    negatives=sum(value < 0 for value in numbers),
                )
            if isinstance(column.type, String):
                counts = Counter(str(value) for value in values)
                folded = Counter(
                    unicodedata.normalize("NFKC", str(v)).casefold() for v in values
                )
                summary["exact_duplicate_excess"] = sum(n - 1 for n in counts.values())
                summary["normalized_duplicate_excess"] = sum(
                    n - 1 for n in folded.values()
                )
            columns[column.name] = summary
        summaries[item.target] = {"count": len(rows), "columns": columns}
    sales = {row["sale_id"]: row for row in tables["sales"]}
    line_totals: dict[object, Decimal] = {}
    for line in tables["sale_items"]:
        key = line["sale_id"]
        line_totals[key] = line_totals.get(key, Decimal(0)) + (
            Decimal(str(line["quantity"])) * Decimal(str(line["unit_price"]))
        )
    return {
        "mapping_version": MAPPING_VERSION,
        "tables": summaries,
        "observations": {
            "separate_stock_disagreements": sum(
                row["legacy_stock_quantity"] != row["legacy_stock"]
                for row in tables["products"]
            ),
            "sale_header_line_disagreements": sum(
                row["total"] != line_totals.get(key, Decimal(0))
                for key, row in sales.items()
            ),
            "sales_without_lines": sum(key not in line_totals for key in sales),
            "payment_customer_sale_disagreements": sum(
                row["customer_id"] != sales[row["sale_id"]]["customer_id"]
                for row in tables["customer_payments"]
            ),
            "purchase_historical_cost": "not reconstructable from current price",
            "text_normalization": (
                "NFKC/casefold heuristic; collation equivalence unverified"
            ),
        },
        "business_rules_validated": False,
    }


def row_digest(row: Row) -> str:
    encoded = json.dumps(
        row,
        default=json_value,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def reconcile(expected: Tables, actual: Tables) -> dict[str, object]:
    tables: dict[str, object] = {}
    equal = True
    for item in MAPPINGS:
        before = {row[item.primary_key]: row for row in expected[item.target]}
        after = {row[item.primary_key]: row for row in actual[item.target]}
        common = before.keys() & after.keys()
        differences = {
            column.name: sum(
                before[key][column.name] != after[key][column.name] for key in common
            )
            for column in item.table.c
        }
        matched = (
            before == after
            and len(before) == len(expected[item.target])
            and len(after) == len(actual[item.target])
        )
        equal = equal and matched
        tables[item.target] = {
            "equal": matched,
            "source_count": len(expected[item.target]),
            "target_count": len(actual[item.target]),
            "missing_ids": len(before.keys() - after.keys()),
            "extra_ids": len(after.keys() - before.keys()),
            "field_differences": differences,
            "source_digest": row_digest(
                {
                    "rows": [
                        before[key]
                        for key in sorted(before, key=lambda value: int(str(value)))
                    ]
                }
            ),
            "target_digest": row_digest(
                {
                    "rows": [
                        after[key]
                        for key in sorted(after, key=lambda value: int(str(value)))
                    ]
                }
            ),
        }
    return {
        "mapping_version": MAPPING_VERSION,
        "fidelity_equal": equal,
        "tables": tables,
        "source_profile": profile(expected),
        "target_profile": profile(actual),
        "business_rules_validated": False,
    }
