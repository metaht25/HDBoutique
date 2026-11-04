"""All-or-nothing load into an explicitly selected, empty rehearsal database."""

import os

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import (
    URL,
    Connection,
    Engine,
    MetaData,
    create_engine,
    inspect,
    select,
    text,
)

from app.infrastructure.database.base import Base
from data_migration.files import MigrationError, Tables
from data_migration.mapping import MAPPINGS, SCHEMA_REVISION
from data_migration.reconciliation import reconcile
from data_migration.validation import transform


def target_engine(database: str) -> Engine:
    required = ("HOST", "PORT", "NAME", "USER", "PASSWORD")
    values = {
        name: os.environ.get(f"HDB_MIGRATION_DATABASE_{name}") for name in required
    }
    if (
        not all(values.values())
        or values["NAME"] != database
        or not database.endswith("_test")
    ):
        raise MigrationError(
            "Explicit HDB_MIGRATION_DATABASE_* and matching _test database required"
        )
    return create_engine(
        URL.create(
            "postgresql+psycopg",
            username=values["USER"],
            password=values["PASSWORD"],
            host=values["HOST"],
            port=int(values["PORT"] or "0"),
            database=database,
        ),
        hide_parameters=True,
        connect_args={"connect_timeout": 10},
    )


def read_target(connection: Connection) -> Tables:
    return {
        item.target: [
            dict(row) for row in connection.execute(select(*item.columns)).mappings()
        ]
        for item in MAPPINGS
    }


def load(connection: Connection, tables: Tables) -> dict[str, object]:
    normalized, issues = transform(tables, source_names=False)
    if issues:
        raise MigrationError("Dataset rejected; no rows loaded")
    if connection.dialect.name != "postgresql" or not str(
        connection.scalar(text("SELECT current_database()"))
    ).endswith("_test"):
        raise MigrationError("Load requires isolated PostgreSQL _test database")
    if set(inspect(connection).get_table_names()) != {
        "alembic_version",
        *Base.metadata.tables,
    }:
        raise MigrationError("Target must have exactly the current Alembic schema")
    if (
        connection.scalar(text("SELECT version_num FROM alembic_version"))
        != SCHEMA_REVISION
    ):
        raise MigrationError("Target Alembic revision differs")
    connection.execute(text("SET LOCAL lock_timeout = '5s'"))
    names = ", ".join('"' + name + '"' for name in sorted(Base.metadata.tables))
    connection.execute(text(f"LOCK TABLE {names} IN ACCESS EXCLUSIVE MODE"))
    # This offline loader deliberately targets archived revision 0006 only.
    archived = MetaData(naming_convention=Base.metadata.naming_convention)
    for table in Base.metadata.sorted_tables:
        table.to_metadata(archived)
    for name in ("departments", "municipalities", "sizes"):
        for column in ("is_permanent", "is_seeded"):
            archived.tables[name]._columns.remove(archived.tables[name].c[column])
    for name in ("sale_payments", "sale_voids"):
        archived.tables[name].c.shift_id.nullable = False
    archived.tables["boutique_profiles"].c.phone_number.nullable = False
    archived.tables["suppliers"]._columns.remove(
        archived.tables["suppliers"].c.address_line
    )
    archived.tables["suppliers"].c.address_id.nullable = False
    if compare_metadata(MigrationContext.configure(connection), archived):
        raise MigrationError("Target schema drift; review Alembic revisions")
    if connection.scalar(
        text(
            "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid "
            "JOIN pg_namespace n ON n.oid=c.relnamespace "
            "WHERE n.nspname='public' AND NOT t.tgisinternal"
        )
    ):
        raise MigrationError("Target has custom triggers requiring review")
    if any(
        connection.execute(select(table).limit(1)).first() is not None
        for table in archived.sorted_tables
    ):
        raise MigrationError("Target is not empty; nothing removed or overwritten")
    for item in MAPPINGS:
        rows = normalized[item.target]
        for start in range(0, len(rows), 500):
            connection.execute(item.table.insert(), rows[start : start + 500])
    report = reconcile(normalized, read_target(connection))
    if not report["fidelity_equal"]:
        raise MigrationError("Reconciliation failed; transaction must roll back")
    for item in MAPPINGS:
        ids = [int(str(row[item.primary_key])) for row in normalized[item.target]]
        next_id = max(1, max(ids, default=0) + 1)
        if next_id >= 2**31:
            raise MigrationError("Identity exhausted; approve a new schema revision")
        # RESTART is transactional, unlike setval. All table names are static.
        connection.execute(
            text(
                f'ALTER TABLE "{item.target}" ALTER COLUMN "{item.primary_key}" '
                f"RESTART WITH {next_id}"
            )
        )
    return report
