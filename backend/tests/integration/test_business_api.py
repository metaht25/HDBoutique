"""HTTP workflows against migrated PostgreSQL, with synthetic data only."""

from collections.abc import Iterator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection, Engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings
from app.infrastructure.database.session import create_session_factory
from app.main import create_app
from app.modules.locations.schemas import DepartmentCreate
from app.modules.locations.service import LocationsService

pytestmark = pytest.mark.postgres

RESOURCES = [
    ["departments", "department_id"],
    ["municipalities", "municipality_id"],
    ["addresses", "address_id"],
    ["categories", "category_id"],
    ["sizes", "size_id"],
    ["products", "product_id"],
    ["customer-types", "customer_type_id"],
    ["customers", "customer_id"],
    ["suppliers", "supplier_id"],
    ["supplier-products", "supplier_product_id"],
    ["supplier-offerings", "offering_id"],
]


@pytest.fixture
def business_client(database_connection: Connection) -> Iterator[TestClient]:
    application = create_app(Settings(environment="test", business_api_enabled=True))

    application.state.session_factory = sessionmaker(
        bind=database_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    with TestClient(application) as client:
        yield client


@pytest.fixture
def records(business_client: TestClient) -> dict[str, dict]:
    client = business_client
    result: dict[str, dict] = {}

    def create(route: str, **values: object) -> dict:
        response = client.post("/api/v1/" + route, json=values)
        assert response.status_code == 201, response.text
        result[route] = response.json()
        return response.json()

    department = create("departments", name="Synthetic")
    create("municipalities", department_id=department["department_id"], name=None)
    address = create(
        "addresses",
        department_id=department["department_id"],
        address_line="Synthetic address",
    )
    category = create("categories", name=None)
    size = create("sizes", name="M")
    product = create(
        "products",
        category_id=category["category_id"],
        size_id=size["size_id"],
        name="Synthetic product",
        legacy_stock_quantity=12,
        legacy_stock=3,
        unit_price="199.50",
    )
    customer_type = create("customer-types", name=None)
    create(
        "customers",
        address_id=address["address_id"],
        customer_type_id=customer_type["customer_type_id"],
        first_names="Synthetic",
        last_names="Customer",
        phone_number="0000000000",
    )
    supplier = create(
        "suppliers",
        address_id=address["address_id"],
        company_name="Synthetic",
        contact_first_names="Contact",
        contact_last_names="Synthetic",
        phone_number="00000000",
        work_email=None,
    )
    supplier_product = create(
        "supplier-products", product_id=product["product_id"], purchase_price="120.50"
    )
    create(
        "supplier-offerings",
        supplier_id=supplier["supplier_id"],
        supplier_product_id=supplier_product["supplier_product_id"],
    )
    return result


@pytest.mark.parametrize(("route", "key"), RESOURCES)
def test_resource_workflow(
    business_client: TestClient,
    records: dict,
    database_connection: Connection,
    route: str,
    key: str,
) -> None:
    client = business_client
    original = records[route]
    path = "/api/v1/" + route
    detail = path + "/" + str(original[key])
    assert client.get(detail).json() == original
    assert original in client.get(path).json()
    assert client.get(path, params={"offset": 0, "limit": 1}).json() == [original]
    assert client.get(path, params={"offset": 100}).json() == []
    payload = {field: value for field, value in original.items() if field != key}
    assert client.put(detail, json=payload).json() == original
    assert client.patch(detail, json={}).json() == original
    if "name" in payload:
        updated = client.patch(detail, json={"name": "Updated"})
        assert updated.status_code == 200
        assert updated.json()["name"] == "Updated"
    duplicate = client.post(path, json=payload)
    assert duplicate.status_code == 201
    duplicate_path = path + "/" + str(duplicate.json()[key])
    assert client.delete(duplicate_path).status_code == 204
    assert client.get(duplicate_path).status_code == 404
    assert client.patch(duplicate_path, json={}).status_code == 404
    assert client.put(duplicate_path, json=payload).status_code == 404
    assert client.delete(duplicate_path).status_code == 404
    assert client.post(path, json={**payload, "unexpected": "value"}).status_code == 422
    for field in payload:
        if field.endswith("_id"):
            invalid = {**payload, field: 2147483647}
            assert client.post(path, json=invalid).status_code == 422
            assert client.patch(detail, json={field: None}).status_code == 422
            assert client.patch(detail, json={field: 2147483647}).status_code == 422
    assert client.get(detail).status_code == 200
    table = route.replace("-", "_")
    assert (
        database_connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()
        == 1
    )


@pytest.mark.parametrize(
    "route",
    [
        "departments",
        "addresses",
        "categories",
        "sizes",
        "products",
        "customer-types",
        "suppliers",
        "supplier-products",
    ],
)
def test_referenced_delete_rolls_back(
    business_client: TestClient, records: dict, route: str
) -> None:
    key = dict(RESOURCES)[route]
    detail = "/api/v1/" + route + "/" + str(records[route][key])
    response = business_client.delete(detail)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "integrity_conflict"
    assert business_client.get(detail).json() == records[route]


def test_precision_patch_and_legacy_values(
    business_client: TestClient, records: dict
) -> None:
    product = records["products"]
    path = "/api/v1/products/" + str(product["product_id"])
    assert product["unit_price"] == "199.50"
    assert (product["legacy_stock_quantity"], product["legacy_stock"]) == (12, 3)
    assert business_client.patch(path, json={"unit_price": "0.001"}).status_code == 422
    assert business_client.patch(path, json={"legacy_stock": 1.5}).status_code == 422
    response = business_client.patch(path, json={"legacy_stock": None})
    assert response.status_code == 200
    assert response.json()["legacy_stock"] is None
    assert response.json()["legacy_stock_quantity"] == 12
    assert Decimal(response.json()["unit_price"]) == Decimal("199.50")
    assert (
        business_client.patch(path, json={"unit_price": "100000000.00"}).status_code
        == 422
    )


def test_address_contract_rejects_silent_data_loss(
    business_client: TestClient, records: dict
) -> None:
    response = business_client.post(
        "/api/v1/addresses",
        json={
            "direccionexacta": "Synthetic",
            "municipality_id": 1,
            "department_id": records["departments"]["department_id"],
        },
    )
    assert response.status_code == 422
    assert "Synthetic" not in response.text


def test_service_commit_visible_from_another_connection(
    postgres_engine: Engine,
) -> None:
    factory = create_session_factory(postgres_engine)
    with factory() as session:
        service = LocationsService(session)
        record = service.save_department(DepartmentCreate(name="Committed synthetic"))
        try:
            with postgres_engine.connect() as connection:
                assert (
                    connection.execute(
                        text("SELECT name FROM departments WHERE department_id = :id"),
                        {"id": record.department_id},
                    ).scalar_one()
                    == "Committed synthetic"
                )
        finally:
            service.delete_department(record.department_id)


def test_http_validation_and_put_reset(
    business_client: TestClient, records: dict
) -> None:
    client = business_client
    for query in ({"offset": -1}, {"limit": 0}, {"limit": 101}):
        assert client.get("/api/v1/products", params=query).status_code == 422
    size_path = "/api/v1/sizes/" + str(records["sizes"]["size_id"])
    for value in (None, "", "   ", "X" * 21):
        assert client.patch(size_path, json={"name": value}).status_code == 422
    product = records["products"]
    path = "/api/v1/products/" + str(product["product_id"])
    response = client.put(
        path,
        json={
            "category_id": product["category_id"],
            "size_id": product["size_id"],
        },
    )
    assert response.status_code == 200
    assert response.json()["unit_price"] is None
    assert response.json()["legacy_stock"] is None
    assert response.json()["name"] is None
    customer_path = "/api/v1/customers/" + str(records["customers"]["customer_id"])
    assert (
        client.patch(customer_path, json={"phone_number": "0" * 11}).status_code == 422
    )
    assert (
        client.patch(customer_path, json={"phone_number": 12345678}).status_code == 422
    )
