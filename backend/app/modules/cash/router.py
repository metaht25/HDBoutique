"""Authenticated single-register operations; writes require CSRF and idempotency."""

from typing import Annotated

from fastapi import APIRouter, Header, Query

from app.api.dependencies import DatabaseSession
from app.modules.cash.schemas import MovementCreate, ShiftClose, ShiftOpen, ShiftRead
from app.modules.cash.service import CashService
from app.modules.identity.dependencies import PurchasingIdentity, SalesIdentity

CommandKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=8,
        max_length=128,
        pattern=r"^[a-zA-Z0-9_-]+$",
    ),
]
router = APIRouter(prefix="/api/v1/cash", tags=["cash"])


@router.get("/shifts", response_model=list[ShiftRead])
def list_shifts(
    session: DatabaseSession,
    actor: SalesIdentity,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[ShiftRead]:
    return CashService(session).list_shifts(actor, offset, limit)


@router.post("/shifts", response_model=ShiftRead, status_code=201)
def open_shift(
    payload: ShiftOpen,
    session: DatabaseSession,
    actor: SalesIdentity,
    idempotency_key: CommandKey,
) -> ShiftRead:
    return CashService(session).open(payload, actor, idempotency_key)


@router.post("/shifts/{shift_id}/close", response_model=ShiftRead)
def close_shift(
    shift_id: int,
    payload: ShiftClose,
    session: DatabaseSession,
    actor: SalesIdentity,
    idempotency_key: CommandKey,
) -> ShiftRead:
    return CashService(session).close(shift_id, payload, actor, idempotency_key)


@router.post("/shifts/{shift_id}/movements", response_model=ShiftRead, status_code=201)
def move_cash(
    shift_id: int,
    payload: MovementCreate,
    session: DatabaseSession,
    actor: PurchasingIdentity,
    idempotency_key: CommandKey,
) -> ShiftRead:
    return CashService(session).move(shift_id, payload, actor, idempotency_key)
