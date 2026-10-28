"""Exercise SQL generation against a synthetic catalog, never a real source."""

from unittest.mock import Mock

from sqlalchemy import Date, Integer, Numeric

from data_migration import source
from data_migration.mapping import MAPPINGS
from tests.migration_helpers import synthetic_source


def test_extraction_requires_verified_keys_and_selects_only_mapped_columns(
    monkeypatch,
) -> None:
    catalog = {"columns": [], "indexes": []}
    for item in MAPPINGS:
        for legacy, target in item.fields:
            column = item.table.c[target]
            kind = column.type
            name = (
                "PhysicalOfferingKey"
                if item.source == "Ofrece" and legacy == "id"
                else legacy
            )
            catalog["columns"].append(
                {
                    "schema_name": "dbo",
                    "table_name": item.source,
                    "name": name,
                    "type_name": "int"
                    if isinstance(kind, Integer)
                    else "decimal"
                    if isinstance(kind, Numeric)
                    else "date"
                    if isinstance(kind, Date)
                    else "nvarchar",
                }
            )
        catalog["indexes"].append(
            {
                "schema_name": "dbo",
                "table_name": item.source,
                "column_name": "PhysicalOfferingKey"
                if item.source == "Ofrece"
                else item.fields[0][0],
                "is_primary_key": True,
            }
        )
    assert not source.compare_schema(catalog, "dbo", "PhysicalOfferingKey")
    monkeypatch.setattr(source, "inventory", lambda connection: catalog)
    calls = []
    synthetic = synthetic_source()

    def fake_query(connection, sql):
        calls.append(sql)
        return next(
            synthetic[m.source] for m in MAPPINGS if sql.endswith(f"[dbo].[{m.source}]")
        )

    monkeypatch.setattr(source, "query", fake_query)
    assert source.extract(Mock(), "dbo", "PhysicalOfferingKey") == synthetic
    assert len(calls) == 17 and all(sql.startswith("SELECT ") for sql in calls)
    assert any("[PhysicalOfferingKey] AS [id]" in sql for sql in calls)


def test_source_connection_requests_readonly_and_rolls_back(monkeypatch) -> None:
    driver = Mock()
    monkeypatch.setenv("HDB_MIGRATION_SQLSERVER_ODBC", "synthetic-unused-connection")
    monkeypatch.setattr(source, "import_module", lambda name: driver)
    with source.source_connection(authorized=True):
        pass
    driver.connect.assert_called_once_with(
        "synthetic-unused-connection", readonly=True, autocommit=False, timeout=15
    )
    driver.connect.return_value.rollback.assert_called_once()
    driver.connect.return_value.close.assert_called_once()
