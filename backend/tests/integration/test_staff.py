"""Employee management, privacy, references and account links on isolated PostgreSQL."""

import pytest
from fastapi.testclient import TestClient

from tests.identity_helpers import SYNTHETIC_PASSWORD, login
from tests.integration.test_business_api import business_client  # noqa: F401

pytestmark = pytest.mark.postgres


def test_employee_lifecycle_and_validation(business_client: TestClient) -> None:  # noqa: F811
    client = business_client
    department = client.post("/api/v1/departments", json={"name": "Synthetic"}).json()
    address = client.post(
        "/api/v1/addresses", json={"department_id": department["department_id"]}
    ).json()
    payload = {
        "address_id": address["address_id"],
        "first_names": "Ana",
        "last_names": "Prueba",
        "phone_number": "80000000",
        "job_title": "Colaborador",
        "username": "synthetic-cashier",
        "password": SYNTHETIC_PASSWORD,
        "start_date": "2026-01-01",
    }
    saved = client.post("/api/v1/employees", json=payload)
    assert saved.status_code == 201, saved.text
    row = saved.json()
    path = f"/api/v1/employees/{row['employee_id']}"
    assert row["phone_number"] == "80000000"
    assert row["end_date"] is None
    assert client.get(path).json() == row
    for field, value in [
        ("address_id", 999999),
        ("phone_number", "x" * 11),
        ("first_names", " "),
        ("work_email", "x" * 101),
        ("start_date", "invalid"),
        ("role", "Administrator"),
    ]:
        assert client.patch(path, json={field: value}).status_code == 422
        assert client.get(path).json() == row
    for field in ("address_id", "first_names", "last_names", "phone_number"):
        assert client.patch(path, json={field: None}).status_code == 422
    updated = client.patch(
        path,
        json={
            "job_title": None,
            "start_date": None,
            "end_date": "2026-01-02",
        },
    )
    assert updated.status_code == 200
    assert "work_email" not in updated.json()
    assert updated.json()["phone_number"] == "80000000"
    assert client.delete(path).status_code == 405
    assert client.get("/api/v1/employees/999999").status_code == 404
    assert (
        client.patch("/api/v1/employees/999999", json={"job_title": "Test"}).status_code
        == 404
    )
    assert (
        client.get("/api/v1/employees", params={"q": " ana "}).json()[0]["employee_id"]
        == row["employee_id"]
    )
    assert client.get("/api/v1/employees", params={"q": "%_"}).json() == []
    assert (
        client.get("/api/v1/employees", params={"q": "8000"}).json()[0]["employee_id"]
        == row["employee_id"]
    )
    assert client.get("/api/v1/employees", params={"offset": 1}).json() == []
    for params in ({"offset": -1}, {"limit": 101}, {"q": "x" * 101}):
        assert client.get("/api/v1/employees", params=params).status_code == 422
    account = client.post(
        "/api/v1/users",
        json={
            "username": "synthetic-cashier",
            "password": SYNTHETIC_PASSWORD,
            "role": "Cashier",
            "employee_id": row["employee_id"],
        },
    )
    assert account.status_code == 409
    conflict = client.post(
        "/api/v1/users",
        json={
            "username": "synthetic-other",
            "password": SYNTHETIC_PASSWORD,
            "role": "Cashier",
            "employee_id": row["employee_id"],
        },
    )
    assert conflict.status_code == 409
    login(client, "synthetic-cashier")
    assert (
        client.post(
            "/api/v1/auth/password",
            json={
                "current_password": SYNTHETIC_PASSWORD,
                "new_password": "new-synthetic-password-42",
            },
        ).status_code
        == 403
    )
    login(client, "synthetic-cashier")
    assert client.get("/api/v1/auth/me").json()["employee_id"] == row["employee_id"]
    assert client.get("/api/v1/employees").status_code == 403
    assert client.get(path).status_code == 403
    assert client.post("/api/v1/employees", json=payload).status_code == 403
    assert client.patch(path, json={"phone_number": "123"}).status_code == 403
    options = client.get("/api/v1/employee-options").json()
    assert options == [
        {
            "employee_id": row["employee_id"],
            "first_names": "Ana",
            "last_names": "Prueba",
        }
    ]
    assert client.get("/api/v1/employee-options", params={"q": "8000"}).json() == []
    client.cookies.clear()
    assert client.get("/api/v1/employee-options").status_code == 401


def test_manager_and_csrf(business_client: TestClient) -> None:  # noqa: F811
    client = business_client
    assert (
        client.post(
            "/api/v1/users",
            json={
                "username": "synthetic-manager",
                "password": SYNTHETIC_PASSWORD,
                "role": "Manager",
            },
        ).status_code
        == 422
    )
    assert client.get("/api/v1/employees").status_code == 200
    assert client.post("/api/v1/employees", json={}).status_code == 422
    assert (
        client.patch("/api/v1/employees/999999", json={"job_title": None}).status_code
        == 404
    )
    client.headers.pop("X-CSRF-Token")
    assert client.post("/api/v1/employees", json={}).status_code == 403
