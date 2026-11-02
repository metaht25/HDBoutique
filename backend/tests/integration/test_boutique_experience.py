"""Current boutique contracts on an isolated PostgreSQL snapshot transaction."""

import base64
from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.main import create_app
from app.modules.catalog.models import Product
from app.modules.customers.models import Customer
from app.modules.identity.models import UserAccount
from app.modules.inventory.models import InventoryMovement
from app.modules.locations.models import Address
from app.modules.staff.models import Employee
from tests.identity_helpers import SYNTHETIC_PASSWORD, TEST_ORIGIN, login
from tests.sales_helpers import seed_sales

pytestmark = pytest.mark.postgres


@pytest.fixture
def boutique(postgres_engine):
    with postgres_engine.connect().execution_options(
        isolation_level="REPEATABLE READ"
    ) as connection:
        transaction = connection.begin()
        factory = sessionmaker(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        with factory.begin() as session:
            graph = seed_sales(session)
        app = create_app(
            Settings(
                environment="test",
                business_api_enabled=True,
                auth_origin=TEST_ORIGIN,
            )
        )
        app.state.session_factory = factory
        try:
            with TestClient(
                app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
            ) as client:
                login(client, "purchasing-administrator")
                yield client, graph, factory
        finally:
            transaction.rollback()


def post(client, resource, body, key=None):
    response = client.post(
        "/api/v1/" + resource,
        json=body,
        headers={"Idempotency-Key": key} if key else {},
    )
    assert response.status_code == 201, response.text
    return response.json()


def address(client, graph):
    municipality = post(
        client,
        "municipalities",
        {
            "department_id": graph["department"],
            "name": "Synthetic municipality",
        },
    )
    return {
        "department_id": graph["department"],
        "municipality_id": municipality["municipality_id"],
        "address_line": "Synthetic exact address",
    }


def general_sale(graph, **changes):
    return {
        "customer_kind": "general",
        "employee_id": graph["employee1"],
        "items": [{"product_id": graph["product1"], "quantity": 1}],
        "payment": {
            "method": "cash",
            "received_amount": "200.00",
        },
        **changes,
    }


def test_initial_stock_automatic_markup_and_deactivation(boutique):
    client, graph, factory = boutique
    body = {
        "name": "Synthetic new product",
        "category_id": graph["category"],
        "size_id": client.get("/api/v1/sizes").json()[0]["size_id"],
        "cost": "100.10",
        "initial_stock": 5,
    }
    product = post(client, "products", body)
    assert product["unit_price"] == "115.12"
    with factory.begin() as session:
        movement = session.scalar(
            select(InventoryMovement).where(
                InventoryMovement.product_id == product["product_id"]
            )
        )
        assert movement.movement_type == "initial_stock"
        assert (movement.quantity, movement.stock_before, movement.stock_after) == (
            5,
            0,
            5,
        )
        assert movement.performed_by_user_id == graph["admin"]
    assert (
        client.patch(
            f"/api/v1/products/{product['product_id']}", json={"unit_price": "1.00"}
        ).status_code
        == 422
    )
    report = client.get("/api/v1/reports/product-catalog?status=low_stock").json()
    assert report["summary"]["total_count"] == 1
    assert report["items"][0]["product_id"] == product["product_id"]
    assert (
        client.patch(
            f"/api/v1/products/{product['product_id']}", json={"is_active": False}
        ).status_code
        == 200
    )
    payload = general_sale(
        graph, items=[{"product_id": product["product_id"], "quantity": 1}]
    )
    assert (
        client.post(
            "/api/v1/sales",
            json=payload,
            headers={"Idempotency-Key": "inactive-product"},
        ).status_code
        == 422
    )
    assert client.delete(f"/api/v1/products/{product['product_id']}").status_code == 409
    assert (
        client.patch(
            f"/api/v1/products/{product['product_id']}", json={"is_active": True}
        ).status_code
        == 200
    )


def test_general_identity_server_date_and_retries(boutique):
    client, graph, factory = boutique
    payload = general_sale(graph, sale_date="1990-01-01")
    first = post(client, "sales", payload, "general-sale-first")
    assert (
        first["sale_date"]
        == datetime.now(ZoneInfo("America/Managua")).date().isoformat()
    )
    assert first["customer_name"] == "Cliente general"
    assert first["payment"]["cash_amount"] == "199.50"
    assert first["payment"]["transfer_amount"] == "0.00"
    assert post(client, "sales", payload, "general-sale-first") == first
    second = post(client, "sales", payload, "general-sale-second")
    assert first["customer_id"] == second["customer_id"]
    with factory.begin() as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(Customer)
                .where(Customer.technical_key == "general")
            )
            == 1
        )
        assert session.get(Product, graph["product1"]).legacy_stock == 10


def test_delivery_mixed_payment_receipt_pdf_and_partial_return(boutique):
    client, graph, factory = boutique
    customer = {
        "first_names": "Synthetic",
        "last_names": "Delivery",
        "kind": "delivery",
        "phone_number": "0000000000",
        "address": address(client, graph),
    }
    payload = general_sale(
        graph,
        customer_kind="delivery",
        customer=customer,
        delivery_cost="50.00",
        notes="Synthetic delivery note",
        payment={
            "method": "mixed",
            "transfer_amount": "100.00",
            "received_amount": "200.00",
            "reference": "SYNTHETIC-TRANSFER",
            "transfer_confirmed": True,
        },
    )
    sale = post(client, "sales", payload, "mixed-delivery-sale")
    assert sale["total"] == "249.50"
    assert sale["payment"]["cash_amount"] == "149.50"
    assert sale["payment"]["transfer_amount"] == "100.00"
    assert sale["payment"]["change_amount"] == "50.50"
    assert client.get("/api/v1/cash/shifts").status_code == 404
    receipt = client.get(f"/api/v1/receipts/{sale['sale_id']}")
    assert receipt.status_code == 200, receipt.text
    assert receipt.json()["sale"]["customer_address"]
    pdf = client.get(f"/api/v1/receipts/{sale['sale_id']}/pdf")
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF-") and b"226.7717" in pdf.content
    body = {
        "reason": "Synthetic supervised correction",
        "refund_confirmed": True,
        "reference": "SYNTHETIC-REFUND",
        "items": [
            {"sale_item_id": sale["items"][0]["sale_item_id"], "returned_quantity": 0}
        ],
    }
    refund = post(client, f"sales/{sale['sale_id']}/void", body, "mixed-refund-key")
    assert refund["cash_amount"] == "149.50" and refund["transfer_amount"] == "100.00"
    assert (
        post(client, f"sales/{sale['sale_id']}/void", body, "mixed-refund-key")
        == refund
    )
    assert client.get("/api/v1/cash/shifts").status_code == 404
    with factory.begin() as session:
        assert session.get(Product, graph["product1"]).legacy_stock == 11
    ledger = client.get("/api/v1/reports/sales-ledger").json()
    assert (
        ledger["summary"]["total_count"] == 1
        and ledger["summary"]["total_amount"] == "0.00"
    )
    assert ledger["items"][0]["status"] == "voided"


def test_direct_addresses_and_atomic_employee_access(boutique):
    client, graph, factory = boutique
    inline = address(client, graph)
    body = {
        "first_names": "Synthetic",
        "last_names": "Colleague",
        "phone_number": "80000000",
        "job_title": "Ventas",
        "address": inline,
        "username": "synthetic-new-colleague",
        "password": SYNTHETIC_PASSWORD,
    }
    employee = post(client, "employees", body)
    with factory.begin() as session:
        account = session.scalar(
            select(UserAccount).where(
                UserAccount.employee_id == employee["employee_id"]
            )
        )
        assert account.role == "Cashier" and not account.must_change_password
        assert account.password_hash != SYNTHETIC_PASSWORD
        counts = [
            session.scalar(select(func.count()).select_from(model))
            for model in (Employee, Address, UserAccount)
        ]
    assert client.post("/api/v1/employees", json=body).status_code == 409
    with factory.begin() as session:
        assert [
            session.scalar(select(func.count()).select_from(model))
            for model in (Employee, Address, UserAccount)
        ] == counts
    login(client, "synthetic-new-colleague")
    assert client.get("/api/v1/auth/me").json()["must_change_password"] is False
    assert client.get("/api/v1/products").status_code == 200
    response = client.post(
        "/api/v1/auth/password",
        json={
            "current_password": SYNTHETIC_PASSWORD,
            "new_password": "new-synthetic-password-42",
        },
    )
    assert response.status_code == 403, response.text
    assert client.get("/api/v1/auth/me").status_code == 200
    login(client, "purchasing-administrator")
    assert (
        client.patch(
            f"/api/v1/employees/{employee['employee_id']}", json={"is_active": False}
        ).status_code
        == 200
    )
    with factory.begin() as session:
        assert session.get(Employee, employee["employee_id"]).is_active is False
        assert (
            session.scalar(
                select(UserAccount).where(
                    UserAccount.employee_id == employee["employee_id"]
                )
            ).is_active
            is False
        )
    assert all(
        row["employee_id"] != employee["employee_id"]
        for row in client.get("/api/v1/employee-options").json()
    )
    assert (
        client.patch(
            f"/api/v1/employees/{employee['employee_id']}",
            json={"is_active": True, "password": SYNTHETIC_PASSWORD},
        ).status_code
        == 200
    )
    login(client, "synthetic-new-colleague")
    assert client.get("/api/v1/auth/me").json()["must_change_password"] is False


def test_reports_scope_private_fields_and_own_receipts(boutique):
    client, graph, _ = boutique
    owner_sale = post(client, "sales", general_sale(graph), "owner-sale-0001")
    for path in (
        "reports/product-catalog",
        "reports/customer-directory",
        "reports/supplier-directory",
        "reports/employee-directory",
        "reports/purchase-ledger",
        "reports/sales-ledger",
        "dashboard/overview",
    ):
        response = client.get("/api/v1/" + path)
        assert response.status_code == 200, (path, response.text)
    login(client, "purchasing-cashier")
    products = client.get("/api/v1/reports/product-catalog").json()
    assert "inventory_value" not in products["summary"]
    assert all(
        not ({"cost", "supplier_id", "supplier_name"} & set(row))
        for row in products["items"]
    )
    assert client.get("/api/v1/reports/sales-ledger").json()["items"] == []
    assert client.get(f"/api/v1/receipts/{owner_sale['sale_id']}").status_code == 404
    assert (
        client.get(f"/api/v1/receipts/{owner_sale['sale_id']}/pdf").status_code == 404
    )
    own = post(client, "sales", general_sale(graph), "cashier-sale-0001")
    assert client.get(f"/api/v1/receipts/{own['sale_id']}").status_code == 200
    assert (
        client.get("/api/v1/dashboard/overview").json()["summary"]["today_count"] == 1
    )
    for path in (
        "suppliers",
        "supplier-products",
        "supplier-offerings",
        "employees",
        "users",
        "boutique-profile",
        "reports/supplier-directory",
        "reports/employee-directory",
        "reports/purchase-ledger",
        "reports/sales",
        "reports/customers",
        "dashboard",
    ):
        assert client.get("/api/v1/" + path).status_code == 403, path


def test_ledger_keeps_row_units_distinct_from_global_summary(boutique):
    client, graph, _ = boutique
    first = post(client, "sales", general_sale(graph), "ledger-first-0001")
    second = post(
        client,
        "sales",
        general_sale(
            graph,
            items=[{"product_id": graph["product1"], "quantity": 2}],
            payment={
                "method": "cash",
                "received_amount": "400.00",
            },
        ),
        "ledger-second-0002",
    )
    for suffix in ("", "?receipts=true"):
        ledger = client.get("/api/v1/reports/sales-ledger" + suffix).json()
        assert ledger["summary"]["units"] == 3
        assert {row["sale_id"]: row["units"] for row in ledger["items"]} == {
            first["sale_id"]: 1,
            second["sale_id"]: 2,
        }
    page = client.get("/api/v1/reports/sales-ledger?limit=1&offset=1").json()
    assert page["summary"]["units"] == 3
    assert len(page["items"]) == 1 and page["items"][0]["units"] == 1
    empty = client.get("/api/v1/reports/sales-ledger?offset=50").json()
    assert empty["summary"]["units"] == 3 and empty["items"] == []
    overview = client.get("/api/v1/dashboard/overview").json()
    assert overview["summary"]["today_units"] == 3
    assert overview["summary"]["month_units"] == 3


def test_logo_sanitization_and_delivery_references(boutique):
    client, graph, factory = boutique
    assert client.get("/api/v1/boutique-profile").json()["ready"] is False
    raw = BytesIO()
    Image.new("RGB", (20, 20), "pink").save(raw, format="PNG")
    payload = {
        "name": "Synthetic boutique",
        "phone_number": "00000000",
        "address_line": "Synthetic address",
        "logo_base64": base64.b64encode(raw.getvalue()).decode(),
    }
    response = client.put("/api/v1/boutique-profile", json=payload)
    assert response.status_code == 200 and response.json()["ready"] is True
    assert base64.b64decode(response.json()["logo_base64"]).startswith(b"\x89PNG")
    payload["logo_base64"] = base64.b64encode(b"<svg onload='bad()'/>").decode()
    assert client.put("/api/v1/boutique-profile", json=payload).status_code == 422
    inline = address(client, graph)
    other = post(client, "departments", {"name": "Synthetic other"})
    inline["department_id"] = other["department_id"]
    with factory.begin() as session:
        count = session.scalar(select(func.count()).select_from(Address))
    response = client.post(
        "/api/v1/sales",
        json=general_sale(
            graph,
            customer_kind="delivery",
            customer={
                "kind": "delivery",
                "first_names": "Synthetic",
                "last_names": "Mismatch",
                "phone_number": "00000000",
                "address": inline,
            },
        ),
        headers={"Idempotency-Key": "invalid-delivery-inline"},
    )
    assert response.status_code == 422
    with factory.begin() as session:
        assert session.scalar(select(func.count()).select_from(Address)) == count


@pytest.mark.parametrize(
    "transfer,received",
    [("0.00", "200.00"), ("199.50", "0.00"), ("200.00", "0.00"), ("100.00", "99.49")],
)
def test_invalid_mixed_amounts_leave_inventory_unchanged(boutique, transfer, received):
    client, graph, factory = boutique
    payload = general_sale(
        graph,
        payment={
            "method": "mixed",
            "transfer_amount": transfer,
            "received_amount": received,
            "reference": "SYNTHETIC",
            "transfer_confirmed": True,
        },
    )
    assert (
        client.post(
            "/api/v1/sales",
            json=payload,
            headers={"Idempotency-Key": "invalid-mixed-pay"},
        ).status_code
        == 422
    )
    with factory.begin() as session:
        assert session.get(Product, graph["product1"]).legacy_stock == 12
        assert (
            session.scalar(
                select(func.count())
                .select_from(Customer)
                .where(Customer.technical_key == "general")
            )
            == 0
        )


@pytest.mark.parametrize("value", [True, 100.1, "100.001", "NaN", "86956521.74"])
def test_product_cost_rejects_inexact_or_overflow_values(boutique, value):
    client, graph, factory = boutique
    body = {
        "name": "Rejected cost",
        "cost": value,
        "initial_stock": 5,
        "category_id": graph["category"],
        "size_id": client.get("/api/v1/sizes").json()[0]["size_id"],
    }
    with factory.begin() as session:
        count = session.scalar(select(func.count()).select_from(Product))
    assert client.post("/api/v1/products", json=body).status_code == 422
    with factory.begin() as session:
        assert session.scalar(select(func.count()).select_from(Product)) == count


def test_retired_role_cannot_log_in_or_be_created(boutique):
    client, _, _ = boutique
    response = client.post(
        "/api/v1/users",
        json={
            "username": "retired-new",
            "password": SYNTHETIC_PASSWORD,
            "role": "Manager",
        },
    )
    assert response.status_code == 422
    client.post("/api/v1/auth/logout")
    csrf = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "purchasing-manager", "password": SYNTHETIC_PASSWORD},
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 401
