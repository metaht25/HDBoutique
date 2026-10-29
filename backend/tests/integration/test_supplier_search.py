"""Supplier search filters the full dataset before pagination."""

import pytest
from sqlalchemy import update

from app.modules.suppliers.models import Supplier
from tests.integration.test_sales import sales_context  # noqa: F401

pytestmark = pytest.mark.postgres


def test_supplier_search_is_global_literal_and_bounded(sales_context) -> None:  # noqa: F811
    client, graph, factory, _, _ = sales_context
    with factory.begin() as session:
        session.execute(
            update(Supplier)
            .where(Supplier.supplier_id == graph["supplier1"])
            .values(company_name="Case %_ Example")
        )
    assert (
        client.get("/api/v1/suppliers", params={"q": " case "}).json()[0]["supplier_id"]
        == graph["supplier1"]
    )
    assert len(client.get("/api/v1/suppliers", params={"q": "%_"}).json()) == 1
    result = client.get(
        "/api/v1/suppliers", params={"q": "synthetic contact", "offset": 1, "limit": 1}
    ).json()
    assert [row["supplier_id"] for row in result] == [graph["supplier2"]]
    assert len(client.get("/api/v1/suppliers", params={"q": "0000"}).json()) == 2
    assert client.get("/api/v1/suppliers", params={"q": "missing"}).json() == []
    assert client.get("/api/v1/suppliers", params={"q": "x" * 101}).status_code == 422
