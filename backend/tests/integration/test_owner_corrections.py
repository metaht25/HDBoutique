"""Owner observations verified against real, isolated PostgreSQL."""
# ruff: noqa: F811

import pytest
from sqlalchemy import func, select

from app.modules.boutique.models import BoutiqueProfile
from app.modules.locations.models import Address
from app.modules.staff.models import Employee
from app.modules.suppliers.models import Supplier
from tests.identity_helpers import login
from tests.integration.test_boutique_experience import (  # noqa: F401
    address,
    boutique,
    general_sale,
)

pytestmark = pytest.mark.postgres


def test_contextual_supplier_failure_rolls_back_address_supplier_and_retry(
    boutique, monkeypatch
):  # noqa: F811
    client, graph, factory = boutique
    body = {
        "company_name": "Synthetic rollback",
        "contact_first_names": "Contacto",
        "contact_last_names": "Prueba",
        "phone_number": "80000000",
        "address": address(client, graph),
    }
    with factory.begin() as session:
        before = [
            session.scalar(select(func.count()).select_from(model))
            for model in (Supplier, Address)
        ]
    from app.modules.suppliers import service

    original = service.audit

    def fail(*args, **kwargs):
        raise RuntimeError("synthetic transaction failure")

    with monkeypatch.context() as patch:
        patch.setattr(service, "audit", fail)
        with pytest.raises(RuntimeError, match="synthetic transaction failure"):
            client.post(
                "/api/v1/purchases/suppliers",
                json=body,
                headers={"Idempotency-Key": "supplier-rollback"},
            )
    assert service.audit is original
    with factory.begin() as session:
        assert [
            session.scalar(select(func.count()).select_from(model))
            for model in (Supplier, Address)
        ] == before
    assert (
        client.post(
            "/api/v1/purchases/suppliers",
            json=body,
            headers={"Idempotency-Key": "supplier-rollback"},
        ).status_code
        == 201
    )


def test_contextual_supplier_persistence_retries_purchase_and_permissions(boutique):  # noqa: F811
    client, graph, factory = boutique
    body = {
        "company_name": "Synthetic contextual supplier",
        "contact_first_names": "Contacto",
        "contact_last_names": "Prueba",
        "phone_number": "81234567",
        "address": address(client, graph),
    }
    headers = {"Idempotency-Key": "supplier-persist-retry"}
    path = "/api/v1/purchases/suppliers"
    for phone in ("letters", "1e8", "123-456", "12345678901", ""):
        assert (
            client.post(
                path, json={**body, "phone_number": phone}, headers=headers
            ).status_code
            == 422
        )
    saved = client.post(path, json=body, headers=headers)
    assert saved.status_code == 201, saved.text
    supplier_id = saved.json()["supplier_id"]
    assert (
        client.get(f"/api/v1/suppliers/{supplier_id}").json()["phone_number"]
        == "81234567"
    )
    assert (
        client.post(path, json=body, headers=headers).json()["supplier_id"]
        == supplier_id
    )
    assert (
        client.post(
            path, json={**body, "company_name": "Other"}, headers=headers
        ).status_code
        == 409
    )
    listed = client.get(
        "/api/v1/reports/supplier-directory?q=Synthetic%20contextual"
    ).json()
    assert [row["supplier_id"] for row in listed["items"]] == [supplier_id]
    assert (
        client.patch(
            f"/api/v1/products/{graph['product1']}",
            json={"supplier_ids": [supplier_id]},
        ).status_code
        == 200
    )
    purchase = client.post(
        "/api/v1/purchases",
        headers={"Idempotency-Key": "purchase-new-supplier"},
        json={
            "supplier_id": supplier_id,
            "employee_id": graph["employee1"],
            "purchase_date": "2026-11-02",
            "items": [
                {"product_id": graph["product1"], "unit_cost": "120.50", "quantity": 1}
            ],
        },
    )
    assert purchase.status_code == 201, purchase.text
    login(client, "purchasing-cashier")
    assert client.post(path, json=body, headers=headers).status_code == 403


def test_optional_profile_phone_and_receipt_without_logo(boutique):  # noqa: F811
    client, graph, factory = boutique
    saved = client.put(
        "/api/v1/boutique-profile",
        json={
            "name": "H&D Boutique",
            "phone_number": None,
            "address_line": "Milagro de Dios",
            "remove_logo": True,
        },
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["ready"] is True
    with factory.begin() as session:
        profile = session.get(BoutiqueProfile, 1)
        assert profile.phone_number is None and profile.logo is None
    sale = client.post(
        "/api/v1/sales",
        json=general_sale(graph),
        headers={"Idempotency-Key": "receipt-no-contact"},
    )
    assert sale.status_code == 201, sale.text
    sale_id = sale.json()["sale_id"]
    receipt = client.get(f"/api/v1/receipts/{sale_id}").json()
    assert receipt["boutique"]["phone_number"] is None
    assert receipt["boutique"]["logo_base64"] is None
    assert receipt["boutique"]["address_line"] == "Milagro de Dios"
    pdf = client.get(f"/api/v1/receipts/{sale_id}/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")


def test_employee_job_title_preserves_history_but_blocks_new_arbitrary_values(boutique):  # noqa: F811
    client, graph, factory = boutique
    with factory.begin() as session:
        employee = session.get(Employee, graph["employee1"])
        employee.job_title = "Cargo histórico"
    path = f"/api/v1/employees/{graph['employee1']}"
    assert client.patch(path, json={"job_title": "Cargo histórico"}).status_code == 200
    assert client.patch(path, json={"job_title": "Inventado"}).status_code == 422
    assert client.patch(path, json={"job_title": "Vendedor"}).status_code == 422
    with factory.begin() as session:
        assert (
            session.scalar(
                select(Employee.job_title).where(
                    Employee.employee_id == graph["employee1"]
                )
            )
            == "Cargo histórico"
        )
