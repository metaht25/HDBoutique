"""One session per request; no implicit transactions or local credential fallback."""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import ApplicationError


def get_session(request: Request) -> Iterator[Session]:
    factory: sessionmaker[Session] | None = request.app.state.session_factory
    if factory is None:
        raise ApplicationError(503, "database_unavailable", "Database unavailable")
    with factory() as session:
        yield session


DatabaseSession = Annotated[Session, Depends(get_session)]
