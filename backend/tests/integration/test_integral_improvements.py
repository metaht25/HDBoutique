"""RF-01..18 regressions against isolated PostgreSQL; no development data."""
# ruff: noqa: F811

from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.modules.catalog.models import Product
from app.modules.customers.models import Customer
from app.modules.inventory.models import InventoryMovement
from app.modules.suppliers.models import SupplierOffering, SupplierProduct
from tests.identity_helpers import login
from tests.integration.test_boutique_experience import (  # noqa: F401
    address,
    boutique,
    general_sale,
    post,
)

pytestmark = pytest.mark.postgres


def test_employee_default_is_vendedor_and_arbitrary_titles_are_rejected(boutique):
    client, graph, _ = boutique
    body = {
        "first_names": "Synthetic",
        "last_names": "Vendedor",
        "username": "rf-vendor",
        "password": "Synthetic-password-27!",
        "phone_number": "7123-4567",
        "address": address(client, graph),
    }
    assert (
        client.post(
            "/api/v1/employees", json={**body, "job_title": "Administrator"}
        ).status_code
        == 422
    )
    result = post(client, "employees", body)
    assert result["job_title"] == "Vendedor" and result["phone_number"] == "71234567"
    assert (
        client.patch(
            f"/api/v1/employees/{result['employee_id']}", json={"job_title": None}
        ).status_code
        == 422
    )


def test_product_suppliers_zero_inventory_and_no_duplicate_associations(boutique):
    client, graph, factory = boutique
    body = {
        "name": "Synthetic RF product",
        "category_id": graph["category"],
        "size_id": client.get("/api/v1/sizes").json()[0]["size_id"],
        "cost": "100.10",
        "supplier_ids": [graph["supplier1"], graph["supplier2"]],
    }
    assert (
        client.post("/api/v1/products", json={**body, "initial_stock": 1}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/products", json={**body, "supplier_ids": [2147483647]}
        ).status_code
        == 422
    )
    assert (
        client.post("/api/v1/products", json={**body, "supplier_ids": []}).status_code
        == 422
    )
    result = post(client, "products", body)
    assert result["legacy_stock"] == 0 and result["unit_price"] == "115.12"
    path = f"/api/v1/products/{result['product_id']}"
    assert (
        client.patch(path, json={"supplier_ids": body["supplier_ids"]}).status_code
        == 200
    )
    with factory.begin() as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(SupplierOffering)
                .join(SupplierProduct)
                .where(SupplierProduct.product_id == result["product_id"])
            )
            == 2
        )
        movement = session.scalar(
            select(InventoryMovement).where(
                InventoryMovement.product_id == result["product_id"]
            )
        )
        assert movement.quantity == 0 and movement.stock_after == 0
    assert (
        client.get(
            f"/api/v1/reports/product-catalog?supplier_id={graph['supplier2']}"
        ).json()["items"][0]["product_id"]
        == result["product_id"]
    )
    assert result["product_id"] not in [
        row["product_id"]
        for row in client.get("/api/v1/reports/product-catalog?status=sellable").json()[
            "items"
        ]
    ]
    offering = next(
        row
        for row in client.get("/api/v1/supplier-offerings").json()
        if row["supplier_id"] == graph["supplier2"]
    )
    association = {
        "supplier_id": offering["supplier_id"],
        "supplier_product_id": offering["supplier_product_id"],
    }
    assert (
        client.post("/api/v1/supplier-offerings", json=association).status_code == 409
    )
    assert (
        client.patch(
            f"/api/v1/suppliers/{graph['supplier2']}", json={"is_active": False}
        ).status_code
        == 200
    )
    assert (
        client.post("/api/v1/supplier-offerings", json=association).status_code == 422
    )


def test_purchase_cost_is_server_owned_snapshot_and_receipt_uses_session(boutique):
    client, graph, factory = boutique
    body = {
        "supplier_id": graph["supplier1"],
        "purchase_date": "2026-11-03",
        "items": [{"product_id": graph["product1"], "quantity": 2}],
    }
    assert (
        client.post(
            "/api/v1/purchases",
            json={**body, "items": [{**body["items"][0], "unit_cost": "0.01"}]},
            headers={"Idempotency-Key": "rf-bad-cost"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/purchases",
            json={**body, "supplier_id": graph["supplier2"]},
            headers={"Idempotency-Key": "rf-bad-supplier"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/purchases",
            json={**body, "employee_id": graph["employee2"]},
            headers={"Idempotency-Key": "rf-bad-actor"},
        ).status_code
        == 422
    )
    result = post(client, "purchases", body, "rf-purchase")
    assert result["employee_id"] == graph["employee1"]
    assert result["items"][0]["unit_cost"] == "120.50"
    with factory.begin() as session:
        session.get(Product, graph["product1"]).cost = Decimal("200.00")
    assert post(client, "purchases", body, "rf-purchase") == result
    for _ in range(2):
        received = client.post(
            f"/api/v1/purchases/{result['purchase_id']}/receive", json={}
        )
        assert received.status_code == 200
        assert received.json()["items"][0]["unit_cost"] == "120.50"
        assert received.json()["received_employee_id"] == graph["employee1"]
    assert (
        client.get(f"/api/v1/products/{graph['product1']}").json()["legacy_stock"] == 14
    )


def test_existing_customer_delivery_update_is_atomic_and_snapshots_are_immutable(
    boutique,
):
    client, graph, factory = boutique
    body = general_sale(graph, customer_kind="regular", customer_id=graph["customer"])
    first = post(client, "sales", body, "rf-regular")
    details = {"phone_number": "8123-4567", "address": address(client, graph)}
    delivery = {
        **body,
        "customer_kind": "delivery",
        "delivery_details": details,
        "delivery_cost": "10.00",
        "payment": {"method": "cash", "received_amount": "1000.00"},
    }
    invalid = {**delivery, "payment": {"method": "cash", "received_amount": "0.00"}}
    assert (
        client.post(
            "/api/v1/sales",
            json=invalid,
            headers={"Idempotency-Key": "rf-delivery-fail"},
        ).status_code
        == 422
    )
    with factory.begin() as session:
        assert session.get(Customer, graph["customer"]).phone_number == "00000000"
        count = session.scalar(select(func.count()).select_from(Customer))
    saved = post(client, "sales", delivery, "rf-delivery")
    assert saved["customer_id"] == first["customer_id"]
    assert saved["customer_phone"] == "81234567"
    assert post(client, "sales", delivery, "rf-delivery") == saved
    third = post(client, "sales", body, "rf-presential")
    assert third["customer_phone"] is None and third["customer_address"] is None
    assert client.get(f"/api/v1/sales/{first['sale_id']}").json() == first
    with factory.begin() as session:
        assert session.scalar(select(func.count()).select_from(Customer)) == count
        assert session.get(Customer, graph["customer"]).phone_number == "81234567"


def test_mixed_payment_optional_reference_confirmation_and_last_unit(boutique):
    client, graph, factory = boutique
    with factory.begin() as session:
        session.get(Product, graph["product1"]).legacy_stock = 1
    login(client, "purchasing-cashier")
    body = general_sale(
        graph,
        payment={
            "method": "mixed",
            "received_amount": "100.00",
            "transfer_amount": "100.00",
            "reference": "",
            "transfer_confirmed": False,
        },
    )
    assert (
        client.post(
            "/api/v1/sales", json=body, headers={"Idempotency-Key": "rf-mixed"}
        ).status_code
        == 422
    )
    body["payment"]["transfer_confirmed"] = True
    result = post(client, "sales", body, "rf-mixed")
    assert result["employee_id"] == graph["employee2"]
    assert result["payment"]["cash_amount"] == "99.50"
    assert result["payment"]["change_amount"] == "0.50"
    assert result["payment"]["reference"] is None
    assert client.get(f"/api/v1/receipts/{result['sale_id']}").status_code == 200
    assert graph["product1"] not in [
        row["product_id"]
        for row in client.get("/api/v1/reports/product-catalog?status=sellable").json()[
            "items"
        ]
    ]
    assert (
        client.get(
            f"/api/v1/reports/product-catalog?supplier_id={graph['supplier1']}"
        ).status_code
        == 403
    )
    assert client.get("/api/v1/dashboard/overview").json()["series"] == []


def test_dashboard_daily_series_excludes_voided_sales(boutique):
    client, graph, _ = boutique
    result = post(client, "sales", general_sale(graph), "rf-dashboard")
    report = client.get("/api/v1/dashboard/overview?period=month").json()
    assert report["context"]["timezone"] == "America/Managua"
    assert sum(row["count"] for row in report["series"]) == 1
    assert sum(Decimal(row["amount"]) for row in report["series"]) == Decimal(
        result["total"]
    )
    assert (
        client.post(
            f"/api/v1/sales/{result['sale_id']}/void",
            headers={"Idempotency-Key": "rf-dashboard-void"},
            json={
                "reason": "Synthetic RF",
                "refund_confirmed": True,
                "items": [
                    {
                        "sale_item_id": result["items"][0]["sale_item_id"],
                        "returned_quantity": 0,
                    }
                ],
            },
        ).status_code
        == 201
    )
    report = client.get("/api/v1/dashboard/overview?period=month").json()
    assert all(
        row["count"] == 0 and Decimal(row["amount"]) == 0 for row in report["series"]
    )
