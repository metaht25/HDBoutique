"""Protect the readiness contract without requiring a database in unit tests."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.main import create_app


def test_readiness_checks_database_and_disposes_engine() -> None:
    engine = MagicMock(spec=Engine)
    with patch("app.main.build_engine", return_value=engine):
        application = create_app(Settings(environment="test"))
    engine.connect.assert_not_called()

    with TestClient(application) as client:
        response = client.get("/health/ready")
        engine.dispose.assert_not_called()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "scope": "database"}
    connection = engine.connect.return_value.__enter__.return_value
    assert str(connection.execute.call_args.args[0]) == "SELECT 1"
    engine.dispose.assert_called_once_with()


def test_database_outage_does_not_break_liveness_or_expose_details() -> None:
    engine = MagicMock(spec=Engine)
    engine.connect.side_effect = OperationalError(
        "SELECT 1", {}, Exception("synthetic-sensitive-connection-details")
    )
    with patch("app.main.build_engine", return_value=engine):
        application = create_app(Settings(environment="test"))

    with TestClient(application) as client:
        live = client.get("/health/live")
        engine.connect.assert_not_called()
        ready = client.get("/health/ready")

    assert live.status_code == 200
    assert live.json() == {"status": "ok", "scope": "process"}
    assert ready.status_code == 503
    assert ready.json() == {"status": "unavailable", "scope": "database"}
    assert "synthetic-sensitive" not in ready.text
