"""Alembic integration using typed process settings or a supplied connection."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection

from app.core.config import Settings
from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from app.infrastructure.database.connection import build_engine

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)
target_metadata = Base.metadata


def run_with_connection(connection: Connection) -> None:
    if connection.dialect.name != "postgresql":
        raise RuntimeError("Migrations require PostgreSQL")
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    supplied_connection = config.attributes.get("connection")
    if supplied_connection is not None:
        if not isinstance(supplied_connection, Connection):
            raise TypeError("Alembic connection must be a SQLAlchemy Connection")
        run_with_connection(supplied_connection)
        return
    engine = build_engine(Settings())
    if engine is None:
        raise RuntimeError("Configure HDB_DATABASE_* before running online migrations")
    try:
        with engine.connect() as connection:
            run_with_connection(connection)
    finally:
        engine.dispose()


def run_migrations_offline() -> None:
    # El SQL offline no necesita destino, credenciales ni un driver conectado.
    context.configure(
        dialect_name="postgresql",
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
