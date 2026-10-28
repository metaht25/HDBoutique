"""Concurrency with independent PostgreSQL connections and committed synthetic data."""

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from decimal import Decimal
from threading import Barrier, Event
from unittest.mock import patch

import pytest
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import ApplicationError
from app.modules.catalog.models import Product
from app.modules.identity.models import UserAccount
from app.modules.identity.service import Principal, principal_from_user
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.schemas import PurchaseCreate, PurchaseReceive
from app.modules.purchases.service import PurchaseService
from tests.purchase_helpers import cleanup_purchasing, purchase_payload, seed_purchasing

pytestmark = pytest.mark.postgres


@pytest.fixture
def committed_purchasing(
    postgres_engine: Engine,
) -> Iterator[tuple[sessionmaker[Session], dict[str, int], Principal]]:
    factory = sessionmaker(bind=postgres_engine, expire_on_commit=False)
    with factory.begin() as session:
        graph = seed_purchasing(session)
        actor = principal_from_user(session.get(UserAccount, graph["admin"]))
    try:
        yield factory, graph, actor
    finally:
        with factory.begin() as session:
            cleanup_purchasing(session, graph)


@pytest.mark.parametrize("conflicting", [False, True])
def test_concurrent_registration_uses_one_key_once(
    committed_purchasing, conflicting: bool
) -> None:
    factory, graph, actor = committed_purchasing
    barrier = Barrier(2)
    payload = PurchaseCreate(**purchase_payload(graph))

    def register(index: int) -> tuple[int, int | None]:
        request = (
            payload.model_copy(update={"shipping_cost": Decimal("1.00")})
            if conflicting and index
            else payload
        )
        barrier.wait(timeout=10)
        with factory() as session:
            try:
                purchase = PurchaseService(session).register(
                    request, actor, "concurrent-key-01"
                )
                return 201, purchase.purchase_id
            except ApplicationError as error:
                return error.status, None

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(register, (0, 1)))
    assert sorted(status for status, _ in results) == (
        [201, 409] if conflicting else [201, 201]
    )
    assert (
        len({purchase_id for _, purchase_id in results if purchase_id is not None}) == 1
    )
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(Purchase)) == 1
        assert session.scalar(select(func.count()).select_from(PurchaseItem)) == 2
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == 0


def test_simultaneous_receipts_wait_and_apply_stock_only_once(
    committed_purchasing,
) -> None:
    factory, graph, actor = committed_purchasing
    with factory() as session:
        purchase = PurchaseService(session).register(
            PurchaseCreate(**purchase_payload(graph)), actor, "receipt-concurrent-01"
        )
    movement_flushed, release = Event(), Event()
    original = InventoryRepository.append_movement

    def hold_after_flush(
        repository: InventoryRepository, movement: InventoryMovement
    ) -> None:
        original(repository, movement)
        movement_flushed.set()
        assert release.wait(timeout=10), "Synthetic test did not release receipt"

    def receive() -> int:
        with factory() as session:
            result = PurchaseService(session).receive(
                purchase.purchase_id,
                PurchaseReceive(employee_id=graph["employee1"]),
                actor,
            )
            assert result.status == "received"
            return result.purchase_id

    with ThreadPoolExecutor(max_workers=2) as executor:
        with patch.object(InventoryRepository, "append_movement", hold_after_flush):
            first = executor.submit(receive)
            try:
                assert movement_flushed.wait(timeout=10)
                second = executor.submit(receive)
                with pytest.raises(TimeoutError):
                    second.result(timeout=0.2)
            finally:
                release.set()
            assert (
                first.result(timeout=10)
                == second.result(timeout=10)
                == purchase.purchase_id
            )
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == 2
        assert session.get(Product, graph["product1"]).legacy_stock == 2
        assert session.get(Product, graph["product2"]).legacy_stock == 3


def test_different_purchases_share_products_without_lost_updates(
    committed_purchasing,
) -> None:
    factory, graph, actor = committed_purchasing
    payload = PurchaseCreate(**purchase_payload(graph))
    purchase_ids = []
    with factory() as session:
        purchase_ids.append(
            PurchaseService(session)
            .register(payload, actor, "shared-products-01")
            .purchase_id
        )
    with factory() as session:
        purchase_ids.append(
            PurchaseService(session)
            .register(
                payload.model_copy(update={"items": list(reversed(payload.items))}),
                actor,
                "shared-products-02",
            )
            .purchase_id
        )
    barrier = Barrier(2)

    def receive(purchase_id: int) -> None:
        barrier.wait(timeout=10)
        with factory() as session:
            PurchaseService(session).receive(
                purchase_id, PurchaseReceive(employee_id=graph["employee1"]), actor
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(receive, purchase_ids))
    with factory() as session:
        assert session.get(Product, graph["product1"]).legacy_stock == 4
        assert session.get(Product, graph["product2"]).legacy_stock == 6
        assert session.get(Product, graph["product1"]).legacy_stock_quantity == 12
        assert session.scalar(select(func.count()).select_from(InventoryMovement)) == 4
