"""Inventory history restricted to Administrator."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.modules.identity.dependencies import PurchasingIdentity
from app.modules.inventory.schemas import MovementRead
from app.modules.inventory.service import InventoryService

router = APIRouter(
    prefix="/api/v1/inventory",
    tags=["inventory"],
    responses={code: {"model": ErrorResponse} for code in (401, 403, 422, 503)},
)


@router.get("/movements", response_model=list[MovementRead])
def list_movements(
    session: DatabaseSession,
    actor: PurchasingIdentity,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    product_id: Annotated[int | None, Query(gt=0)] = None,
    purchase_id: Annotated[int | None, Query(gt=0)] = None,
    sale_id: Annotated[int | None, Query(gt=0)] = None,
) -> list[MovementRead]:
    return InventoryService(session).list_movements(
        offset, limit, product_id, purchase_id, sale_id
    )
