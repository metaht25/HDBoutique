"""Create a lazy engine without connecting or changing the database."""

from sqlalchemy import URL, Engine, create_engine

from app.core.config import Settings


def build_engine(settings: Settings) -> Engine | None:
    if settings.database_host is None:
        return None
    password = settings.database_password
    assert password is not None  # Settings valida la configuracion completa.
    url = URL.create(
        "postgresql+psycopg",
        username=settings.database_user,
        password=password.get_secret_value(),
        host=settings.database_host,
        port=settings.database_port,
        database=settings.database_name,
    )
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=0,
        pool_timeout=3,
        connect_args={"connect_timeout": 3},
        hide_parameters=True,
    )
