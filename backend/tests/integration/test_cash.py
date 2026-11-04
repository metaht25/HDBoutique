"""Real cash reconciliation, full payments and compensating inventory/refunds."""

from unittest.mock import patch

import pytest
from sqlalchemy import func, select, update

from app.modules.cash.models import (
    SalePayment,
    SaleReturnItem,
    SaleVoid,
)
from app.modules.cash.schemas import VoidCreate
from app.modules.cash.service import CashService
from app.modules.catalog.models import Product
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.sales.models import Sale, SaleItem
from tests.identity_helpers import login
from tests.integration import test_sales as sales_tests
from tests.sales_helpers import sale_payload

pytestmark = pytest.mark.postgres


@pytest.fixture(name="sales_context")
def cash_context(database_connection):
    yield from sales_tests.sales_context.__wrapped__(database_connection)


register = sales_tests.register


def command(client, path, payload, key="cash-command-01"):
    return client.post(path, json=payload, headers={"Idempotency-Key": key})


def refund_payload(graph, sale):
    return {
        "reason": "Synthetic correction",
        "refund_confirmed": True,
        "items": [
            {
                "sale_item_id": item["sale_item_id"],
                "returned_quantity": item["quantity"],
            }
            for item in sale["items"]
        ],
    }


def test_cash_sale_change_without_operational_shift(sales_context):
    client, graph, _, _, _ = sales_context
    payload = sale_payload(graph)
    payload["payment"]["received_amount"] = "1000.00"
    sale = register(client, graph, payload=payload).json()
    assert sale["payment"]["amount"] == "997.50"
    assert sale["payment"]["change_amount"] == "2.50"
    assert sale["payment"]["shift_id"] is None
    assert client.get("/api/v1/cash/shifts").status_code == 404


def test_transfer_payment_and_refund_without_shift(sales_context):
    client, graph, _, _, _ = sales_context
    payload = sale_payload(graph)
    payload["payment"] = {
        "method": "transfer",
        "received_amount": "997.50",
        "reference": "SYNTHETIC",
        "transfer_confirmed": True,
    }
    sale = register(client, graph, payload=payload).json()
    assert sale["payment"]["cash_amount"] == "0.00"
    body = {**refund_payload(graph, sale), "reference": "SYNTHETIC-REFUND"}
    result = command(client, f"/api/v1/sales/{sale['sale_id']}/void", body)
    assert result.status_code == 201, result.text
    assert result.json()["amount"] == "997.50"
    assert result.json()["shift_id"] is None


@pytest.mark.parametrize(
    "mutation",
    [
        "missing",
        "card",
        "credit",
        "partial",
        "transfer_unconfirmed",
        "transfer_short",
        "transfer_over",
        "cash_reference",
        "extra_abono",
    ],
)
def test_no_unpaid_partial_card_or_abono_can_create_sale(
    sales_context, database_connection, mutation
):
    client, graph, _, _, _ = sales_context
    payload = sale_payload(graph)
    if mutation == "missing":
        del payload["payment"]
    elif mutation in {"card", "credit"}:
        payload["payment"]["method"] = mutation
    elif mutation == "partial":
        payload["payment"]["received_amount"] = "997.49"
    elif mutation in {"transfer_short", "transfer_over"}:
        payload["payment"] = {
            "method": "transfer",
            "received_amount": "997.49" if mutation == "transfer_short" else "997.51",
            "reference": "synthetic",
            "transfer_confirmed": True,
        }
    elif mutation.startswith("transfer"):
        payload["payment"] = {
            "method": "transfer",
            "received_amount": "997.50",
            "reference": "synthetic",
            "transfer_confirmed": True,
        }
        del payload["payment"][
            "reference" if mutation.endswith("reference") else "transfer_confirmed"
        ]
    elif mutation == "cash_reference":
        payload["payment"]["reference"] = "synthetic"
    else:
        payload["abono"] = "100.00"
    assert register(client, graph, payload=payload).status_code == 422
    assert (
        database_connection.scalar(select(func.count()).select_from(SalePayment)) == 0
    )
    assert (
        database_connection.scalar(select(func.count()).select_from(InventoryMovement))
        == 0
    )
    assert (
        database_connection.scalar(
            select(Product.legacy_stock).where(Product.product_id == graph["product1"])
        )
        == 12
    )


def test_retired_cash_endpoints_cannot_mutate_history(sales_context):
    client, graph, _, _, _ = sales_context
    for path in (
        "/api/v1/cash/shifts",
        f"/api/v1/cash/shifts/{graph['shift']}/close",
        f"/api/v1/cash/shifts/{graph['shift']}/movements",
    ):
        assert command(client, path, {}).status_code == 404


def test_full_void_preserves_original_returns_only_actual_goods_and_updates_reports(
    sales_context, database_connection
):
    client, graph, _, _, _ = sales_context
    sale = register(client, graph).json()
    body = refund_payload(graph, sale)
    body["items"][0]["returned_quantity"] = 1
    body["items"][1]["returned_quantity"] = 0
    path = f"/api/v1/sales/{sale['sale_id']}/void"
    login(client, "purchasing-cashier")
    assert command(client, path, body).status_code == 403
    login(client, "purchasing-administrator")
    result = command(client, path, body)
    assert result.status_code == 201, result.text
    assert result.json()["amount"] == "997.50"
    assert command(client, path, body).json() == result.json()
    assert command(client, path, body, "second-void").status_code == 409
    detail = client.get(f"/api/v1/sales/{sale['sale_id']}").json()
    assert (
        detail["items"] == sale["items"]
        and detail["total"] == sale["total"]
        and detail["status"] == "voided"
    )
    assert (
        database_connection.scalar(
            select(Product.legacy_stock).where(Product.product_id == graph["product1"])
        )
        == 11
    )
    assert (
        database_connection.scalar(
            select(Product.legacy_stock_quantity).where(
                Product.product_id == graph["product1"]
            )
        )
        == 12
    )
    assert (
        database_connection.scalar(
            select(Product.legacy_stock).where(Product.product_id == graph["product2"])
        )
        == 9
    )
    movements = client.get(
        f"/api/v1/inventory/movements?sale_id={sale['sale_id']}"
    ).json()
    assert len(movements) == 3 and movements[-1]["movement_type"] == "sale_return"
    report = client.get("/api/v1/reports/sales").json()
    assert (
        report["summary"]["total_amount"] == "0.00"
        and report["items"][0]["source"] == "voided"
    )


@pytest.mark.parametrize(
    "mutation",
    [
        "missing_line",
        "duplicate",
        "too_many",
        "foreign_line",
        "refund_unconfirmed",
        "blank_reason",
        "stock_unknown",
    ],
)
def test_void_rejects_inconsistent_data_without_partial_effects(
    sales_context, database_connection, mutation
):
    client, graph, _, _, _ = sales_context
    sale = register(client, graph).json()
    body = refund_payload(graph, sale)
    if mutation == "missing_line":
        body["items"].pop()
    elif mutation == "duplicate":
        body["items"][1] = body["items"][0]
    elif mutation == "too_many":
        body["items"][0]["returned_quantity"] = 100
    elif mutation == "foreign_line":
        body["items"][0]["sale_item_id"] = 2147483647
    elif mutation == "refund_unconfirmed":
        body["refund_confirmed"] = False
    elif mutation == "blank_reason":
        body["reason"] = " "
    elif mutation == "stock_unknown":
        database_connection.execute(
            update(Product)
            .where(Product.product_id == graph["product1"])
            .values(legacy_stock=None)
        )
    else:
        command(
            client,
            f"/api/v1/cash/shifts/{graph['shift']}/movements",
            {"kind": "withdrawal", "amount": "1500.00", "reason": "Synthetic"},
        )
    response = command(client, f"/api/v1/sales/{sale['sale_id']}/void", body)
    assert response.status_code in {409, 422}, response.text
    for model in (SaleVoid, SaleReturnItem):
        assert database_connection.scalar(select(func.count()).select_from(model)) == 0
    assert (
        database_connection.scalar(select(func.count()).select_from(InventoryMovement))
        == 2
    )


def test_void_failure_after_stock_change_rolls_back_everything(
    sales_context, database_connection
):
    client, graph, factory, actor, _ = sales_context
    sale = register(client, graph).json()
    original = InventoryRepository.append_movement

    def fail(repository, record):
        original(repository, record)
        raise RuntimeError("Synthetic failure after return")

    with (
        factory() as session,
        patch.object(InventoryRepository, "append_movement", fail),
    ):
        with pytest.raises(RuntimeError):
            CashService(session).void(
                sale["sale_id"],
                VoidCreate(**refund_payload(graph, sale)),
                actor,
                "rollback-void",
            )
    assert database_connection.scalar(select(func.count()).select_from(SaleVoid)) == 0
    assert (
        database_connection.scalar(
            select(Product.legacy_stock).where(Product.product_id == graph["product1"])
        )
        == 10
    )
    assert (
        command(
            client,
            f"/api/v1/sales/{sale['sale_id']}/void",
            refund_payload(graph, sale),
            "rollback-void",
        ).status_code
        == 201
    )


def test_historical_sale_is_not_invented_as_paid_or_refunded(sales_context):
    client, graph, factory, _, _ = sales_context
    from datetime import date
    from decimal import Decimal

    with factory.begin() as session:
        sale = Sale(
            customer_id=graph["customer"],
            employee_id=graph["employee1"],
            sale_date=date(2020, 1, 1),
            total=Decimal("10.00"),
        )
        session.add(sale)
        session.flush()
        session.add(
            SaleItem(
                sale_id=sale.sale_id,
                product_id=graph["product1"],
                quantity=1,
                unit_price=Decimal("10.00"),
            )
        )
        sale_id = sale.sale_id
    sale = client.get(f"/api/v1/sales/{sale_id}").json()
    assert sale["status"] is None and sale["payment"] is None
    response = command(
        client, f"/api/v1/sales/{sale_id}/void", refund_payload(graph, sale)
    )
    assert (
        response.status_code == 409
        and response.json()["error"]["code"] == "payment_reconciliation_required"
    )
