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
from app.modules.identity.models import UserAccount
from app.modules.identity.security import hash_password
from app.modules.locations.schemas import DepartmentCreate
from app.modules.locations.service import LocationsService
from tests.identity_helpers import SYNTHETIC_PASSWORD, TEST_ORIGIN, login

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
    with application.state.session_factory.begin() as session:
        session.add(
            UserAccount(
                username="synthetic-admin",
                password_hash=hash_password(SYNTHETIC_PASSWORD),
                role="Administrator",
                is_active=True,
                employee_id=None,
            )
        )
    with TestClient(
        application, base_url=TEST_ORIGIN, headers={"Origin": TEST_ORIGIN}
    ) as client:
        login(client, "synthetic-admin")
        yield client


@pytest.fixture
def records(
    business_client: TestClient,
    database_connection: Connection,
) -> dict[str, dict]:
    client = business_client
    result: dict[str, dict] = {}

    def create(route: str, **values: object) -> dict:
        if route in {"customers", "suppliers"}:
            from app.modules.customers.schemas import CustomerCreate, CustomerRead
            from app.modules.customers.service import CustomersService
            from app.modules.suppliers.schemas import SupplierCreate, SupplierRead
            from app.modules.suppliers.service import SuppliersService

            with client.app.state.session_factory() as session:
                if route == "customers":
                    row = CustomersService(session).save_customer(
                        CustomerCreate(**values)
                    )
                    data = CustomerRead.model_validate(row).model_dump(mode="json")
                else:
                    row = SuppliersService(session).save_supplier(
                        SupplierCreate(**values)
                    )
                    data = SupplierRead.model_validate(row).model_dump(mode="json")
            result[route] = data
            return data
        response = client.post("/api/v1/" + route, json=values)
        assert response.status_code == 201, response.text
        result[route] = response.json()
        return response.json()

    department = create("departments", name="Synthetic")
    create(
        "municipalities", department_id=department["department_id"], name="Synthetic"
    )
    address = create(
        "addresses",
        department_id=department["department_id"],
        address_line="Synthetic address",
    )
    category = create("categories", name="Synthetic")
    size = next(row for row in client.get("/api/v1/sizes").json() if row["name"] == "M")
    result["sizes"] = size
    supplier = create(
        "suppliers",
        address_id=address["address_id"],
        company_name="Synthetic",
        contact_first_names="Contact",
        contact_last_names="Synthetic",
        phone_number="80000000",
        work_email=None,
    )
    product = create(
        "products",
        category_id=category["category_id"],
        size_id=size["size_id"],
        name="Synthetic product",
        cost="173.48",
        supplier_ids=[supplier["supplier_id"]],
    )
    assert product["legacy_stock"] == 0
    assert product["legacy_stock_quantity"] is None
    # Simula un historico ya preservado, no una escritura del CRUD nuevo.
    database_connection.execute(
        text(
            "UPDATE products SET legacy_stock_quantity=12, legacy_stock=3 "
            "WHERE product_id=:id"
        ),
        {"id": product["product_id"]},
    )
    result["products"] = client.get(
        "/api/v1/products/" + str(product["product_id"])
    ).json()
    customer_type = create("customer-types", name="Synthetic")
    create(
        "customers",
        address_id=address["address_id"],
        customer_type_id=customer_type["customer_type_id"],
        first_names="Synthetic",
        last_names="Customer",
        phone_number="80000000",
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
    if route not in {
        "departments",
        "municipalities",
        "sizes",
        "supplier-products",
        "supplier-offerings",
    }:
        assert client.get(path, params={"offset": 0, "limit": 1}).json() == [original]
    if route in {"customers", "suppliers", "sizes"}:
        assert client.patch(detail, json={"name": "Edited"}).status_code in {
            403,
            409,
            422,
        }
        return
    assert client.get(path, params={"offset": 100}).json() == []
    payload = {field: value for field, value in original.items() if field != key}
    for field in (
        "is_active",
        "created_at",
        "created_date",
        "technical_key",
        "is_permanent",
    ):
        payload.pop(field, None)
    if route == "products":
        for field in (
            "legacy_stock_quantity",
            "legacy_stock",
            "unit_price",
            "supplier_id",
        ):
            payload.pop(field)
    if route == "products":
        payload["supplier_ids"] = [records["suppliers"]["supplier_id"]]
    assert client.put(detail, json=payload).json() == original
    assert client.patch(detail, json={}).json() == original
    if "name" in payload:
        updated = client.patch(detail, json={"name": "Updated"})
        assert updated.status_code == 200
        assert updated.json()["name"] == "Updated"
    duplicate = client.post(path, json=payload)
    if route == "supplier-offerings":
        assert duplicate.status_code == 409
        return
    assert duplicate.status_code == 201
    duplicate_path = path + "/" + str(duplicate.json()[key])
    preserved = route in {"products", "customers", "suppliers"}
    if preserved:
        assert client.delete(duplicate_path).status_code == 409
        assert (
            client.patch(duplicate_path, json={"is_active": False}).status_code == 200
        )
        assert client.get(duplicate_path).json()["is_active"] is False
    else:
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
            optional_reference = (
                (route == "customers" and field in {"address_id", "customer_type_id"})
                or (route == "products" and field == "supplier_id")
                or (route == "addresses" and field == "municipality_id")
            )
            if not optional_reference:
                assert client.patch(detail, json={field: None}).status_code == 422
            assert client.patch(detail, json={field: 2147483647}).status_code == 422
    assert client.get(detail).status_code == 200
    table = route.replace("-", "_")
    assert database_connection.execute(
        text(f"SELECT count(*) FROM {table}")
    ).scalar_one() == (
        2
        if preserved
        else {
            "departments": 4,
            "municipalities": 29,
            "supplier-products": 2,
            "supplier-offerings": 2,
        }.get(route, 1)
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
    assert response.status_code in {403, 409}
    assert response.json()["error"]["code"] in {
        "integrity_conflict",
        "history_preserved",
        "fixed_sizes",
        "contextual_creation_required",
    }
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
    assert response.status_code == 422
    preserved = business_client.get(path).json()
    assert preserved["legacy_stock"] == 3
    assert preserved["legacy_stock_quantity"] == 12
    assert Decimal(preserved["unit_price"]) == Decimal("199.50")
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
    assert response.status_code == 422
    preserved = client.get(path).json()
    assert preserved["unit_price"] == "199.50"
    assert preserved["legacy_stock"] == 3
    assert preserved["name"] == product["name"]
    customer_path = "/api/v1/customers/" + str(records["customers"]["customer_id"])
    assert (
        client.patch(customer_path, json={"phone_number": "0" * 11}).status_code == 403
    )
    assert (
        client.patch(customer_path, json={"phone_number": 12345678}).status_code == 403
    )
