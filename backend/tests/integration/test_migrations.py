"""Exercise real PostgreSQL DDL and compare the result to current metadata."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, func, inspect, select, text

from app.infrastructure.database import models
from app.infrastructure.database.base import Base
from data_migration.mapping import MAPPINGS
from data_migration.validation import transform
from tests.migration_helpers import synthetic_source

pytestmark = pytest.mark.postgres
BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_upgrade_downgrade_upgrade_and_metadata_drift(postgres_engine: Engine) -> None:
    with postgres_engine.begin() as connection:
        config = Config(str(BACKEND_ROOT / "alembic.ini"))
        config.attributes["connection"] = connection
        assert set(inspect(connection).get_table_names()) == {
            "alembic_version",
            *Base.metadata.tables,
        }
        command.check(config)
        command.downgrade(config, "base")
        assert inspect(connection).get_table_names() == ["alembic_version"]
        command.upgrade(config, "head")
        command.check(config)
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == (
            "0003_purchase_receipts"
        )


def test_identity_upgrade_preserves_existing_business_data(
    database_connection,
) -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.attributes["connection"] = database_connection
    command.downgrade(config, "0001_compatibility")
    department_id = database_connection.scalar(
        text(
            "INSERT INTO departments(name) VALUES ('Existing synthetic') "
            "RETURNING department_id"
        )
    )
    command.upgrade(config, "head")
    assert (
        database_connection.scalar(
            text("SELECT name FROM departments WHERE department_id=:id"),
            {"id": department_id},
        )
        == "Existing synthetic"
    )
    assert database_connection.scalar(text("SELECT count(*) FROM user_accounts")) == 0
    command.check(config)


@pytest.mark.parametrize("stock", [None, 3])
def test_receipt_upgrade_preserves_legacy_values_without_cost_inference(
    database_connection: Connection,
    stock: int | None,
) -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.attributes["connection"] = database_connection
    command.downgrade(config, "0002_identity")
    source = synthetic_source()
    source["Productos"][0]["Stock"] = stock
    tables, issues = transform(source)
    assert not issues
    for mapping in MAPPINGS:
        database_connection.execute(mapping.table.insert(), tables[mapping.target])
    command.upgrade(config, "head")
    assert database_connection.scalar(select(models.Product.legacy_stock)) == stock
    assert (
        database_connection.scalar(select(models.Product.legacy_stock_quantity)) == 12
    )
    for model in (
        models.PurchaseWorkflow,
        models.PurchaseItemCost,
        models.InventoryMovement,
    ):
        assert database_connection.scalar(select(func.count()).select_from(model)) == 0
    command.check(config)
