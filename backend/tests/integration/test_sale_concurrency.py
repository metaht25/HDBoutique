"""Independent committed PostgreSQL sessions compete for stock and request keys."""

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from decimal import Decimal
from threading import Barrier, Event
from unittest.mock import patch

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.core.errors import ApplicationError
from app.modules.catalog.models import Product
from app.modules.identity.models import UserAccount
from app.modules.identity.service import principal_from_user
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.purchases.schemas import PurchaseCreate, PurchaseReceive
from app.modules.purchases.service import PurchaseService
from app.modules.sales.models import Sale
from app.modules.sales.schemas import SaleCreate
from app.modules.sales.service import SaleService
from tests.purchase_helpers import purchase_payload
from tests.sales_helpers import cleanup_sales, sale_payload, seed_sales

pytestmark = pytest.mark.postgres


@pytest.fixture
def committed_sales(postgres_engine):
    factory = sessionmaker(bind=postgres_engine, expire_on_commit=False)
    with factory.begin() as session:
        graph = seed_sales(session)
        actor = principal_from_user(session.get(UserAccount, graph["admin"]))
    try:
        yield factory, graph, actor
    finally:
        with factory.begin() as session:
            cleanup_sales(session, graph)


@pytest.mark.parametrize("mode", ["last_unit", "same_key", "conflicting_key", "shared"])
def test_concurrent_sales_never_oversell_or_duplicate(committed_sales, mode) -> None:
    factory, graph, actor = committed_sales
    values = sale_payload(graph)
    if mode == "last_unit":
        values["items"] = [{"product_id": graph["product1"], "quantity": 1}]
        with factory.begin() as session:
            session.get(Product, graph["product1"]).legacy_stock = 1
    barrier = Barrier(2)

    def sell(index):
        payload = SaleCreate(**values)
        if mode in {"shared", "conflicting_key"} and index:
            payload.items.reverse()
        key = (
            f"concurrent-sale-{index}"
            if mode in {"last_unit", "shared"}
            else "same-sale-key"
        )
        barrier.wait(timeout=10)
        with factory() as session:
            try:
                return 201, SaleService(session).register(payload, actor, key).sale_id
            except ApplicationError as error:
                return error.status, None

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(sell, (0, 1)))
    assert sorted(status for status, _ in results) == (
        [201, 409] if mode in {"last_unit", "conflicting_key"} else [201, 201]
    )
    with factory() as session:
        expected_sales = 2 if mode == "shared" else 1
        assert session.scalar(select(func.count()).select_from(Sale)) == expected_sales
        assert session.get(Product, graph["product1"]).legacy_stock == (
            0 if mode == "last_unit" else 12 - 2 * expected_sales
        )
        assert session.get(Product, graph["product1"]).legacy_stock_quantity == 12
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == (
            1 if mode == "last_unit" else 2 * expected_sales
        )
    if mode == "same_key":
        assert results[0][1] == results[1][1]


def test_receipt_and_sale_wait_on_the_same_product_locks(committed_sales) -> None:
    factory, graph, actor = committed_sales
    with factory() as session:
        purchase = PurchaseService(session).register(
            PurchaseCreate(**purchase_payload(graph)), actor, "purchase-before-sale"
        )
    held, release, sale_started = Event(), Event(), Event()
    original = InventoryRepository.append_movement

    def hold_receipt(repository, movement):
        original(repository, movement)
        if movement.movement_type == "purchase_receipt":
            held.set()
            assert release.wait(timeout=10)

    def receive():
        with factory() as session:
            return PurchaseService(session).receive(
                purchase.purchase_id,
                PurchaseReceive(employee_id=graph["employee1"]),
                actor,
            )

    def sell():
        sale_started.set()
        with factory() as session:
            return SaleService(session).register(
                SaleCreate(**sale_payload(graph)), actor, "sale-after-receipt"
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        with patch.object(InventoryRepository, "append_movement", hold_receipt):
            receipt = executor.submit(receive)
            try:
                assert held.wait(timeout=10)
                sale = executor.submit(sell)
                assert sale_started.wait(timeout=10)
                with pytest.raises(TimeoutError):
                    sale.result(timeout=0.2)
            finally:
                release.set()
            assert receipt.result(timeout=10).status == "received"
            assert sale.result(timeout=10).status == "confirmed"
    with factory() as session:
        assert session.get(Product, graph["product1"]).legacy_stock == 12
        assert session.get(Product, graph["product2"]).legacy_stock == 12
        movements = list(
            session.scalars(
                select(InventoryMovement).order_by(InventoryMovement.movement_id)
            )
        )
        assert [(m.stock_before, m.stock_after) for m in movements] == [
            (12, 14),
            (12, 15),
            (14, 12),
            (15, 12),
        ]


def test_sale_waits_for_price_edit_and_snapshots_committed_price(
    committed_sales,
) -> None:
    factory, graph, actor = committed_sales
    started = Event()

    def sell():
        started.set()
        with factory() as session:
            return SaleService(session).register(
                SaleCreate(**sale_payload(graph)), actor, "sale-with-price-lock"
            )

    with ThreadPoolExecutor(max_workers=1) as executor:
        with factory.begin() as session:
            product = session.scalar(
                select(Product)
                .where(Product.product_id == graph["product1"])
                .with_for_update()
            )
            product.unit_price = Decimal("200.50")
            session.flush()
            future = executor.submit(sell)
            assert started.wait(timeout=10)
            with pytest.raises(TimeoutError):
                future.result(timeout=0.2)
        sale = future.result(timeout=10)
    assert sale.items[0].unit_price == Decimal("200.50")
    assert sale.total == Decimal("999.50")
