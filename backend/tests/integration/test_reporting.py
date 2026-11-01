"""Reports aggregate full synthetic datasets; no production connections."""

from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import insert, update

from app.modules.catalog.models import Product
from app.modules.customers.models import CustomerType
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.sales.models import Sale
from app.modules.suppliers.models import SupplierProduct
from tests.identity_helpers import login
from tests.integration.test_sales import register, sales_context  # noqa: F401
from tests.purchase_helpers import purchase_payload

pytestmark = pytest.mark.postgres


def test_sales_totals_are_global_exact_and_filter_document_dates(sales_context) -> None:  # noqa: F811
    client, graph, factory, _, _ = sales_context
    with patch("app.modules.sales.service.datetime") as clock:
        clock.now.side_effect = lambda tz: datetime(
            2026, 10, 28, 18, 0, tzinfo=UTC
        ).astimezone(tz)
        assert register(client, graph).status_code == 201
    with factory.begin() as session:
        session.execute(
            insert(Sale),
            [
                dict(
                    customer_id=graph["customer"],
                    employee_id=graph["employee1"],
                    sale_date=date(2026, 10, 28),
                    total=Decimal("199.50"),
                )
                for _ in range(21)
            ],
        )
        session.execute(
            insert(Sale),
            [
                dict(
                    customer_id=graph["customer"],
                    employee_id=graph["employee1"],
                    sale_date=date(2026, 10, day),
                    total=Decimal("99999999.99"),
                )
                for day in (27, 29)
            ],
        )
        session.execute(update(Product).values(unit_price=Decimal("1.00")))
    path = "/api/v1/reports/sales?start_date=2026-10-28&end_date=2026-10-28&limit=20"
    response = client.get(path)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["summary"] == {
        "total_count": 22,
        "total_amount": "5187.00",
        "legacy_count": 21,
    }
    assert len(report["items"]) == 20
    second = client.get(path + "&offset=20").json()
    assert len(second["items"]) == 2 and second["summary"] == report["summary"]
    assert not (
        {r["sale_id"] for r in report["items"]}
        & {r["sale_id"] for r in second["items"]}
    )
    empty = client.get(path + "&offset=999").json()
    assert empty["items"] == [] and empty["summary"] == report["summary"]
    assert (
        client.get("/api/v1/reports/sales").json()["summary"]["total_amount"]
        == "200005186.98"
    )
    assert (
        client.get("/api/v1/reports/sales?start_date=2030-01-01").json()["summary"][
            "total_amount"
        ]
        == "0.00"
    )


def test_purchases_keep_historical_costs_and_missing_amounts(sales_context) -> None:  # noqa: F811
    client, graph, factory, _, _ = sales_context
    response = client.post(
        "/api/v1/purchases",
        json=purchase_payload(graph),
        headers={"Idempotency-Key": "report-purchase-01"},
    )
    assert response.status_code == 201, response.text
    with factory.begin() as session:
        session.execute(
            update(SupplierProduct).values(purchase_price=Decimal("999.99"))
        )
        purchase = Purchase(
            supplier_id=graph["supplier1"],
            employee_id=graph["employee1"],
            purchase_date=date(2026, 10, 28),
            shipping_cost=None,
        )
        session.add(purchase)
        session.flush()
        session.add(
            PurchaseItem(
                purchase_id=purchase.purchase_id,
                supplier_product_id=graph["supplier_product1"],
                quantity=100,
            )
        )
    response = client.get("/api/v1/reports/purchases?limit=1")
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["summary"] == {
        "total_count": 2,
        "known_merchandise_total": "346.75",
        "unknown_merchandise_count": 1,
        "known_shipping_total": "50.00",
        "unknown_shipping_count": 1,
        "known_total": "396.75",
        "unknown_total_count": 1,
        "legacy_count": 1,
    }
    assert (
        report["items"][0]["total"] is None and report["items"][0]["status"] == "legacy"
    )
    second = client.get("/api/v1/reports/purchases?limit=1&offset=1").json()
    assert (
        second["summary"] == report["summary"]
        and second["items"][0]["total"] == "396.75"
    )
    assert (
        client.get("/api/v1/reports/purchases?start_date=2030-01-01").json()["summary"][
            "known_total"
        ]
        == "0.00"
    )


def test_inventory_boundaries_and_customer_group_identity(sales_context) -> None:  # noqa: F811
    client, graph, factory, _, _ = sales_context
    with factory.begin() as session:
        for stock in (None, -1, 0, 1, 5, 6):
            session.add(
                Product(
                    name=None,
                    category_id=graph["category"],
                    size_id=graph["size"],
                    unit_price=None,
                    legacy_stock=stock,
                    legacy_stock_quantity=999,
                )
            )
        session.add_all([CustomerType(name="Synthetic"), CustomerType(name=None)])
    report = client.get("/api/v1/reports/inventory?limit=1").json()
    assert report["summary"] == {
        "available": 3,
        "out_of_stock": 1,
        "low_stock": 2,
        "unknown": 1,
        "invalid": 1,
    }
    assert report["total_count"] == 8 and len(report["items"]) == 1
    for state, expected in (("unknown", None), ("invalid", -1), ("out_of_stock", 0)):
        filtered = client.get(
            "/api/v1/reports/inventory", params={"status": state}
        ).json()
        assert filtered["summary"] == report["summary"] and filtered["total_count"] == 1
        assert filtered["items"][0]["available_stock"] == expected
        assert filtered["items"][0]["historical_stock"] == 999
    groups = client.get("/api/v1/reports/customers?limit=1&offset=1").json()
    assert groups["total_count"] == 1 and groups["group_count"] == 3
    assert groups["items"][0]["customer_count"] == 0
    assert client.get("/api/v1/reports/customers?offset=99").json()["total_count"] == 1


@pytest.mark.parametrize("role", ["administrator"])
def test_reporting_access_and_business_midnight(sales_context, role: str) -> None:  # noqa: F811
    client, graph, factory, _, _ = sales_context
    with patch("app.modules.sales.service.datetime") as clock:
        clock.now.side_effect = lambda tz: datetime(
            2026, 10, 28, 18, 0, tzinfo=UTC
        ).astimezone(tz)
        assert register(client, graph).status_code == 201
    login(client, "purchasing-" + role)
    for now, expected, count in (
        (datetime(2026, 10, 29, 0, 30, tzinfo=UTC), "2026-10-28", 1),
        (datetime(2026, 10, 29, 6, 0, tzinfo=UTC), "2026-10-29", 0),
    ):
        with patch("app.modules.reporting.service.utc_now", return_value=now):
            response = client.get("/api/v1/dashboard")
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["context"]["business_date"] == expected
        assert body["context"]["start_date"] == expected == body["context"]["end_date"]
        assert body["sales"]["total_count"] == count
        assert body["product_count"] == 2 and body["customer_count"] == 1
        assert ("staff" in body) is (role != "cashier")
        if role == "cashier":
            assert not any(
                key in response.text for key in ("supplier", "purchase", "cost")
            )
    for report in ("sales", "inventory", "customers"):
        assert client.get("/api/v1/reports/" + report).status_code == 200
    assert client.get("/api/v1/reports/purchases").status_code == (
        403 if role == "cashier" else 200
    )
    client.post("/api/v1/auth/logout")
    for path in (
        "dashboard",
        "reports/sales",
        "reports/purchases",
        "reports/inventory",
        "reports/customers",
    ):
        assert client.get("/api/v1/" + path).status_code == 401


@pytest.mark.parametrize(
    "query",
    [
        "start_date=2026-10-29&end_date=2026-10-28",
        "start_date=bad",
        "end_date=2026-02-30",
        "limit=101",
        "offset=-1",
    ],
)
def test_report_filters_reject_invalid_ranges(sales_context, query: str) -> None:  # noqa: F811
    client: TestClient = sales_context[0]
    assert client.get("/api/v1/reports/sales?" + query).status_code == 422
    assert client.get("/api/v1/reports/purchases?" + query).status_code == 422


def test_empty_reports_and_invalid_stock_filter(sales_context) -> None:  # noqa: F811
    client = sales_context[0]
    for report in ("sales", "purchases"):
        body = client.get("/api/v1/reports/" + report).json()
        assert body["items"] == [] and body["summary"]["total_count"] == 0
    assert client.get("/api/v1/reports/inventory?status=bad").status_code == 422
