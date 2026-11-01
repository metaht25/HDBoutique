"""Development/test catalog routes; production exposure awaits phase 8."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.modules.catalog.schemas import (
    CategoryCreate,
    CategoryPatch,
    CategoryRead,
    ProductCreate,
    ProductOwnerRead,
    ProductPatch,
    ProductRead,
    SizeCreate,
    SizePatch,
    SizeRead,
)
from app.modules.catalog.service import CatalogService
from app.modules.identity.dependencies import (
    CurrentIdentity,
    authorize_business_request,
)

router = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(authorize_business_request)],
    tags=["catalog"],
    responses={
        status: {"model": ErrorResponse} for status in (401, 403, 404, 409, 422, 503)
    },
)


@router.get("/categories", response_model=list[CategoryRead])
def list_category(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return CatalogService(session).list_category(offset, limit)


@router.get("/categories/{record_id}", response_model=CategoryRead)
def get_category(record_id: int, session: DatabaseSession) -> object:
    return CatalogService(session).get_category(record_id)


@router.post("/categories", response_model=CategoryRead, status_code=201)
def create_category(payload: CategoryCreate, session: DatabaseSession) -> object:
    return CatalogService(session).save_category(payload)


@router.put("/categories/{record_id}", response_model=CategoryRead)
def replace_category(
    record_id: int, payload: CategoryCreate, session: DatabaseSession
) -> object:
    complete = CategoryCreate(**payload.model_dump())
    return CatalogService(session).save_category(complete, record_id)


@router.patch("/categories/{record_id}", response_model=CategoryRead)
def update_category(
    record_id: int, payload: CategoryPatch, session: DatabaseSession
) -> object:
    return CatalogService(session).save_category(payload, record_id)


@router.delete("/categories/{record_id}", status_code=204)
def delete_category(record_id: int, session: DatabaseSession) -> Response:
    CatalogService(session).delete_category(record_id)
    return Response(status_code=204)


@router.get("/sizes", response_model=list[SizeRead])
def list_size(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return CatalogService(session).list_size(offset, limit)


@router.get("/sizes/{record_id}", response_model=SizeRead)
def get_size(record_id: int, session: DatabaseSession) -> object:
    return CatalogService(session).get_size(record_id)


@router.post("/sizes", response_model=SizeRead, status_code=201)
def create_size(payload: SizeCreate, session: DatabaseSession) -> object:
    return CatalogService(session).save_size(payload)


@router.put("/sizes/{record_id}", response_model=SizeRead)
def replace_size(
    record_id: int, payload: SizeCreate, session: DatabaseSession
) -> object:
    complete = SizeCreate(**payload.model_dump())
    return CatalogService(session).save_size(complete, record_id)


@router.patch("/sizes/{record_id}", response_model=SizeRead)
def update_size(record_id: int, payload: SizePatch, session: DatabaseSession) -> object:
    return CatalogService(session).save_size(payload, record_id)


@router.delete("/sizes/{record_id}", status_code=204)
def delete_size(record_id: int, session: DatabaseSession) -> Response:
    CatalogService(session).delete_size(record_id)
    return Response(status_code=204)


@router.get("/products", response_model=list[ProductOwnerRead | ProductRead])
def list_product(
    session: DatabaseSession,
    actor: CurrentIdentity,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> object:
    rows = CatalogService(session).list_product(offset, limit, q.strip() if q else None)
    schema = ProductOwnerRead if actor.role == "Administrator" else ProductRead
    return [schema.model_validate(row) for row in rows]


@router.get("/products/{record_id}", response_model=ProductOwnerRead | ProductRead)
def get_product(
    record_id: int, session: DatabaseSession, actor: CurrentIdentity
) -> object:
    row = CatalogService(session).get_product(record_id)
    schema = ProductOwnerRead if actor.role == "Administrator" else ProductRead
    return schema.model_validate(row)


@router.post(
    "/products", response_model=ProductOwnerRead | ProductRead, status_code=201
)
def create_product(
    payload: ProductCreate, session: DatabaseSession, actor: CurrentIdentity
) -> object:
    return CatalogService(session).save_product(payload, actor=actor)


@router.put("/products/{record_id}", response_model=ProductOwnerRead | ProductRead)
def replace_product(
    record_id: int,
    payload: ProductCreate,
    session: DatabaseSession,
    actor: CurrentIdentity,
) -> object:
    complete = ProductCreate(**payload.model_dump())
    return CatalogService(session).save_product(complete, record_id, actor)


@router.patch("/products/{record_id}", response_model=ProductOwnerRead | ProductRead)
def update_product(
    record_id: int,
    payload: ProductPatch,
    session: DatabaseSession,
    actor: CurrentIdentity,
) -> object:
    return CatalogService(session).save_product(payload, record_id, actor)


@router.delete("/products/{record_id}", status_code=204)
def delete_product(record_id: int, session: DatabaseSession) -> Response:
    CatalogService(session).delete_product(record_id)
    return Response(status_code=204)
