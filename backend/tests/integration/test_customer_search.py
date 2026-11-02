"""Global customer search and existing-address contract on isolated PostgreSQL."""

import pytest
from fastapi.testclient import TestClient

from tests.integration.test_business_api import business_client  # noqa: F401

pytestmark = pytest.mark.postgres


def test_customer_search_filters_before_paging_and_preserves_phone(
    business_client: TestClient,  # noqa: F811
) -> None:
    client = business_client
    department = client.post("/api/v1/departments", json={"name": "Synthetic"}).json()
    address = client.post(
        "/api/v1/addresses",
        json={"department_id": department["department_id"], "address_line": None},
    ).json()
    customer_type = client.post(
        "/api/v1/customer-types", json={"name": "Synthetic"}
    ).json()
    identifiers = []
    for first, last, phone in (
        ("Ana", "Primera", "0012345678"),
        ("Other", "Name", "2000000000"),
        ("ANA", "Segunda", "3000000000"),
        ("Literal%_", "Name", "4000000000"),
    ):
        from app.modules.customers.schemas import CustomerCreate
        from app.modules.customers.service import CustomersService

        with client.app.state.session_factory() as session:
            row = CustomersService(session).save_customer(
                CustomerCreate(
                    first_names=first,
                    last_names=last,
                    phone_number=phone,
                    address_id=address["address_id"],
                    customer_type_id=customer_type["customer_type_id"],
                )
            )
            assert row.phone_number == phone
            identifiers.append(row.customer_id)
    result = client.get(
        "/api/v1/customers", params={"q": " ana ", "offset": 1, "limit": 1}
    ).json()
    assert [row["customer_id"] for row in result] == [identifiers[2]]
    for query, expected in (
        ("Ana Primera", identifiers[0]),
        ("001234", identifiers[0]),
        ("%_", identifiers[3]),
    ):
        result = client.get("/api/v1/customers", params={"q": query}).json()
        assert [row["customer_id"] for row in result] == [expected]
    assert len(client.get("/api/v1/customers", params={"q": " "}).json()) == 4
    assert client.get("/api/v1/customers", params={"q": "missing"}).json() == []
    assert client.get("/api/v1/customers", params={"q": "x" * 101}).status_code == 422
