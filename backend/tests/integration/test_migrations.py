"""Exercise real PostgreSQL DDL and compare the result to current metadata."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, func, inspect, select, text
from sqlalchemy.orm import Session

from app.infrastructure.database import models
from app.infrastructure.database.base import Base
from data_migration.mapping import MAPPINGS
from data_migration.validation import transform
from tests.migration_helpers import synthetic_source
from tests.purchase_helpers import seed_purchasing

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
            "0005_cash_checkout"
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
        models.SaleWorkflow,
    ):
        assert database_connection.scalar(select(func.count()).select_from(model)) == 0
    command.check(config)


def test_sales_upgrade_preserves_existing_receipt(
    database_connection: Connection,
) -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.attributes["connection"] = database_connection
    command.downgrade(config, "0003_purchase_receipts")
    with Session(
        bind=database_connection, join_transaction_mode="create_savepoint"
    ) as session:
        with session.begin():
            graph = seed_purchasing(session)
    purchase_id = database_connection.scalar(
        models.Purchase.__table__.insert()
        .values(
            supplier_id=graph["supplier1"],
            employee_id=graph["employee1"],
            purchase_date="2026-01-01",
            shipping_cost="0.00",
        )
        .returning(models.Purchase.purchase_id)
    )
    item_id = database_connection.scalar(
        models.PurchaseItem.__table__.insert()
        .values(
            purchase_id=purchase_id,
            supplier_product_id=graph["supplier_product1"],
            quantity=2,
        )
        .returning(models.PurchaseItem.purchase_item_id)
    )
    database_connection.execute(
        text(
            "INSERT INTO inventory_movements(product_id,purchase_item_id,movement_type,"
            "quantity,stock_before,stock_after,created_at,"
            "performed_by_user_id,employee_id) "
            "VALUES (:product,:item,'purchase_receipt',2,0,2,now(),:actor,:employee)"
        ),
        {
            "product": graph["product1"],
            "item": item_id,
            "actor": graph["admin"],
            "employee": graph["employee1"],
        },
    )
    before = dict(
        database_connection.execute(text("SELECT * FROM inventory_movements"))
        .mappings()
        .one()
    )
    command.upgrade(config, "head")
    after = dict(
        database_connection.execute(text("SELECT * FROM inventory_movements"))
        .mappings()
        .one()
    )
    assert after.pop("sale_item_id") is None
    assert after.pop("return_item_id") is None
    assert after == before
    assert (
        database_connection.scalar(
            select(func.count()).select_from(models.SaleWorkflow)
        )
        == 0
    )
    command.check(config)
