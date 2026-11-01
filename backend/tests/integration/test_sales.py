"""Sales HTTP, atomic rollback, exact money and historical fidelity on PostgreSQL."""

from dataclasses import replace
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import func, insert, select, update
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.core.errors import ApplicationError
from app.main import create_app
from app.modules.catalog.models import Product
from app.modules.identity.models import UserAccount
from app.modules.identity.service import principal_from_user
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.purchases.schemas import PurchaseCreate
from app.modules.purchases.service import PurchaseService
from app.modules.sales.models import Sale, SaleItem
from app.modules.sales.repository import SaleRepository
from app.modules.sales.schemas import SaleCreate
from app.modules.sales.service import SaleService
from app.modules.sales.workflow_models import SaleWorkflow
from tests.identity_helpers import TEST_ORIGIN, login
from tests.purchase_helpers import purchase_payload
from tests.sales_helpers import sale_payload, seed_sales

pytestmark = pytest.mark.postgres


@pytest.fixture
def sales_context(database_connection):
    app = create_app(
        Settings(environment="test", business_api_enabled=True, auth_origin=TEST_ORIGIN)
    )
    factory = sessionmaker(
        bind=database_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    app.state.session_factory = factory
    with factory.begin() as session:
        graph = seed_sales(session)
        actor = principal_from_user(session.get(UserAccount, graph["admin"]))
    with TestClient(
        app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as client:
        login(client, "purchasing-administrator")
        yield client, graph, factory, actor, app


def register(client, graph, key="synthetic-sale-01", payload=None):
    return client.post(
        "/api/v1/sales",
        json=payload or sale_payload(graph),
        headers={"Idempotency-Key": key},
    )


def test_complete_sale_history_and_retry(sales_context, database_connection) -> None:
    client, graph, _, _, _ = sales_context
    response = register(client, graph)
    assert response.status_code == 201, response.text
    sale = response.json()
    assert sale["total"] == "997.50" and sale["currency"] == "NIO"
    assert sale["items"][0]["subtotal"] == "399.00"
    assert sale["created_by_user_id"] == graph["admin"]
    assert sale["status"] == "confirmed" and sale["created_at"].endswith("Z")
    path = f"/api/v1/sales/{sale['sale_id']}"
    assert client.get(path).json() == sale
    assert client.get("/api/v1/sales?limit=1").json() == [sale]
    assert client.get("/api/v1/sales?offset=100").json() == []
    for method in ("put", "patch", "delete"):
        assert getattr(client, method)(path).status_code == 405
    assert client.post(path + "/items", json={}).status_code == 404
    movements = client.get(
        "/api/v1/inventory/movements", params={"sale_id": sale["sale_id"]}
    ).json()
    assert len(movements) == 2
    assert [(m["stock_before"], m["stock_after"]) for m in movements] == [
        (12, 10),
        (12, 9),
    ]
    assert all(
        m["movement_type"] == "sale_issue" and m["purchase_item_id"] is None
        for m in movements
    )
    assert [m["sale_item_id"] for m in movements] == [
        i["sale_item_id"] for i in sale["items"]
    ]
    assert (
        client.patch(
            "/api/v1/products/" + str(graph["product1"]), json={"cost": "434.78"}
        ).status_code
        == 200
    )
    assert register(client, graph).json() == sale
    assert client.get(path).json() == sale
    assert database_connection.scalar(select(func.count()).select_from(Sale)) == 1
    assert (
        database_connection.scalar(
            select(Product.legacy_stock_quantity).where(
                Product.product_id == graph["product1"]
            )
        )
        == 12
    )
    changed = sale_payload(graph)
    changed["items"].reverse()
    assert register(client, graph, payload=changed).status_code == 409


@pytest.mark.parametrize(
    "mutation,expected",
    [
        ("customer", 422),
        ("employee", 422),
        ("no_employee", 422),
        ("product", 422),
        ("price_null", 422),
        ("price_zero", 422),
        ("price_negative", 422),
        ("stock_null", 409),
        ("stock_negative", 409),
        ("stock_low", 409),
        ("overflow", 422),
    ],
)
def test_invalid_sale_has_no_side_effects(
    sales_context, database_connection, mutation, expected
) -> None:
    client, graph, _, _, _ = sales_context
    payload = sale_payload(graph)
    if mutation in {"customer", "employee"}:
        payload[mutation + "_id"] = 2147483647
    elif mutation == "no_employee":
        payload.pop("employee_id")
    elif mutation == "product":
        payload["items"][1]["product_id"] = 2147483647
    else:
        values = {
            "price_null": {"unit_price": None},
            "price_zero": {"unit_price": 0},
            "price_negative": {"unit_price": -1},
            "stock_null": {"legacy_stock": None},
            "stock_negative": {"legacy_stock": -1},
            "stock_low": {"legacy_stock": 2},
            "overflow": {"unit_price": Decimal("99999999.99")},
        }[mutation]
        database_connection.execute(
            update(Product)
            .where(Product.product_id == graph["product2"])
            .values(**values)
        )
    response = register(client, graph, payload=payload)
    assert response.status_code == expected, response.text
    for model in (Sale, SaleItem, SaleWorkflow, InventoryMovement):
        assert database_connection.scalar(select(func.count()).select_from(model)) == 0
    assert (
        database_connection.scalar(
            select(Product.legacy_stock).where(Product.product_id == graph["product1"])
        )
        == 12
    )


@pytest.mark.parametrize("failure", ["runtime", "integrity", "workflow"])
def test_failure_after_writes_rolls_back_and_key_can_retry(
    sales_context,
    database_connection,
    failure,
) -> None:
    client, graph, factory, actor, _ = sales_context
    calls = 0
    original = InventoryRepository.append_movement

    def fail(repository, movement):
        nonlocal calls
        original(repository, movement)
        calls += 1
        if calls == 2:
            if failure == "integrity":
                raise IntegrityError("synthetic", {}, Exception("synthetic"))
            raise RuntimeError("synthetic failure")

    target, method, replacement = InventoryRepository, "append_movement", fail
    if failure == "workflow":
        target, method = SaleRepository, "add_workflow"
        original_workflow = SaleRepository.add_workflow

        def fail_workflow(repository, workflow):
            original_workflow(repository, workflow)
            raise RuntimeError("synthetic failure")

        replacement = fail_workflow
    with factory() as session, patch.object(target, method, replacement):
        with pytest.raises(
            ApplicationError if failure == "integrity" else RuntimeError
        ):
            SaleService(session).register(
                SaleCreate(**sale_payload(graph)), actor, "synthetic-sale-01"
            )
    for model in (Sale, SaleItem, SaleWorkflow, InventoryMovement):
        assert database_connection.scalar(select(func.count()).select_from(model)) == 0
    assert list(database_connection.scalars(select(Product.legacy_stock))) == [12, 12]
    assert register(client, graph).status_code == 201


@pytest.mark.parametrize("role", ["Administrator", "Cashier"])
def test_roles_and_employee_attribution(sales_context, role) -> None:
    _, graph, _, _, app = sales_context
    with TestClient(
        app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as client:
        login(client, "purchasing-" + role.lower())
        assert client.get("/api/v1/sales").status_code == 200
        payload = sale_payload(graph)
        payload.pop("employee_id")
        if role == "Manager":
            mismatched = {**payload, "employee_id": graph["employee2"]}
            assert register(client, graph, payload=mismatched).status_code == 422
        else:
            assert register(client, graph, payload=payload).status_code == 422
            payload["employee_id"] = graph["employee1"]
        result = register(client, graph, payload=payload)
        assert result.status_code == 201, result.text
        assert result.json()["employee_id"] == graph["employee1"]
        assert (
            result.json()["created_by_user_id"]
            == graph[
                {"Administrator": "admin", "Manager": "manager", "Cashier": "cashier"}[
                    role
                ]
            ]
        )
        if role == "Cashier":
            assert client.get("/api/v1/inventory/movements").status_code == 403


def test_authentication_csrf_origin_and_request_contract(sales_context) -> None:
    client, graph, _, _, app = sales_context
    assert client.get("/api/v1/sales/2147483647").status_code == 404
    assert client.get("/api/v1/sales?limit=101").status_code == 422
    assert client.get("/api/v1/inventory/movements?sale_id=0").status_code == 422
    assert client.post("/api/v1/sales", json=sale_payload(graph)).status_code == 422
    for key in ("short", "contains space", "nonascii_ñ".encode()):
        assert register(client, graph, key).status_code == 422
    payload = sale_payload(graph)
    for field in ("total", "discount"):
        assert (
            register(client, graph, payload={**payload, field: "0.01"}).status_code
            == 422
        )
    payload["items"][0]["unit_price"] = "0.01"
    assert register(client, graph, payload=payload).status_code == 422
    csrf = client.headers.pop("X-CSRF-Token")
    assert register(client, graph).status_code == 403
    client.headers["X-CSRF-Token"] = csrf
    client.headers["Origin"] = "https://invalid.example"
    assert register(client, graph).status_code == 403
    with TestClient(
        app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as anonymous:
        assert anonymous.get("/api/v1/sales").status_code == 401
        assert register(anonymous, graph).status_code == 401


def test_legacy_history_is_not_recalculated(sales_context, database_connection) -> None:
    client, graph, _, _, _ = sales_context
    sale_id = database_connection.scalar(
        insert(Sale)
        .values(
            customer_id=graph["customer"],
            employee_id=graph["employee1"],
            sale_date="2020-01-01",
            total=Decimal("398.00"),
        )
        .returning(Sale.sale_id)
    )
    database_connection.execute(
        insert(SaleItem).values(
            sale_id=sale_id,
            product_id=graph["product1"],
            quantity=2,
            unit_price=Decimal("199.00"),
        )
    )
    result = client.get(f"/api/v1/sales/{sale_id}").json()
    assert result["total"] == "398.00" and result["items"][0]["unit_price"] == "199.00"
    assert result["status"] is None and result["created_by_user_id"] is None
    assert result["created_at"] is None
    assert client.get("/api/v1/inventory/movements").json() == []


def test_database_rejects_duplicate_issues_and_invalid_deltas(
    sales_context,
    database_connection,
) -> None:
    client, graph, _, _, _ = sales_context
    sale = register(client, graph).json()
    values = dict(
        database_connection.execute(select(InventoryMovement.__table__))
        .mappings()
        .first()
    )
    values.pop("movement_id")
    with pytest.raises(IntegrityError), database_connection.begin_nested():
        database_connection.execute(insert(InventoryMovement).values(**values))
    movement_id = database_connection.scalar(select(InventoryMovement.movement_id))
    for changes in (
        {"stock_after": -1},
        {"stock_after": 12},
        {"quantity": 0},
        {"sale_item_id": None},
        {"movement_type": "purchase_receipt"},
    ):
        with pytest.raises(IntegrityError), database_connection.begin_nested():
            database_connection.execute(
                update(InventoryMovement)
                .where(InventoryMovement.movement_id == movement_id)
                .values(**changes)
            )
    workflow = dict(
        database_connection.execute(select(SaleWorkflow.__table__)).mappings().first()
    )
    second = register(client, graph, "second-sale-01").json()
    workflow["sale_id"] = second["sale_id"]
    with pytest.raises(IntegrityError), database_connection.begin_nested():
        database_connection.execute(
            update(SaleWorkflow)
            .where(SaleWorkflow.sale_id == second["sale_id"])
            .values(idempotency_hash=workflow["idempotency_hash"])
        )
    assert sale["sale_id"] != second["sale_id"]


@pytest.mark.parametrize("price", ["0.01", "99999999.99"])
def test_exact_price_and_total_storage_boundaries(
    sales_context,
    database_connection,
    price,
) -> None:
    client, graph, _, _, _ = sales_context
    database_connection.execute(
        update(Product)
        .where(Product.product_id == graph["product1"])
        .values(unit_price=Decimal(price))
    )
    payload = sale_payload(graph)
    payload["items"] = [{"product_id": graph["product1"], "quantity": 1}]
    response = register(client, graph, payload=payload)
    assert response.status_code == 201, response.text
    assert response.json()["total"] == price
    assert response.json()["items"][0]["unit_price"] == price


def test_key_scope_is_per_account_and_independent_of_purchases(sales_context) -> None:
    client, graph, factory, actor, app = sales_context
    with factory() as session:
        PurchaseService(session).register(
            PurchaseCreate(**purchase_payload(graph)), actor, "synthetic-sale-01"
        )
    first = register(client, graph).json()
    with TestClient(
        app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as cashier:
        login(cashier, "purchasing-cashier")
        second = register(cashier, graph)
        assert second.status_code == 201, second.text
        assert second.json()["sale_id"] != first["sale_id"]
        assert second.json()["created_by_user_id"] == graph["cashier"]


@pytest.mark.parametrize("state", ["missing", "inactive"])
def test_service_rejects_invalid_actor(sales_context, state) -> None:
    _, graph, factory, actor, _ = sales_context
    if state == "inactive":
        with factory.begin() as session:
            session.get(UserAccount, actor.user_id).is_active = False
    else:
        actor = replace(actor, user_id=2147483647)
    with factory() as session, pytest.raises(ApplicationError) as error:
        SaleService(session).register(
            SaleCreate(**sale_payload(graph)), actor, "invalid-actor-key"
        )
    assert error.value.status == 403


def test_downgrade_refuses_to_drop_sale_movements(
    sales_context, database_connection
) -> None:
    client, graph, _, _, _ = sales_context
    assert register(client, graph).status_code == 201
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = database_connection
    with (
        pytest.raises(ProgrammingError, match="operational data must be preserved"),
        database_connection.begin_nested(),
    ):
        command.downgrade(config, "0003_purchase_receipts")
    assert (
        database_connection.scalar(select(func.count()).select_from(InventoryMovement))
        == 2
    )
