"""Phase 16 atomic workflows on isolated migrated PostgreSQL."""

import pytest
from sqlalchemy import func, select

from app.modules.cash.models import CashMovement
from app.modules.catalog.models import Product
from app.modules.customers.models import Customer
from app.modules.suppliers.models import Supplier
from tests.integration.test_boutique_experience import boutique, general_sale, post  # noqa: F401

pytestmark = pytest.mark.postgres


def test_permanent_masters_and_read_only_directories(boutique):  # noqa: F811
    client, graph, factory = boutique
    departments = [
        row for row in client.get("/api/v1/departments").json() if row["is_permanent"]
    ]
    municipalities = [
        row
        for row in client.get("/api/v1/municipalities?limit=100").json()
        if row["is_permanent"]
    ]
    assert {row["name"] for row in departments} == {"Managua", "Masaya", "León"}
    assert len(municipalities) == 28
    assert {row["name"] for row in client.get("/api/v1/sizes").json()} == {
        "S",
        "M",
        "L",
        "XL",
        "XXL",
    }
    for row in departments:
        assert (
            client.patch(
                f"/api/v1/departments/{row['department_id']}", json={"name": "Renamed"}
            ).status_code
            == 409
        )
        assert (
            client.delete(f"/api/v1/departments/{row['department_id']}").status_code
            == 409
        )
    assert (
        client.post("/api/v1/departments", json={"name": " león "}).status_code == 409
    )
    for path in ("customers", "suppliers"):
        assert client.post("/api/v1/" + path, json={}).status_code == 403
    assert (
        client.patch(
            f"/api/v1/customers/{graph['customer']}", json={"is_active": False}
        ).status_code
        == 403
    )
    assert client.get("/api/v1/cash/shifts").status_code == 404


def test_customer_sale_rolls_back_and_retries_atomically(boutique):  # noqa: F811
    client, graph, factory = boutique
    payload = general_sale(
        graph,
        customer_kind="regular",
        customer={"first_names": "Atomic", "last_names": "Customer"},
    )
    with factory.begin() as session:
        before = session.scalar(select(func.count()).select_from(Customer))
    payload["payment"]["received_amount"] = "0.00"
    assert (
        client.post(
            "/api/v1/sales",
            json=payload,
            headers={"Idempotency-Key": "inline-rollback"},
        ).status_code
        == 422
    )
    with factory.begin() as session:
        assert session.scalar(select(func.count()).select_from(Customer)) == before
    payload["payment"]["received_amount"] = "1000.00"
    sale = post(client, "sales", payload, "inline-success")
    assert post(client, "sales", payload, "inline-success") == sale
    assert sale["payment"]["shift_id"] is None
    receipt = client.get(f"/api/v1/receipts/{sale['sale_id']}").json()
    assert receipt["receipt_number"] == str(sale["payment"]["payment_id"])
    with factory.begin() as session:
        assert session.scalar(select(func.count()).select_from(Customer)) == before + 1
        assert session.scalar(select(func.count()).select_from(CashMovement)) == 0


def test_purchase_supplier_cost_is_atomic_and_preserves_product_price(boutique):  # noqa: F811
    client, graph, factory = boutique
    dep = client.get("/api/v1/departments").json()[0]["department_id"]
    muni = next(
        row["municipality_id"]
        for row in client.get("/api/v1/municipalities?limit=100").json()
        if row["department_id"] == dep
    )
    supplier = {
        "company_name": "Atomic supplier",
        "contact_first_names": "Test",
        "contact_last_names": "Contact",
        "phone_number": "80000000",
        "address": {
            "department_id": dep,
            "municipality_id": muni,
            "address_line": "Synthetic address",
        },
    }
    payload = {
        "supplier": supplier,
        "employee_id": graph["employee1"],
        "purchase_date": "2026-11-02",
        "items": [
            {"product_id": graph["product1"], "unit_cost": "100.00", "quantity": 2}
        ],
    }
    with factory.begin() as session:
        before = session.scalar(select(func.count()).select_from(Supplier))
        price = session.get(Product, graph["product1"]).unit_price
    bad = {
        **payload,
        "items": [{"product_id": 999999, "unit_cost": "100.00", "quantity": 2}],
    }
    assert (
        client.post(
            "/api/v1/purchases",
            json=bad,
            headers={"Idempotency-Key": "supplier-rollback"},
        ).status_code
        == 422
    )
    with factory.begin() as session:
        assert session.scalar(select(func.count()).select_from(Supplier)) == before
    purchase = post(client, "purchases", payload, "supplier-atomic")
    assert post(client, "purchases", payload, "supplier-atomic") == purchase
    assert purchase["items"][0]["unit_cost"] == "100.00"
    with factory.begin() as session:
        assert session.scalar(select(func.count()).select_from(Supplier)) == before + 1
        assert session.get(Product, graph["product1"]).unit_price == price
    assert (
        client.patch(
            f"/api/v1/suppliers/{purchase['supplier_id']}",
            json={"company_name": "Edited"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/suppliers/{purchase['supplier_id']}", json={"is_active": False}
        ).status_code
        == 200
    )
    payload.pop("supplier")
    payload["supplier_id"] = purchase["supplier_id"]
    assert (
        client.post(
            "/api/v1/purchases",
            json=payload,
            headers={"Idempotency-Key": "inactive-supplier"},
        ).status_code
        == 422
    )


def test_migration_releases_password_policy_without_changing_hash(database_connection):
    from alembic import command
    from sqlalchemy import text

    from app.modules.identity.security import hash_password
    from tests.identity_helpers import SYNTHETIC_PASSWORD
    from tests.integration.conftest import migration_config

    config = migration_config(database_connection)
    command.downgrade(config, "0006_boutique_experience")
    encoded = hash_password(SYNTHETIC_PASSWORD)
    identifier = database_connection.scalar(
        text(
            "INSERT INTO user_accounts(username,password_hash,role,is_active,"
            "must_change_password) VALUES ('migration-colleague',:hash,"
            "'Cashier',true,true) RETURNING user_id"
        ),
        {"hash": encoded},
    )
    command.upgrade(config, "head")
    row = database_connection.execute(
        text(
            "SELECT password_hash,must_change_password FROM user_accounts "
            "WHERE user_id=:id"
        ),
        {"id": identifier},
    ).one()
    assert row.password_hash == encoded and row.must_change_password is False
    assert (
        database_connection.scalar(
            text(
                "SELECT count(*) FROM management_events WHERE record_id=:id "
                "AND action='password_policy_released'"
            ),
            {"id": identifier},
        )
        == 1
    )


def test_multiple_suppliers_keep_independent_purchase_costs(boutique):  # noqa: F811
    client, graph, factory = boutique
    purchases = []
    for supplier_id, cost in (
        (graph["supplier1"], "40.00"),
        (graph["supplier2"], "60.00"),
        (graph["supplier1"], "45.00"),
    ):
        payload = {
            "supplier_id": supplier_id,
            "employee_id": graph["employee1"],
            "purchase_date": "2026-11-02",
            "items": [
                {"product_id": graph["product1"], "unit_cost": cost, "quantity": 1}
            ],
        }
        purchase = post(
            client,
            "purchases",
            payload,
            f"supplier-cost-{supplier_id}-{cost.replace(chr(46), chr(95))}",
        )
        purchases.append((purchase["purchase_id"], cost))
    for identifier, cost in purchases:
        assert (
            client.get(f"/api/v1/purchases/{identifier}").json()["items"][0][
                "unit_cost"
            ]
            == cost
        )
    catalog = client.get("/api/v1/reports/product-catalog").json()["items"]
    row = next(row for row in catalog if row["product_id"] == graph["product1"])
    assert len(row["suppliers"]) >= 3


def test_upgrade_reuses_masters_and_preserves_supplier_and_cash_history(
    database_connection,
):
    from alembic import command
    from sqlalchemy import text
    from sqlalchemy.orm import Session

    from tests.integration.conftest import migration_config
    from tests.sales_helpers import seed_sales

    config = migration_config(database_connection)
    with (
        Session(
            bind=database_connection, join_transaction_mode="create_savepoint"
        ) as session,
        session.begin(),
    ):
        graph = seed_sales(session)
    command.downgrade(config, "0006_boutique_experience")
    database_connection.execute(
        text("INSERT INTO departments(department_id,name) VALUES (700,' león ')")
    )
    database_connection.execute(
        text("INSERT INTO sizes(size_id,name) VALUES (800,'S')")
    )
    database_connection.execute(
        text(
            "INSERT INTO cash_movements(shift_id,kind,amount,reason,created_at,"
            "performed_by_user_id) VALUES (:shift,'deposit',5,'Synthetic',now(),:actor)"
        ),
        {"shift": graph["shift"], "actor": graph["admin"]},
    )
    tables = (
        "cash_shifts",
        "cash_movements",
        "supplier_products",
        "supplier_offerings",
    )
    before = {
        name: list(database_connection.execute(text(f"SELECT * FROM {name}")))
        for name in tables
    }
    command.upgrade(config, "head")
    for name, rows in before.items():
        assert list(database_connection.execute(text(f"SELECT * FROM {name}"))) == rows
    assert database_connection.scalar(
        text("SELECT is_permanent FROM departments WHERE department_id=700")
    )
    assert (
        database_connection.scalar(
            text("SELECT name FROM departments WHERE department_id=700")
        )
        == " león "
    )
    assert (
        database_connection.scalar(text("SELECT count(*) FROM sizes WHERE name='S'"))
        == 1
    )
    assert database_connection.scalar(
        text("SELECT is_permanent FROM sizes WHERE size_id=800")
    )
    assert (
        database_connection.scalar(
            text("SELECT count(*) FROM departments WHERE is_permanent")
        )
        == 3
    )
    command.check(config)


def test_shiftless_activity_blocks_lossy_downgrade(boutique):  # noqa: F811
    from alembic import command
    from sqlalchemy.exc import IntegrityError

    from tests.integration.conftest import migration_config

    client, graph, factory = boutique
    connection = factory.kw["bind"]
    sale = post(client, "sales", general_sale(graph), "downgrade-guard")
    with pytest.raises(IntegrityError), connection.begin_nested():
        command.downgrade(migration_config(connection), "0008_permanent_references")
    assert client.get(f"/api/v1/sales/{sale['sale_id']}").status_code == 200
