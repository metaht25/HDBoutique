"""Development/test suppliers routes; production exposure awaits phase 8."""

from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.modules.suppliers.schemas import (
    SupplierCreate,
    SupplierOfferingCreate,
    SupplierOfferingPatch,
    SupplierOfferingRead,
    SupplierPatch,
    SupplierProductCreate,
    SupplierProductPatch,
    SupplierProductRead,
    SupplierRead,
)
from app.modules.suppliers.service import SuppliersService

router = APIRouter(
    prefix="/api/v1",
    tags=["suppliers"],
    responses={status: {"model": ErrorResponse} for status in (404, 409, 422, 503)},
)


@router.get("/suppliers", response_model=list[SupplierRead])
def list_supplier(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return SuppliersService(session).list_supplier(offset, limit)


@router.get("/suppliers/{record_id}", response_model=SupplierRead)
def get_supplier(record_id: int, session: DatabaseSession) -> object:
    return SuppliersService(session).get_supplier(record_id)


@router.post("/suppliers", response_model=SupplierRead, status_code=201)
def create_supplier(payload: SupplierCreate, session: DatabaseSession) -> object:
    return SuppliersService(session).save_supplier(payload)


@router.put("/suppliers/{record_id}", response_model=SupplierRead)
def replace_supplier(
    record_id: int, payload: SupplierCreate, session: DatabaseSession
) -> object:
    complete = SupplierCreate(**payload.model_dump())
    return SuppliersService(session).save_supplier(complete, record_id)


@router.patch("/suppliers/{record_id}", response_model=SupplierRead)
def update_supplier(
    record_id: int, payload: SupplierPatch, session: DatabaseSession
) -> object:
    return SuppliersService(session).save_supplier(payload, record_id)


@router.delete("/suppliers/{record_id}", status_code=204)
def delete_supplier(record_id: int, session: DatabaseSession) -> Response:
    SuppliersService(session).delete_supplier(record_id)
    return Response(status_code=204)


@router.get("/supplier-products", response_model=list[SupplierProductRead])
def list_supplier_product(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return SuppliersService(session).list_supplier_product(offset, limit)


@router.get("/supplier-products/{record_id}", response_model=SupplierProductRead)
def get_supplier_product(record_id: int, session: DatabaseSession) -> object:
    return SuppliersService(session).get_supplier_product(record_id)


@router.post("/supplier-products", response_model=SupplierProductRead, status_code=201)
def create_supplier_product(
    payload: SupplierProductCreate, session: DatabaseSession
) -> object:
    return SuppliersService(session).save_supplier_product(payload)


@router.put("/supplier-products/{record_id}", response_model=SupplierProductRead)
def replace_supplier_product(
    record_id: int, payload: SupplierProductCreate, session: DatabaseSession
) -> object:
    complete = SupplierProductCreate(**payload.model_dump())
    return SuppliersService(session).save_supplier_product(complete, record_id)


@router.patch("/supplier-products/{record_id}", response_model=SupplierProductRead)
def update_supplier_product(
    record_id: int, payload: SupplierProductPatch, session: DatabaseSession
) -> object:
    return SuppliersService(session).save_supplier_product(payload, record_id)


@router.delete("/supplier-products/{record_id}", status_code=204)
def delete_supplier_product(record_id: int, session: DatabaseSession) -> Response:
    SuppliersService(session).delete_supplier_product(record_id)
    return Response(status_code=204)


@router.get("/supplier-offerings", response_model=list[SupplierOfferingRead])
def list_supplier_offering(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return SuppliersService(session).list_supplier_offering(offset, limit)


@router.get("/supplier-offerings/{record_id}", response_model=SupplierOfferingRead)
def get_supplier_offering(record_id: int, session: DatabaseSession) -> object:
    return SuppliersService(session).get_supplier_offering(record_id)


@router.post(
    "/supplier-offerings", response_model=SupplierOfferingRead, status_code=201
)
def create_supplier_offering(
    payload: SupplierOfferingCreate, session: DatabaseSession
) -> object:
    return SuppliersService(session).save_supplier_offering(payload)


@router.put("/supplier-offerings/{record_id}", response_model=SupplierOfferingRead)
def replace_supplier_offering(
    record_id: int, payload: SupplierOfferingCreate, session: DatabaseSession
) -> object:
    complete = SupplierOfferingCreate(**payload.model_dump())
    return SuppliersService(session).save_supplier_offering(complete, record_id)


@router.patch("/supplier-offerings/{record_id}", response_model=SupplierOfferingRead)
def update_supplier_offering(
    record_id: int, payload: SupplierOfferingPatch, session: DatabaseSession
) -> object:
    return SuppliersService(session).save_supplier_offering(payload, record_id)


@router.delete("/supplier-offerings/{record_id}", status_code=204)
def delete_supplier_offering(record_id: int, session: DatabaseSession) -> Response:
    SuppliersService(session).delete_supplier_offering(record_id)
    return Response(status_code=204)
