"""SELECT-only SQL Server inventory and extraction from an authorized stable copy."""

import os
from collections.abc import Iterator
from contextlib import contextmanager
from importlib import import_module
from typing import Any, Protocol, cast

from data_migration.files import MigrationError, Row, Tables
from data_migration.mapping import MAPPINGS


class Connection(Protocol):
    def cursor(self) -> Any: ...
    def rollback(self) -> None: ...
    def close(self) -> None: ...


CATALOG_QUERIES = {
    "objects": """SELECT s.name AS schema_name, o.name, o.type_desc,
        OBJECT_SCHEMA_NAME(o.parent_object_id) AS parent_schema,
        OBJECT_NAME(o.parent_object_id) AS parent_name
        FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
        WHERE o.is_ms_shipped=0 ORDER BY s.name,o.name""",
    "columns": """SELECT s.name AS schema_name,t.name AS table_name,
        c.name,ty.name AS type_name,c.max_length,c.precision,c.scale,
        c.is_nullable,c.is_identity,c.collation_name,
        dc.name AS default_name
        FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
        JOIN sys.columns c ON c.object_id=t.object_id
        JOIN sys.types ty ON ty.user_type_id=c.user_type_id
        LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id
        ORDER BY s.name,t.name,c.column_id""",
    "indexes": """SELECT s.name AS schema_name,t.name AS table_name,
        i.name,i.is_unique,i.is_primary_key,i.is_disabled,i.has_filter,
        c.name AS column_name,ic.key_ordinal,ic.is_included_column
        FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
        JOIN sys.indexes i ON i.object_id=t.object_id
        JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
        JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id
        ORDER BY s.name,t.name,i.name,ic.index_column_id""",
    "foreign_keys": """SELECT s.name AS schema_name,t.name AS table_name,
        fk.name,c.name AS column_name,rs.name AS referenced_schema,
        rt.name AS referenced_table,rc.name AS referenced_column,
        fk.is_disabled,fk.is_not_trusted,fk.delete_referential_action_desc,
        fk.update_referential_action_desc
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns f ON f.constraint_object_id=fk.object_id
        JOIN sys.tables t ON t.object_id=f.parent_object_id
        JOIN sys.schemas s ON s.schema_id=t.schema_id
        JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=f.parent_column_id
        JOIN sys.tables rt ON rt.object_id=f.referenced_object_id
        JOIN sys.schemas rs ON rs.schema_id=rt.schema_id
        JOIN sys.columns rc ON rc.object_id=rt.object_id
        AND rc.column_id=f.referenced_column_id
        ORDER BY s.name,t.name,fk.name,f.constraint_column_id""",
    "checks": """SELECT s.name AS schema_name,t.name AS table_name,
        cc.name,cc.is_disabled,cc.is_not_trusted
        FROM sys.check_constraints cc
        JOIN sys.tables t ON t.object_id=cc.parent_object_id
        JOIN sys.schemas s ON s.schema_id=t.schema_id ORDER BY s.name,t.name,cc.name""",
    "modules": """SELECT s.name AS schema_name,o.name,o.type_desc,
        CASE WHEN m.definition IS NULL THEN 0 ELSE 1 END AS definition_visible
        FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
        LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id
        WHERE o.type IN ('V','P','TR','FN','IF','TF') AND o.is_ms_shipped=0
        ORDER BY s.name,o.name""",
}


@contextmanager
def source_connection(*, authorized: bool) -> Iterator["Connection"]:
    if not authorized:
        raise MigrationError("Explicit source authorization required")
    secret = os.environ.get("HDB_MIGRATION_SQLSERVER_ODBC")
    if not secret:
        raise MigrationError("Set HDB_MIGRATION_SQLSERVER_ODBC externally")
    driver = import_module("pyodbc")
    connection = cast(
        Connection, driver.connect(secret, readonly=True, autocommit=False, timeout=15)
    )
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()


def query(connection: "Connection", sql: str) -> list[Row]:
    with connection.cursor() as cursor:
        cursor.execute(sql)
        names = [description[0] for description in cursor.description]
        return [dict(zip(names, row, strict=True)) for row in cursor]


def inventory(connection: "Connection") -> dict[str, list[Row]]:
    permission = query(
        connection,
        "SELECT HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'VIEW DEFINITION') AS allowed",
    )
    if permission[0]["allowed"] != 1:
        raise MigrationError("VIEW DEFINITION required; partial inventory refused")
    result = {name: query(connection, sql) for name, sql in CATALOG_QUERIES.items()}
    result["database"] = query(
        connection,
        "SELECT DB_NAME() AS database_name, "
        "CONVERT(varchar(128), SERVERPROPERTY('ProductVersion')) AS version",
    )
    return result


def quote(name: str) -> str:
    if not name or "\x00" in name:
        raise MigrationError("Invalid SQL identifier")
    return "[" + name.replace("]", "]]") + "]"


def compare_schema(
    catalog: dict[str, list[Row]], schema: str, offering_key: str
) -> list[Row]:
    issues: list[Row] = []
    for item in MAPPINGS:
        columns = {
            r["name"]: r
            for r in catalog["columns"]
            if r["schema_name"] == schema and r["table_name"] == item.source
        }
        expected = {
            offering_key if item.source == "Ofrece" and a == "id" else a
            for a, _ in item.fields
        }
        for name in expected - columns.keys():
            issues.append(
                {"table": item.source, "column": name, "code": "missing_column"}
            )
        for extra_name in columns.keys() - expected:
            issues.append(
                {"table": item.source, "column": extra_name, "code": "unmapped_column"}
            )
        primary = [
            r["column_name"]
            for r in catalog["indexes"]
            if r["schema_name"] == schema
            and r["table_name"] == item.source
            and r["is_primary_key"]
        ]
        expected_key = offering_key if item.source == "Ofrece" else item.fields[0][0]
        if primary != [expected_key]:
            issues.append(
                {"table": item.source, "code": "physical_pk_requires_mapping"}
            )
        for legacy, target in item.fields:
            physical = (
                offering_key if item.source == "Ofrece" and legacy == "id" else legacy
            )
            if physical not in columns:
                continue
            from sqlalchemy import Date, Integer, Numeric, String

            column = item.table.c[target]
            actual = columns[physical]
            kind = column.type
            compatible = (
                isinstance(kind, Integer)
                and actual["type_name"] in ("int", "smallint", "tinyint")
                or isinstance(kind, Numeric)
                and actual["type_name"]
                in (
                    "decimal",
                    "numeric",
                    "money",
                    "smallmoney",
                    "int",
                    "smallint",
                    "tinyint",
                )
                or isinstance(kind, String)
                and actual["type_name"] in ("varchar", "nvarchar", "char", "nchar")
                or isinstance(kind, Date)
                and actual["type_name"] == "date"
            )
            if not compatible:
                issues.append(
                    {
                        "table": item.source,
                        "column": physical,
                        "code": "type_requires_review",
                    }
                )
    return issues


def extract(connection: "Connection", schema: str, offering_key: str) -> Tables:
    catalog = inventory(connection)
    if compare_schema(catalog, schema, offering_key):
        raise MigrationError(
            "Physical schema differs; inventory and resolve mapping first"
        )
    result: Tables = {}
    for item in MAPPINGS:
        fields = ", ".join(
            quote(offering_key if item.source == "Ofrece" and a == "id" else a)
            + " AS "
            + quote(a)
            for a, _ in item.fields
        )
        result[item.source] = query(
            connection, f"SELECT {fields} FROM {quote(schema)}.{quote(item.source)}"
        )
    return result
