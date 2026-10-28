"""Persist synthetic records and verify transaction and referential integrity."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import Connection, Engine, insert, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.infrastructure.database import models
from app.infrastructure.database.session import create_session_factory
from data_migration.mapping import MAPPINGS

pytestmark = pytest.mark.postgres


def insert_identity(connection: Connection, model: type, **values: object) -> int:
    table = model.__table__
    return connection.execute(
        insert(table).values(**values).returning(*table.primary_key.columns)
    ).scalar_one()


@pytest.fixture
def synthetic_graph(database_connection: Connection) -> dict[str, int]:
    connection = database_connection
    department = insert_identity(
        connection, models.Department, name="Synthetic department"
    )
    municipality = insert_identity(
        connection, models.Municipality, department_id=department, name=None
    )
    address = insert_identity(
        connection, models.Address, department_id=department, address_line=None
    )
    category = insert_identity(connection, models.Category, name=None)
    size = insert_identity(connection, models.Size, name="Synthetic size")
    product = insert_identity(
        connection,
        models.Product,
        category_id=category,
        size_id=size,
        name=None,
        legacy_stock_quantity=12,
        legacy_stock=3,
        unit_price=Decimal("199.50"),
    )
    customer_type = insert_identity(connection, models.CustomerType, name=None)
    customer = insert_identity(
        connection,
        models.Customer,
        address_id=address,
        customer_type_id=customer_type,
        first_names="Synthetic",
        last_names="Customer",
        phone_number="0000000000",
    )
    employee = insert_identity(
        connection,
        models.Employee,
        address_id=address,
        first_names="Synthetic",
        last_names="Employee",
        phone_number="0000000000",
        start_date=None,
        end_date=None,
    )
    supplier = insert_identity(
        connection,
        models.Supplier,
        address_id=address,
        company_name="Synthetic supplier",
        contact_first_names="Synthetic",
        contact_last_names="Contact",
        phone_number="0000000000",
    )
    supplier_product = insert_identity(
        connection,
        models.SupplierProduct,
        product_id=product,
        purchase_price=Decimal("120.50"),
    )
    offering = insert_identity(
        connection,
        models.SupplierOffering,
        supplier_id=supplier,
        supplier_product_id=supplier_product,
    )
    purchase = insert_identity(
        connection,
        models.Purchase,
        supplier_id=supplier,
        employee_id=employee,
        purchase_date=date(2026, 1, 1),
        review_date=None,
        refill_date=None,
        shipping_cost=None,
    )
    purchase_item = insert_identity(
        connection,
        models.PurchaseItem,
        supplier_product_id=supplier_product,
        purchase_id=purchase,
        quantity=12,
    )
    sale = insert_identity(
        connection,
        models.Sale,
        customer_id=customer,
        employee_id=employee,
        sale_date=date(2026, 1, 2),
        total=Decimal("399.00"),
    )
    sale_item = insert_identity(
        connection,
        models.SaleItem,
        sale_id=sale,
        product_id=product,
        quantity=2,
        unit_price=Decimal("199.50"),
    )
    payment = insert_identity(
        connection,
        models.CustomerPayment,
        customer_id=customer,
        sale_id=sale,
        payment_date=date(2026, 1, 3),
        amount=Decimal("100.50"),
    )
    return {
        "department": department,
        "municipality": municipality,
        "address": address,
        "category": category,
        "size": size,
        "product": product,
        "customer_type": customer_type,
        "customer": customer,
        "employee": employee,
        "supplier": supplier,
        "supplier_product": supplier_product,
        "offering": offering,
        "purchase": purchase,
        "purchase_item": purchase_item,
        "sale": sale,
        "sale_item": sale_item,
        "payment": payment,
    }


def test_all_resources_preserve_money_nulls_dates_and_separate_stock(
    database_connection: Connection, synthetic_graph: dict[str, int]
) -> None:
    with Session(
        bind=database_connection, join_transaction_mode="create_savepoint"
    ) as session:
        product = session.get(models.Product, synthetic_graph["product"])
        sale_item = session.get(models.SaleItem, synthetic_graph["sale_item"])
        purchase = session.get(models.Purchase, synthetic_graph["purchase"])
        payment = session.get(models.CustomerPayment, synthetic_graph["payment"])
        assert product is not None and sale_item is not None
        assert purchase is not None and payment is not None
        assert (product.legacy_stock_quantity, product.legacy_stock) == (12, 3)
        assert product.name is None
        assert sale_item.unit_price == Decimal("199.50")
        assert isinstance(sale_item.unit_price, Decimal)
        assert sale_item.unit_price * sale_item.quantity == Decimal("399.00")
        assert purchase.review_date is None and purchase.refill_date is None
        assert purchase.shipping_cost is None
        assert payment.payment_date == date(2026, 1, 3)
        assert payment.amount == Decimal("100.50")
        for table in inspect(database_connection).get_table_names():
            if table in {mapping.target for mapping in MAPPINGS}:
                assert (
                    database_connection.scalar(
                        select(1)
                        .select_from(models.Department.metadata.tables[table])
                        .limit(1)
                    )
                    == 1
                )


def test_foreign_key_rejects_orphans_and_referenced_deletes(
    database_connection: Connection, synthetic_graph: dict[str, int]
) -> None:
    with pytest.raises(IntegrityError), database_connection.begin_nested():
        database_connection.execute(
            insert(models.Address).values(department_id=-123456, address_line=None)
        )
    with pytest.raises(IntegrityError), database_connection.begin_nested():
        database_connection.execute(
            models.Department.__table__.delete().where(
                models.Department.department_id == synthetic_graph["department"]
            )
        )
    assert (
        database_connection.scalar(
            select(models.Department.department_id).where(
                models.Department.department_id == synthetic_graph["department"]
            )
        )
        == synthetic_graph["department"]
    )


def test_sessions_commit_and_roll_back_complete_units(postgres_engine: Engine) -> None:
    factory = create_session_factory(postgres_engine)
    with factory.begin() as session:
        department = models.Department(name="Synthetic committed unit")
        session.add(department)
    department_id = department.department_id
    assert department.name == "Synthetic committed unit"
    try:
        # Otra conexion debe observar el commit, sin una transaccion externa comun.
        with postgres_engine.connect() as connection:
            assert (
                connection.scalar(
                    select(models.Department.name).where(
                        models.Department.department_id == department_id
                    )
                )
                == "Synthetic committed unit"
            )
        with pytest.raises(RuntimeError, match="synthetic failure"):
            with factory.begin() as session:
                session.add(models.Department(name="Synthetic rolled back unit"))
                session.flush()
                raise RuntimeError("synthetic failure")
        with factory() as session:
            assert (
                session.scalar(
                    select(models.Department.department_id).where(
                        models.Department.name == "Synthetic rolled back unit"
                    )
                )
                is None
            )
    finally:
        with factory.begin() as session:
            session.execute(
                models.Department.__table__.delete().where(
                    models.Department.department_id == department_id
                )
            )


def test_identity_accepts_preserved_ids_and_generates_new_ones(
    database_connection: Connection,
) -> None:
    preserved = insert_identity(
        database_connection,
        models.Department,
        department_id=100000,
        name="Preserved ID",
    )
    generated = insert_identity(
        database_connection, models.Department, name="Generated ID"
    )
    assert preserved == 100000
    assert generated != preserved


@pytest.mark.parametrize("price", ["-2147483648.00", "2147483647.00"])
def test_sale_unit_price_can_preserve_full_legacy_integer_range(
    database_connection: Connection, synthetic_graph: dict[str, int], price: str
) -> None:
    database_connection.execute(
        models.SaleItem.__table__.update()
        .where(models.SaleItem.sale_item_id == synthetic_graph["sale_item"])
        .values(unit_price=Decimal(price))
    )
    assert database_connection.scalar(
        select(models.SaleItem.unit_price).where(
            models.SaleItem.sale_item_id == synthetic_graph["sale_item"]
        )
    ) == Decimal(price)
