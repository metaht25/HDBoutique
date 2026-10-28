"""Synthetic login helpers; use real CSRF and session HTTP contracts."""

from fastapi.testclient import TestClient

SYNTHETIC_PASSWORD = "Synthetic-password-27!"
TEST_ORIGIN = "https://testserver"


def login(
    client: TestClient, username: str, password: str = SYNTHETIC_PASSWORD
) -> None:
    csrf = client.get("/api/v1/auth/csrf")
    assert csrf.status_code == 200, csrf.text
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": username,
            "password": password,
        },
        headers={"X-CSRF-Token": csrf.json()["csrf_token"]},
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.headers["X-CSRF-Token"]
