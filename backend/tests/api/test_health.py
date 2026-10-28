"""Verify the public health contract and application configuration."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app


@pytest.mark.parametrize("path", ["/health/live", "/health/ready"])
def test_health_reports_process_scope(path: str) -> None:
    with TestClient(create_app(Settings(environment="test"))) as client:
        response = client.get(path)

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "scope": "process"}


def test_openapi_describes_health_responses() -> None:
    with TestClient(create_app(Settings(environment="test"))) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "HDBoutique API"
    assert set(schema["paths"]) == {"/health/live", "/health/ready"}
    assert (
        schema["components"]["schemas"]["HealthResponse"]["properties"]["scope"][
            "const"
        ]
        == "process"
    )


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_production_does_not_publish_interactive_docs(path: str) -> None:
    with TestClient(create_app(Settings(environment="production"))) as client:
        response = client.get(path)

    assert response.status_code == 404


def test_legacy_api_is_not_silently_replaced() -> None:
    with TestClient(create_app(Settings(environment="test"))) as client:
        response = client.get("/api/productos/productos/")

    assert response.status_code == 404


def test_settings_read_prefixed_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HDB_APP_NAME", "Synthetic API")
    monkeypatch.setenv("HDB_ENVIRONMENT", "test")
    monkeypatch.setenv("HDB_DEBUG", "false")

    settings = Settings()

    assert settings.app_name == "Synthetic API"
    assert settings.environment == "test"
    assert settings.debug is False


def test_settings_do_not_load_legacy_dotenv(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # La configuracion del proceso debe ser independiente de un .env legacy local.
    dotenv = tmp_path / ".env"
    dotenv.write_text("HDB_APP_NAME=Unexpected local override\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("HDB_APP_NAME", raising=False)

    assert Settings().app_name == "HDBoutique API"


@pytest.mark.parametrize(
    "values",
    [
        {"environment": "unsupported"},
        {"environment": "production", "debug": True},
        {"app_name": "   "},
    ],
)
def test_invalid_configuration_fails_early(values: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        Settings(**values)
