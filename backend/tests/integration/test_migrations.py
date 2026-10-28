"""Exercise real PostgreSQL DDL and compare the result to current metadata."""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, inspect, text

from app.infrastructure.database.base import Base

pytestmark = pytest.mark.postgres
BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_upgrade_downgrade_upgrade_and_metadata_drift(postgres_engine: Engine) -> None:
    with postgres_engine.begin() as connection:
        config = Config(str(BACKEND_ROOT / "alembic.ini"))
        config.attributes["connection"] = connection
        assert set(inspect(connection).get_table_names()) == {
            "alembic_version",
            *Base.metadata.tables,
        }
        command.check(config)
        command.downgrade(config, "base")
        assert inspect(connection).get_table_names() == ["alembic_version"]
        command.upgrade(config, "head")
        command.check(config)
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == (
            "0002_identity"
        )


def test_identity_upgrade_preserves_existing_business_data(
    database_connection,
) -> None:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.attributes["connection"] = database_connection
    command.downgrade(config, "0001_compatibility")
    department_id = database_connection.scalar(
        text(
            "INSERT INTO departments(name) VALUES ('Existing synthetic') "
            "RETURNING department_id"
        )
    )
    command.upgrade(config, "head")
    assert (
        database_connection.scalar(
            text("SELECT name FROM departments WHERE department_id=:id"),
            {"id": department_id},
        )
        == "Existing synthetic"
    )
    assert database_connection.scalar(text("SELECT count(*) FROM user_accounts")) == 0
    command.check(config)
