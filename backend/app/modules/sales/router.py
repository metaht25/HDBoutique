"""Complete immutable sales for the three approved business roles."""

from typing import Annotated

from fastapi import APIRouter, Header, Query

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.modules.cash.schemas import VoidCreate, VoidRead
from app.modules.cash.service import CashService
from app.modules.identity.dependencies import PurchasingIdentity, SalesIdentity
from app.modules.sales.schemas import SaleCreate, SaleRead
from app.modules.sales.service import SaleService

CommandKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=8,
        max_length=128,
        pattern=r"^[a-zA-Z0-9_-]+$",
    ),
]

router = APIRouter(
    prefix="/api/v1/sales",
    tags=["sales"],
    responses={
        code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422, 503)
    },
)


@router.get("", response_model=list[SaleRead])
def list_sales(
    session: DatabaseSession,
    actor: SalesIdentity,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[SaleRead]:
    return SaleService(session).list_sales(offset, limit, actor)


@router.get("/{sale_id}", response_model=SaleRead)
def get_sale(sale_id: int, session: DatabaseSession, actor: SalesIdentity) -> SaleRead:
    return SaleService(session).get_sale(sale_id, actor)


@router.post("", response_model=SaleRead, status_code=201)
def register_sale(
    payload: SaleCreate,
    session: DatabaseSession,
    actor: SalesIdentity,
    idempotency_key: Annotated[
        str, Header(min_length=8, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$")
    ],
) -> SaleRead:
    return SaleService(session).register(payload, actor, idempotency_key)


@router.post("/{sale_id}/void", response_model=VoidRead, status_code=201)
def void_sale(
    sale_id: int,
    payload: VoidCreate,
    session: DatabaseSession,
    actor: PurchasingIdentity,
    idempotency_key: CommandKey,
) -> VoidRead:
    return CashService(session).void(sale_id, payload, actor, idempotency_key)
