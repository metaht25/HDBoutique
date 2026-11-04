"""Purchase/receipt atomicity, historical fidelity and HTTP access on PostgreSQL."""

from collections.abc import Iterator
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Connection, func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.main import create_app
from app.modules.catalog.models import Product
from app.modules.identity.models import UserAccount
from app.modules.identity.service import principal_from_user
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.repository import PurchaseRepository
from app.modules.purchases.schemas import PurchaseCreate, PurchaseReceive
from app.modules.purchases.service import PurchaseService
from app.modules.purchases.workflow_models import PurchaseItemCost, PurchaseWorkflow
from tests.identity_helpers import TEST_ORIGIN, login
from tests.purchase_helpers import purchase_payload, seed_purchasing

pytestmark = pytest.mark.postgres


@pytest.fixture
def purchase_app(database_connection: Connection) -> FastAPI:
    application = create_app(
        Settings(
            environment="test",
            business_api_enabled=True,
            auth_origin=TEST_ORIGIN,
        )
    )
    application.state.session_factory = sessionmaker(
        bind=database_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    return application


@pytest.fixture
def purchase_graph(purchase_app: FastAPI) -> dict[str, int]:
    with purchase_app.state.session_factory.begin() as session:
        return seed_purchasing(session)


@pytest.fixture
def purchase_client(
    purchase_app: FastAPI, purchase_graph: dict[str, int]
) -> Iterator[TestClient]:
    with TestClient(
        purchase_app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as client:
        login(client, "purchasing-administrator")
        yield client


def create_purchase(
    client: TestClient, graph: dict[str, int], key: str = "synthetic-purchase-01"
) -> dict:
    response = client.post(
        "/api/v1/purchases",
        json=purchase_payload(graph),
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_registration_receipt_and_history(
    purchase_client: TestClient,
    purchase_graph: dict[str, int],
    database_connection: Connection,
) -> None:
    client, graph = purchase_client, purchase_graph
    purchase = create_purchase(client, graph)
    path = f"/api/v1/purchases/{purchase['purchase_id']}"
    assert purchase["status"] == "registered"
    assert purchase["merchandise_total"] == "346.75"
    assert purchase["total"] == "396.75" and purchase["currency"] == "NIO"
    assert purchase["created_by_user_id"] == graph["admin"]
    assert purchase["received_at"] is None
    assert client.get(path).json() == purchase
    assert client.get("/api/v1/purchases?limit=1").json() == [purchase]
    assert client.get("/api/v1/purchases?offset=100").json() == []
    assert (
        database_connection.scalar(
            select(Product.legacy_stock).where(Product.product_id == graph["product1"])
        )
        == 0
    )
    assert client.get("/api/v1/inventory/movements").json() == []
    response = client.post(path + "/receive", json={})
    assert response.status_code == 200, response.text
    received = response.json()
    assert received["status"] == "received"
    assert received["received_by_user_id"] == graph["admin"]
    assert received["received_employee_id"] == graph["employee1"]
    assert received["employee_id"] == graph["employee1"]
    assert received["review_date"] is None and received["refill_date"] is None
    assert received["received_at"].endswith("Z")
    assert client.post(path + "/receive", json={}).json() == received
    assert (
        client.post(path + "/receive", json={"employee_id": graph["employee1"]}).json()
        == received
    )
    movements = client.get(
        "/api/v1/inventory/movements", params={"purchase_id": purchase["purchase_id"]}
    ).json()
    assert len(movements) == 2
    assert [(row["stock_before"], row["stock_after"]) for row in movements] == [
        (0, 2),
        (0, 3),
    ]
    assert client.get(
        "/api/v1/inventory/movements",
        params={
            "product_id": graph["product1"],
            "limit": 1,
        },
    ).json() == [movements[0]]
    assert client.get("/api/v1/inventory/movements?offset=20").json() == []
    for index, quantity in ((1, 2), (2, 3)):
        product = client.get("/api/v1/products/" + str(graph[f"product{index}"])).json()
        assert product["legacy_stock"] == quantity
        assert product["legacy_stock_quantity"] == 12
    assert client.delete(path).status_code == 405
    assert client.patch(path, json={}).status_code == 405


def test_cost_snapshot_idempotency_and_product_identity(
    purchase_client: TestClient, purchase_graph: dict[str, int]
) -> None:
    client, graph = purchase_client, purchase_graph
    purchase = create_purchase(client, graph)
    assert (
        client.patch(
            "/api/v1/supplier-products/" + str(graph["supplier_product1"]),
            json={"purchase_price": "999.99", "product_id": graph["product2"]},
        ).status_code
        == 200
    )
    assert create_purchase(client, graph) == purchase
    path = f"/api/v1/purchases/{purchase['purchase_id']}"
    stored = client.get(path).json()
    assert stored["items"][0]["unit_cost"] == "120.50"
    assert stored["items"][0]["product_id"] == graph["product1"]
    changed = purchase_payload(graph)
    changed["shipping_cost"] = "1.00"
    conflict = client.post(
        "/api/v1/purchases",
        json=changed,
        headers={"Idempotency-Key": "synthetic-purchase-01"},
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_conflict"
    assert (
        client.post(
            path + "/receive", json={"employee_id": graph["employee1"]}
        ).status_code
        == 200
    )
    assert (
        client.get("/api/v1/products/" + str(graph["product1"])).json()["legacy_stock"]
        == 2
    )


def test_integer_shipping_has_stable_decimal_representation(
    purchase_client: TestClient,
    purchase_graph: dict[str, int],
) -> None:
    payload = purchase_payload(purchase_graph)
    payload["shipping_cost"] = 50
    response = purchase_client.post(
        "/api/v1/purchases",
        json=payload,
        headers={"Idempotency-Key": "synthetic-purchase-01"},
    )
    assert response.status_code == 201
    assert response.json()["shipping_cost"] == "50.00"
    assert create_purchase(purchase_client, purchase_graph) == response.json()


@pytest.mark.parametrize(
    "mutation",
    [
        "missing_employee",
        "missing_supplier",
        "missing_product",
        "wrong_supplier",
        "duplicate_line",
        "empty_items",
        "zero_quantity",
        "fractional_quantity",
        "fractional_shipping",
        "negative_shipping",
        "client_cost",
    ],
)
def test_invalid_purchase_never_leaves_partial_rows(
    purchase_client: TestClient,
    purchase_graph: dict[str, int],
    database_connection: Connection,
    mutation: str,
) -> None:
    payload = purchase_payload(purchase_graph)
    if mutation == "missing_employee":
        payload["employee_id"] = 2147483647
    elif mutation == "missing_supplier":
        payload["supplier_id"] = 2147483647
    elif mutation == "missing_product":
        payload["items"][1]["supplier_product_id"] = 2147483647
    elif mutation == "wrong_supplier":
        payload["supplier_id"] = purchase_graph["supplier2"]
    elif mutation == "duplicate_line":
        payload["items"].append(payload["items"][0].copy())
    elif mutation == "empty_items":
        payload["items"] = []
    elif mutation == "zero_quantity":
        payload["items"][0]["quantity"] = 0
    elif mutation == "fractional_quantity":
        payload["items"][0]["quantity"] = 1.5
    elif mutation == "fractional_shipping":
        payload["shipping_cost"] = "0.001"
    elif mutation == "negative_shipping":
        payload["shipping_cost"] = "-1"
    elif mutation == "client_cost":
        payload["items"][0]["unexpected_cost"] = "0.01"
    response = purchase_client.post(
        "/api/v1/purchases",
        json=payload,
        headers={"Idempotency-Key": "invalid-purchase-01"},
    )
    assert response.status_code == 422, response.text
    for model in (Purchase, PurchaseItem, PurchaseItemCost, PurchaseWorkflow):
        assert database_connection.scalar(select(func.count()).select_from(model)) == 0


def test_registration_rollback_after_flushed_costs(
    purchase_app: FastAPI,
    purchase_graph: dict[str, int],
    database_connection: Connection,
) -> None:
    factory = purchase_app.state.session_factory
    with factory() as session:
        actor = principal_from_user(session.get(UserAccount, purchase_graph["admin"]))
    original = PurchaseRepository.add_cost
    calls = 0

    def fail_after_second_cost(repository, record) -> None:
        nonlocal calls
        original(repository, record)
        calls += 1
        if calls == 2:
            raise RuntimeError("synthetic failure after cost flush")

    with factory() as session:
        with patch.object(PurchaseRepository, "add_cost", fail_after_second_cost):
            with pytest.raises(RuntimeError, match="synthetic failure"):
                PurchaseService(session).register(
                    PurchaseCreate(**purchase_payload(purchase_graph)),
                    actor,
                    "rollback-register",
                )
    for model in (Purchase, PurchaseItem, PurchaseItemCost, PurchaseWorkflow):
        assert database_connection.scalar(select(func.count()).select_from(model)) == 0


def test_receipt_rollback_and_retry_after_movement_flush(
    purchase_client: TestClient,
    purchase_app: FastAPI,
    purchase_graph: dict[str, int],
    database_connection: Connection,
) -> None:
    graph = purchase_graph
    purchase = create_purchase(purchase_client, graph)
    factory = purchase_app.state.session_factory
    with factory() as session:
        actor = principal_from_user(session.get(UserAccount, graph["admin"]))
    original = InventoryRepository.append_movement
    calls = 0

    def fail_after_second_movement(repository, movement) -> None:
        nonlocal calls
        original(repository, movement)
        calls += 1
        if calls == 2:
            raise RuntimeError("synthetic failure after movement flush")

    with factory() as session:
        with patch.object(
            InventoryRepository, "append_movement", fail_after_second_movement
        ):
            with pytest.raises(RuntimeError, match="synthetic failure"):
                PurchaseService(session).receive(
                    purchase["purchase_id"],
                    PurchaseReceive(employee_id=graph["employee1"]),
                    actor,
                )
    assert (
        database_connection.scalar(select(func.count()).select_from(InventoryMovement))
        == 0
    )
    assert list(
        database_connection.scalars(
            select(Product.legacy_stock).order_by(Product.product_id)
        )
    ) == [0, 0]
    assert (
        purchase_client.get(f"/api/v1/purchases/{purchase['purchase_id']}").json()[
            "status"
        ]
        == "registered"
    )
    response = purchase_client.post(
        f"/api/v1/purchases/{purchase['purchase_id']}/receive",
        json={"employee_id": graph["employee1"]},
    )
    assert response.status_code == 200
    assert (
        database_connection.scalar(select(func.count()).select_from(InventoryMovement))
        == 2
    )


@pytest.mark.parametrize("stock", [None, -1, 2147483647])
def test_invalid_existing_stock_rolls_back_every_line(
    purchase_client: TestClient,
    purchase_graph: dict[str, int],
    database_connection: Connection,
    stock: int | None,
) -> None:
    graph = purchase_graph
    purchase = create_purchase(purchase_client, graph)
    database_connection.execute(
        update(Product)
        .where(Product.product_id == graph["product2"])
        .values(legacy_stock=stock)
    )
    response = purchase_client.post(
        f"/api/v1/purchases/{purchase['purchase_id']}/receive",
        json={"employee_id": graph["employee1"]},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == (
        "stock_overflow" if stock == 2147483647 else "stock_count_required"
    )
    assert (
        database_connection.scalar(
            select(Product.legacy_stock).where(Product.product_id == graph["product1"])
        )
        == 0
    )
    assert (
        database_connection.scalar(select(func.count()).select_from(InventoryMovement))
        == 0
    )
    assert (
        purchase_client.get(f"/api/v1/purchases/{purchase['purchase_id']}").json()[
            "status"
        ]
        == "registered"
    )


@pytest.mark.parametrize("role", ["Administrator", "Cashier"])
def test_purchasing_permissions_and_employee_selection(
    purchase_app: FastAPI, purchase_graph: dict[str, int], role: str
) -> None:
    graph = purchase_graph
    with TestClient(
        purchase_app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as client:
        login(client, "purchasing-" + role.lower())
        expected = 403 if role == "Cashier" else 200
        assert client.get("/api/v1/purchases").status_code == expected
        assert client.get("/api/v1/inventory/movements").status_code == expected
        payload = purchase_payload(graph)
        payload.pop("employee_id")
        response = client.post(
            "/api/v1/purchases",
            json=payload,
            headers={"Idempotency-Key": "role-purchase-01"},
        )
        if role == "Cashier":
            assert response.status_code == 403
            assert (
                client.post("/api/v1/purchases/1/receive", json={}).status_code == 403
            )
            return
        assert response.status_code == 201, response.text
        assert response.json()["employee_id"] == graph["employee1"]
        path = f"/api/v1/purchases/{response.json()['purchase_id']}/receive"
        assert (
            client.post(path, json={"employee_id": graph["employee2"]}).status_code
            == 422
        )
        assert client.post(path, json={}).status_code == 200


def test_csrf_validation_and_readonly_stock(
    purchase_client: TestClient, purchase_app: FastAPI, purchase_graph: dict[str, int]
) -> None:
    client, graph = purchase_client, purchase_graph
    payload = purchase_payload(graph)
    assert client.post("/api/v1/purchases", json=payload).status_code == 422
    assert (
        client.post(
            "/api/v1/purchases", json=payload, headers={"Idempotency-Key": "short"}
        ).status_code
        == 422
    )
    csrf = client.headers.pop("X-CSRF-Token")
    assert (
        client.post(
            "/api/v1/purchases",
            json=payload,
            headers={"Idempotency-Key": "csrf-purchase-01"},
        ).status_code
        == 403
    )
    client.headers["X-CSRF-Token"] = csrf
    assert client.get("/api/v1/purchases/2147483647").status_code == 404
    assert (
        client.post("/api/v1/purchases/2147483647/receive", json={}).status_code == 404
    )
    assert client.get("/api/v1/inventory/movements?limit=101").status_code == 422
    assert client.get("/api/v1/inventory/movements?product_id=0").status_code == 422
    for field in ("legacy_stock", "legacy_stock_quantity"):
        assert (
            client.patch(
                "/api/v1/products/" + str(graph["product1"]), json={field: 999}
            ).status_code
            == 422
        )
    with TestClient(
        purchase_app, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as anonymous:
        assert anonymous.get("/api/v1/purchases").status_code == 401
        assert anonymous.get("/api/v1/inventory/movements").status_code == 401
        assert (
            anonymous.post(
                "/api/v1/purchases",
                json=payload,
                headers={"Idempotency-Key": "anon-purchase-01"},
            ).status_code
            == 401
        )


def test_legacy_purchase_has_unknown_cost_and_no_inferred_receipt(
    purchase_client: TestClient,
    purchase_graph: dict[str, int],
    database_connection: Connection,
) -> None:
    graph = purchase_graph
    purchase_id = database_connection.scalar(
        insert(Purchase)
        .values(
            supplier_id=graph["supplier1"],
            employee_id=graph["employee1"],
            purchase_date="2026-01-01",
            review_date="2026-01-02",
            refill_date="2026-01-03",
            shipping_cost=None,
        )
        .returning(Purchase.purchase_id)
    )
    database_connection.execute(
        insert(PurchaseItem).values(
            supplier_product_id=graph["supplier_product1"],
            purchase_id=purchase_id,
            quantity=2,
        )
    )
    detail = purchase_client.get(f"/api/v1/purchases/{purchase_id}").json()
    assert detail["status"] is None
    assert (
        detail["review_date"] == "2026-01-02" and detail["refill_date"] == "2026-01-03"
    )
    assert detail["total"] is None and detail["items"][0]["unit_cost"] is None
    assert detail["items"][0]["product_id"] is None
    assert (
        purchase_client.post(
            f"/api/v1/purchases/{purchase_id}/receive",
            json={"employee_id": graph["employee1"]},
        ).status_code
        == 409
    )
    assert purchase_client.get("/api/v1/inventory/movements").json() == []


def test_movement_constraints_and_incomplete_purchase(
    purchase_client: TestClient,
    purchase_graph: dict[str, int],
    database_connection: Connection,
) -> None:
    client, graph = purchase_client, purchase_graph
    purchase = create_purchase(client, graph)
    path = f"/api/v1/purchases/{purchase['purchase_id']}/receive"
    assert (
        client.post(path, json={"employee_id": graph["employee1"]}).status_code == 200
    )
    values = dict(
        database_connection.execute(select(InventoryMovement.__table__))
        .mappings()
        .first()
    )
    values.pop("movement_id")
    with pytest.raises(IntegrityError), database_connection.begin_nested():
        database_connection.execute(insert(InventoryMovement).values(**values))
    second = create_purchase(client, graph, "constraint-purchase-02")
    values["purchase_item_id"] = second["items"][0]["purchase_item_id"]
    values.update(quantity=1, stock_before=0, stock_after=2)
    with pytest.raises(IntegrityError), database_connection.begin_nested():
        database_connection.execute(insert(InventoryMovement).values(**values))
    with pytest.raises(IntegrityError), database_connection.begin_nested():
        database_connection.execute(
            update(PurchaseItemCost)
            .where(
                PurchaseItemCost.purchase_item_id
                == second["items"][0]["purchase_item_id"]
            )
            .values(unit_cost=Decimal("-1"))
        )
    database_connection.execute(
        PurchaseItemCost.__table__.delete().where(
            PurchaseItemCost.purchase_item_id == second["items"][0]["purchase_item_id"]
        )
    )
    response = client.post(
        f"/api/v1/purchases/{second['purchase_id']}/receive",
        json={"employee_id": graph["employee1"]},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "incomplete_purchase"
    assert (
        database_connection.scalar(select(func.count()).select_from(InventoryMovement))
        == 2
    )
