"""Explicit PostgreSQL test target; never fall back to application credentials."""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, inspect

from app.core.config import Settings
from app.infrastructure.database.connection import build_engine

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def migration_config(connection: Connection) -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.attributes["connection"] = connection
    return config


@pytest.fixture(scope="session")
def postgres_engine() -> Iterator[Engine]:
    required = ("HOST", "NAME", "USER", "PASSWORD")
    if any(not os.environ.get(f"HDB_TEST_DATABASE_{name}") for name in required):
        pytest.fail("Set all HDB_TEST_DATABASE_* values for isolated PostgreSQL tests")
    database_name = os.environ["HDB_TEST_DATABASE_NAME"]
    if not database_name.endswith("_test"):
        pytest.fail("The isolated database name must end with _test")
    settings = Settings(
        environment="test",
        database_host=os.environ["HDB_TEST_DATABASE_HOST"],
        database_port=int(os.environ.get("HDB_TEST_DATABASE_PORT", "5432")),
        database_name=database_name,
        database_user=os.environ["HDB_TEST_DATABASE_USER"],
        database_password=os.environ["HDB_TEST_DATABASE_PASSWORD"],
    )
    engine = build_engine(settings)
    assert engine is not None
    try:
        with engine.begin() as connection:
            if inspect(connection).get_table_names():
                pytest.fail(
                    "Integration tests require an empty database; no data was removed"
                )
            command.upgrade(migration_config(connection), "head")
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def database_connection(postgres_engine: Engine) -> Iterator[Connection]:
    with postgres_engine.connect() as connection:
        transaction = connection.begin()
        try:
            yield connection
        finally:
            transaction.rollback()
