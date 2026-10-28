"""Development/test customers routes; production exposure awaits phase 8."""

from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.modules.customers.schemas import (
    CustomerCreate,
    CustomerPatch,
    CustomerRead,
    CustomerTypeCreate,
    CustomerTypePatch,
    CustomerTypeRead,
)
from app.modules.customers.service import CustomersService

router = APIRouter(
    prefix="/api/v1",
    tags=["customers"],
    responses={status: {"model": ErrorResponse} for status in (404, 409, 422, 503)},
)


@router.get("/customer-types", response_model=list[CustomerTypeRead])
def list_customer_type(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return CustomersService(session).list_customer_type(offset, limit)


@router.get("/customer-types/{record_id}", response_model=CustomerTypeRead)
def get_customer_type(record_id: int, session: DatabaseSession) -> object:
    return CustomersService(session).get_customer_type(record_id)


@router.post("/customer-types", response_model=CustomerTypeRead, status_code=201)
def create_customer_type(
    payload: CustomerTypeCreate, session: DatabaseSession
) -> object:
    return CustomersService(session).save_customer_type(payload)


@router.put("/customer-types/{record_id}", response_model=CustomerTypeRead)
def replace_customer_type(
    record_id: int, payload: CustomerTypeCreate, session: DatabaseSession
) -> object:
    complete = CustomerTypeCreate(**payload.model_dump())
    return CustomersService(session).save_customer_type(complete, record_id)


@router.patch("/customer-types/{record_id}", response_model=CustomerTypeRead)
def update_customer_type(
    record_id: int, payload: CustomerTypePatch, session: DatabaseSession
) -> object:
    return CustomersService(session).save_customer_type(payload, record_id)


@router.delete("/customer-types/{record_id}", status_code=204)
def delete_customer_type(record_id: int, session: DatabaseSession) -> Response:
    CustomersService(session).delete_customer_type(record_id)
    return Response(status_code=204)


@router.get("/customers", response_model=list[CustomerRead])
def list_customer(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return CustomersService(session).list_customer(offset, limit)


@router.get("/customers/{record_id}", response_model=CustomerRead)
def get_customer(record_id: int, session: DatabaseSession) -> object:
    return CustomersService(session).get_customer(record_id)


@router.post("/customers", response_model=CustomerRead, status_code=201)
def create_customer(payload: CustomerCreate, session: DatabaseSession) -> object:
    return CustomersService(session).save_customer(payload)


@router.put("/customers/{record_id}", response_model=CustomerRead)
def replace_customer(
    record_id: int, payload: CustomerCreate, session: DatabaseSession
) -> object:
    complete = CustomerCreate(**payload.model_dump())
    return CustomersService(session).save_customer(complete, record_id)


@router.patch("/customers/{record_id}", response_model=CustomerRead)
def update_customer(
    record_id: int, payload: CustomerPatch, session: DatabaseSession
) -> object:
    return CustomersService(session).save_customer(payload, record_id)


@router.delete("/customers/{record_id}", status_code=204)
def delete_customer(record_id: int, session: DatabaseSession) -> Response:
    CustomersService(session).delete_customer(record_id)
    return Response(status_code=204)
