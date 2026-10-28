"""Process liveness and optional PostgreSQL connectivity readiness."""

from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    scope: Literal["process"] = "process"


class DatabaseHealthResponse(BaseModel):
    status: Literal["ok", "unavailable"] = "ok"
    scope: Literal["database"] = "database"


@router.get("/live", response_model=HealthResponse)
def liveness() -> HealthResponse:
    return HealthResponse()


@router.get(
    "/ready",
    response_model=HealthResponse | DatabaseHealthResponse,
    responses={503: {"model": DatabaseHealthResponse}},
)
def readiness(
    request: Request, response: Response
) -> HealthResponse | DatabaseHealthResponse:
    engine: Engine | None = request.app.state.database_engine
    if engine is None:
        return HealthResponse()
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = 503
        return DatabaseHealthResponse(status="unavailable")
    return DatabaseHealthResponse()
