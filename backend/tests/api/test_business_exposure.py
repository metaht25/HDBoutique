"""Business API exposure and safe errors without a configured database."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.main import create_app


def test_business_routes_require_explicit_enablement() -> None:
    with TestClient(create_app(Settings(environment="test"))) as client:
        assert client.get("/api/v1/products").status_code == 404
        assert client.get("/api/v1/sales").status_code == 404
    with pytest.raises(ValidationError):
        Settings(environment="production", business_api_enabled=True)


def test_business_openapi_and_database_unavailable() -> None:
    with TestClient(
        create_app(
            Settings(
                environment="test",
                business_api_enabled=True,
            )
        )
    ) as client:
        schema = client.get("/openapi.json").json()
        assert "/api/v1/customers" in schema["paths"]
        assert set(schema["paths"]["/api/v1/sales"]) == {"get", "post"}
        assert set(schema["paths"]["/api/v1/sales/{sale_id}"]) == {"get"}
        assert "/api/v1/employees" not in schema["paths"]
        response = client.get("/api/v1/products")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "database_unavailable"


def test_database_exception_does_not_disclose_details() -> None:
    with TestClient(
        create_app(
            Settings(
                environment="test",
                business_api_enabled=True,
            )
        )
    ) as client:
        with patch(
            "app.api.dependencies.ApplicationError",
            side_effect=OperationalError(
                "sensitive-sql",
                {},
                Exception("sensitive-secret"),
            ),
        ):
            response = client.get("/api/v1/products")
        assert response.status_code == 503
        assert "sensitive" not in response.text
