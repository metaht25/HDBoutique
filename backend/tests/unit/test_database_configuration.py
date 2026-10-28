"""Validate complete, private PostgreSQL settings and lazy engine creation."""

from unittest.mock import patch

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.infrastructure.database.connection import build_engine


def database_values() -> dict[str, object]:
    return {
        "database_host": "synthetic-db",
        "database_name": "synthetic_database",
        "database_user": "synthetic_app",
        "database_password": "synthetic-password@with/special:chars",
    }


@pytest.mark.parametrize(
    "field", ["database_host", "database_name", "database_user", "database_password"]
)
def test_database_configuration_requires_all_credentials(field: str) -> None:
    values = database_values()
    del values[field]
    with pytest.raises(ValidationError, match="required together"):
        Settings(**values)


@pytest.mark.parametrize("port", [0, 65536])
def test_invalid_database_port_is_rejected(port: int) -> None:
    with pytest.raises(ValidationError):
        Settings(**database_values(), database_port=port)


def test_empty_database_password_is_rejected() -> None:
    values = database_values()
    values["database_password"] = ""
    with pytest.raises(ValidationError):
        Settings(**values)


def test_secret_is_masked_in_settings_and_validation_errors() -> None:
    values = database_values()
    secret = str(values["database_password"])
    assert secret not in repr(Settings(**values))
    with pytest.raises(ValidationError) as error:
        Settings(**values, environment="unsupported")
    assert secret not in str(error.value)


def test_unconfigured_engine_is_not_created() -> None:
    with patch("app.infrastructure.database.connection.create_engine") as factory:
        assert build_engine(Settings()) is None
    factory.assert_not_called()


def test_engine_uses_structured_url_without_connecting() -> None:
    values = database_values()
    with patch("app.infrastructure.database.connection.create_engine") as factory:
        engine = build_engine(Settings(**values))

    assert engine is factory.return_value
    url = factory.call_args.args[0]
    assert url.drivername == "postgresql+psycopg"
    assert url.host == values["database_host"]
    assert url.password == values["database_password"]
    assert str(values["database_password"]) not in str(url)
    assert factory.call_args.kwargs["connect_args"] == {"connect_timeout": 3}
    assert factory.call_args.kwargs["hide_parameters"] is True
    engine.connect.assert_not_called()
