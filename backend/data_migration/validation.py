"""Lossless structural conversion and value-free diagnostics, without business fixes."""

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, localcontext

from sqlalchemy import Column, Date, Integer, Numeric, String

from data_migration.files import MigrationError, Row, Tables
from data_migration.mapping import MAPPINGS


def convert(value: object, column: Column[object]) -> object:
    if value is None:
        if not column.nullable:
            raise MigrationError("required")
        return None
    if isinstance(column.type, Integer):
        if type(value) is int:
            number = value
        elif isinstance(value, str) and re.fullmatch(r"[+-]?[0-9]+", value):
            number = int(value)
        else:
            raise MigrationError("integer_required")
        if not -(2**31) <= number < 2**31:
            raise MigrationError("integer_range")
        return number
    if isinstance(column.type, Numeric):
        if isinstance(value, bool) or not isinstance(value, (int, str, Decimal)):
            raise MigrationError("exact_decimal_required")
        try:
            amount = Decimal(value)
            precision, scale = column.type.precision, column.type.scale
            assert precision is not None and scale is not None
            if not amount.is_finite() or abs(amount) >= 10 ** (precision - scale):
                raise MigrationError("decimal_range")
            with localcontext() as context:
                context.prec = precision + scale + 2
                quantized = amount.quantize(Decimal(1).scaleb(-scale))
            if quantized != amount:
                raise MigrationError("rounding_required")
            return quantized
        except InvalidOperation:
            raise MigrationError("invalid_decimal") from None
    if isinstance(column.type, Date):
        if type(value) is date:
            return value
        if isinstance(value, datetime):
            # A datetime cannot silently lose a time component.
            raise MigrationError("date_required")
        if isinstance(value, str) and re.fullmatch(
            r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value
        ):
            try:
                return date.fromisoformat(value)
            except ValueError:
                pass
        raise MigrationError("invalid_date")
    if isinstance(column.type, String):
        if not isinstance(value, str):
            raise MigrationError("text_required")
        if "\x00" in value:
            raise MigrationError("nul_character")
        if column.type.length is not None and len(value) > column.type.length:
            raise MigrationError("text_length")
        return value
    raise MigrationError("unsupported_column_type")


def transform(source: Tables, *, source_names: bool = True) -> tuple[Tables, list[Row]]:
    expected = {item.source if source_names else item.target for item in MAPPINGS}
    if set(source) != expected:
        raise MigrationError("Dataset must contain exactly the 17 mapped tables")
    result: Tables = {}
    rejected: list[Row] = []
    for item in MAPPINGS:
        converted_rows: list[Row] = []
        result[item.target] = converted_rows
        for position, row in enumerate(
            source[item.source if source_names else item.target], 1
        ):
            fields = (
                item.fields
                if source_names
                else tuple((c.name, c.name) for c in item.columns)
            )
            if set(row) != {name for name, _ in fields}:
                rejected.append(
                    {"table": item.target, "row": position, "code": "field_set"}
                )
                continue
            converted: Row = {}
            for name, target in fields:
                try:
                    converted[target] = convert(row[name], item.table.c[target])
                except MigrationError as error:
                    rejected.append(
                        {
                            "table": item.target,
                            "row": position,
                            "column": target,
                            "code": str(error),
                        }
                    )
            if len(converted) == len(fields):
                converted_rows.append(converted)
    if rejected:
        # No usable partial dataset is returned when even one field is rejected.
        return {}, rejected
    return result, structural_issues(result)


def structural_issues(tables: Tables) -> list[Row]:
    issues: list[Row] = []
    identities: dict[str, set[object]] = {}
    for item in MAPPINGS:
        seen: set[object] = set()
        identities[item.target] = seen
        for position, row in enumerate(tables[item.target], 1):
            identity = row[item.primary_key]
            if identity in seen:
                issues.append(
                    {"table": item.target, "row": position, "code": "duplicate_pk"}
                )
            seen.add(identity)
    for item in MAPPINGS:
        for position, row in enumerate(tables[item.target], 1):
            for foreign_key in item.table.foreign_keys:
                # Offline legacy bundles contain only their mapped columns.
                if foreign_key.parent.name not in row:
                    continue
                value = row[foreign_key.parent.name]
                if value is None and foreign_key.parent.nullable:
                    continue
                if value not in identities[foreign_key.column.table.name]:
                    issues.append(
                        {
                            "table": item.target,
                            "row": position,
                            "column": foreign_key.parent.name,
                            "code": "orphan",
                        }
                    )
    return issues
