"""Measure list round-trips and preserve details, legacy values and actor scope."""

import json
from datetime import date
from decimal import Decimal
from statistics import median
from time import perf_counter

import pytest
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker

from app.modules.cash.schemas import VoidCreate
from app.modules.cash.service import CashService
from app.modules.catalog.models import Product
from app.modules.identity.models import UserAccount
from app.modules.identity.service import principal_from_user
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.schemas import PurchaseCreate, PurchaseReceive
from app.modules.purchases.service import PurchaseService
from app.modules.sales.models import Sale, SaleItem
from app.modules.sales.schemas import SaleCreate
from app.modules.sales.service import SaleService
from tests.purchase_helpers import purchase_payload
from tests.sales_helpers import sale_payload, seed_sales

pytestmark = pytest.mark.postgres


@pytest.fixture
def list_context(postgres_engine):
    with postgres_engine.connect().execution_options(
        isolation_level="REPEATABLE READ"
    ) as connection:
        transaction = connection.begin()
        factory = sessionmaker(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            with factory.begin() as session:
                graph = seed_sales(session)
                session.get(Product, graph["product1"]).legacy_stock = 100
                admin = principal_from_user(session.get(UserAccount, graph["admin"]))
                cashier = principal_from_user(
                    session.get(UserAccount, graph["cashier"])
                )
            with factory() as session:
                for index in range(19):
                    body = sale_payload(graph)
                    body["items"] = [{"product_id": graph["product1"], "quantity": 1}]
                    sale = SaleService(session).register(
                        SaleCreate.model_validate(body),
                        cashier if index % 2 else admin,
                        f"list-sale-{index}",
                    )
                    if index == 0:
                        CashService(session).void(
                            sale.sale_id,
                            VoidCreate(
                                reason="Synthetic list comparison",
                                refund_confirmed=True,
                                items=[
                                    {
                                        "sale_item_id": sale.items[0].sale_item_id,
                                        "returned_quantity": 1,
                                    }
                                ],
                            ),
                            admin,
                            "list-void",
                        )
                    purchase = PurchaseService(session).register(
                        PurchaseCreate.model_validate(purchase_payload(graph)),
                        admin,
                        f"list-purchase-{index}",
                    )
                    if index == 0:
                        PurchaseService(session).receive(
                            purchase.purchase_id,
                            PurchaseReceive(),
                            admin,
                        )
            with factory.begin() as session:
                historical_sale = Sale(
                    customer_id=graph["customer"],
                    employee_id=graph["employee1"],
                    sale_date=date(2020, 1, 1),
                    total=Decimal("1.00"),
                )
                historical_purchase = Purchase(
                    supplier_id=graph["supplier1"],
                    employee_id=graph["employee1"],
                    purchase_date=date(2020, 1, 1),
                    shipping_cost=None,
                )
                session.add_all([historical_sale, historical_purchase])
                session.flush()
                session.add_all(
                    [
                        SaleItem(
                            sale_id=historical_sale.sale_id,
                            product_id=graph["product1"],
                            quantity=1,
                            unit_price=Decimal("1.00"),
                        ),
                        PurchaseItem(
                            purchase_id=historical_purchase.purchase_id,
                            supplier_product_id=graph["supplier_product1"],
                            quantity=1,
                        ),
                    ]
                )
            yield connection, factory, admin, cashier
        finally:
            transaction.rollback()


def measure(connection, factory, resource, limit):
    counts, elapsed = [], []
    rows = []
    for _ in range(5):
        count = 0

        def before_execute(conn, cursor, statement, parameters, context, executemany):
            nonlocal count
            if statement.lstrip().upper().startswith("SELECT"):
                count += 1

        event.listen(connection, "before_cursor_execute", before_execute)
        try:
            with factory() as session:
                started = perf_counter()
                rows = (
                    SaleService(session).list_sales(0, limit)
                    if resource == "sales"
                    else PurchaseService(session).list_purchases(0, limit)
                )
                elapsed.append((perf_counter() - started) * 1000)
                counts.append(count)
        finally:
            event.remove(connection, "before_cursor_execute", before_execute)
    assert len(set(counts)) == 1
    print(
        json.dumps(
            {
                "resource": resource,
                "limit": limit,
                "selects": counts[0],
                "median_ms": round(median(elapsed), 2),
            }
        )
    )
    return counts[0], rows


@pytest.mark.parametrize("resource", ["sales", "purchases"])
def test_list_query_budget_and_detail_equivalence(list_context, resource):
    connection, factory, admin, cashier = list_context
    one_count, _ = measure(connection, factory, resource, 1)
    count, rows = measure(connection, factory, resource, 20)
    assert len(rows) == 20
    assert count <= (6 if resource == "sales" else 3)
    assert count <= one_count + 1  # At most one extra query for return items.
    with factory() as session:
        service = (
            SaleService(session) if resource == "sales" else PurchaseService(session)
        )
        for row in rows:
            detail = (
                service.get_sale(row.sale_id, admin)
                if resource == "sales"
                else service.get_purchase(row.purchase_id)
            )
            assert row.model_dump(mode="json") == detail.model_dump(mode="json")
        if resource == "sales":
            scoped = service.list_sales(0, 20, cashier)
            assert len(scoped) == 9
            assert all(row.created_by_user_id == cashier.user_id for row in scoped)
            assert {row.status for row in rows} == {None, "confirmed", "voided"}
            assert service.list_sales(100, 20, admin) == []
        else:
            assert {row.status for row in rows} == {None, "registered", "received"}
            assert any(row.total is None for row in rows)
            assert service.list_purchases(100, 20) == []
