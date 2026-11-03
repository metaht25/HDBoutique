"""Atomic purchases; all routes require Administrator and write CSRF."""

from typing import Annotated

from fastapi import APIRouter, Header, Query

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.modules.identity.dependencies import PurchasingIdentity
from app.modules.purchases.schemas import PurchaseCreate, PurchaseRead, PurchaseReceive
from app.modules.purchases.service import PurchaseService
from app.modules.suppliers.schemas import SupplierCreate, SupplierRead
from app.modules.suppliers.service import SuppliersService

router = APIRouter(
    prefix="/api/v1/purchases",
    tags=["purchases"],
    responses={
        code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422, 503)
    },
)


@router.get("", response_model=list[PurchaseRead])
def list_purchases(
    session: DatabaseSession,
    actor: PurchasingIdentity,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[PurchaseRead]:
    return PurchaseService(session).list_purchases(offset, limit)


@router.post("/suppliers", response_model=SupplierRead, status_code=201)
def register_supplier(
    payload: SupplierCreate,
    session: DatabaseSession,
    actor: PurchasingIdentity,
    idempotency_key: Annotated[
        str, Header(min_length=8, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$")
    ],
) -> object:
    return SuppliersService(session).register_contextual(
        payload, actor.user_id, idempotency_key
    )


@router.get("/{purchase_id}", response_model=PurchaseRead)
def get_purchase(
    purchase_id: int, session: DatabaseSession, actor: PurchasingIdentity
) -> PurchaseRead:
    return PurchaseService(session).get_purchase(purchase_id)


@router.post("", response_model=PurchaseRead, status_code=201)
def register_purchase(
    payload: PurchaseCreate,
    session: DatabaseSession,
    actor: PurchasingIdentity,
    idempotency_key: Annotated[
        str, Header(min_length=8, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$")
    ],
) -> PurchaseRead:
    return PurchaseService(session).register(payload, actor, idempotency_key)


@router.post("/{purchase_id}/receive", response_model=PurchaseRead)
def receive_purchase(
    purchase_id: int,
    payload: PurchaseReceive,
    session: DatabaseSession,
    actor: PurchasingIdentity,
) -> PurchaseRead:
    return PurchaseService(session).receive(purchase_id, payload, actor)
