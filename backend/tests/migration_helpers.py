"""Entirely synthetic legacy export, including every mapped table."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Integer, Numeric

from data_migration.files import Tables
from data_migration.mapping import MAPPINGS


def synthetic_source() -> Tables:
    tables: Tables = {}
    for item in MAPPINGS:
        row: dict[str, object] = {}
        for legacy, target in item.fields:
            column = item.table.c[target]
            if column.nullable:
                value: object = None
            elif isinstance(column.type, Integer):
                value = 101 if target.endswith("_id") else 2
            elif isinstance(column.type, Numeric):
                value = Decimal("100.50")
            elif isinstance(column.type, Date):
                value = date(2026, 1, 1)
            else:
                value = "Synthetic"
            row[legacy] = value
        tables[item.source] = [row]
    tables["Productos"][0].update(
        CantidadStock=12, Stock=3, PrecioUnitario=Decimal("199.50")
    )
    tables["DetalleVenta"][0]["PrecioUnitario"] = 199
    tables["Venta"][0]["Total"] = Decimal("398.00")
    return tables
