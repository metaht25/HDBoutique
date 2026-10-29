"""Product search filters the complete result before offset/limit on PostgreSQL."""

import pytest
from fastapi.testclient import TestClient

from tests.integration.test_business_api import business_client  # noqa: F401

pytestmark = pytest.mark.postgres


def test_product_search_is_literal_case_insensitive_and_paginated(
    business_client: TestClient,  # noqa: F811
) -> None:
    client = business_client
    category = client.post("/api/v1/categories", json={"name": "Synthetic"}).json()
    size = client.post("/api/v1/sizes", json={"name": "M"}).json()
    identifiers = []
    for name in ("Summer first", "Other", "SUMMER second", "20%_off", None):
        response = client.post(
            "/api/v1/products",
            json={
                "category_id": category["category_id"],
                "size_id": size["size_id"],
                "name": name,
                "unit_price": "199.50",
            },
        )
        assert response.status_code == 201
        identifiers.append(response.json()["product_id"])
    first = client.get("/api/v1/products", params={"q": " summer ", "limit": 1}).json()
    second = client.get(
        "/api/v1/products", params={"q": "summer", "offset": 1, "limit": 1}
    ).json()
    assert [first[0]["product_id"], second[0]["product_id"]] == [
        identifiers[0],
        identifiers[2],
    ]
    literal = client.get("/api/v1/products", params={"q": "%_"}).json()
    assert [row["product_id"] for row in literal] == [identifiers[3]]
    assert client.get("/api/v1/products", params={"q": "missing"}).json() == []
    assert len(client.get("/api/v1/products", params={"q": " "}).json()) == 5
    assert client.get("/api/v1/products", params={"q": "x" * 101}).status_code == 422
