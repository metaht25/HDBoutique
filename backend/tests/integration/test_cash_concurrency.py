"""Committed sessions serialize cash closing and duplicate corrections."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import func, select

from app.core.errors import ApplicationError
from app.modules.cash.models import SaleVoid
from app.modules.cash.schemas import VoidCreate
from app.modules.cash.service import CashService
from app.modules.catalog.models import Product
from app.modules.sales.schemas import SaleCreate
from app.modules.sales.service import SaleService
from tests.integration import test_sale_concurrency as sales_tests
from tests.sales_helpers import sale_payload

pytestmark = pytest.mark.postgres


@pytest.fixture(name="committed_sales")
def cash_committed_sales(postgres_engine):
    yield from sales_tests.committed_sales.__wrapped__(postgres_engine)


@pytest.mark.parametrize("same_key", [True, False])
def test_concurrent_voids_refund_and_restock_once(committed_sales, same_key):
    factory, graph, actor = committed_sales
    with factory() as session:
        sale = SaleService(session).register(
            SaleCreate(**sale_payload(graph)), actor, "sale-before-void"
        )
    payload = VoidCreate(
        reason="Synthetic correction",
        refund_confirmed=True,
        items=[
            {"sale_item_id": item.sale_item_id, "returned_quantity": item.quantity}
            for item in sale.items
        ],
    )
    barrier = Barrier(2)

    def void(index):
        barrier.wait(timeout=10)
        with factory() as session:
            try:
                result = CashService(session).void(
                    sale.sale_id,
                    payload,
                    actor,
                    "same-void-key" if same_key else f"void-key-{index}",
                )
                return 201, result.void_id
            except ApplicationError as error:
                return error.status, None

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(void, (0, 1)))
    assert sorted(code for code, _ in results) == (
        [201, 201] if same_key else [201, 409]
    )
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(SaleVoid)) == 1
        assert session.get(Product, graph["product1"]).legacy_stock == 12
        assert session.get(Product, graph["product2"]).legacy_stock == 12
