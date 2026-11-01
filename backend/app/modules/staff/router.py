"""Authenticated employee management and minimal operational selector."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.modules.identity.dependencies import CurrentIdentity, PurchasingIdentity
from app.modules.staff.schemas import (
    EmployeeCreate,
    EmployeeOption,
    EmployeePatch,
    EmployeeRead,
)
from app.modules.staff.service import StaffService

router = APIRouter(
    prefix="/api/v1",
    tags=["staff"],
    responses={
        status: {"model": ErrorResponse} for status in (401, 403, 404, 409, 422, 503)
    },
)


@router.get("/employees", response_model=list[EmployeeRead])
def list_employee(
    session: DatabaseSession,
    actor: PurchasingIdentity,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> object:
    return StaffService(session).list_employee(offset, limit, q.strip() if q else None)


@router.get("/employee-options", response_model=list[EmployeeOption])
def employee_options(
    session: DatabaseSession,
    actor: CurrentIdentity,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> object:
    return StaffService(session).list_options(offset, limit, q.strip() if q else None)


@router.get("/employees/{record_id}", response_model=EmployeeRead)
def get_employee(
    record_id: int, session: DatabaseSession, actor: PurchasingIdentity
) -> object:
    return StaffService(session).get_employee(record_id)


@router.post("/employees", response_model=EmployeeRead, status_code=201)
def create_employee(
    payload: EmployeeCreate, session: DatabaseSession, actor: PurchasingIdentity
) -> object:
    return StaffService(session).save_employee(payload, actor_id=actor.user_id)


@router.patch("/employees/{record_id}", response_model=EmployeeRead)
def update_employee(
    record_id: int,
    payload: EmployeePatch,
    session: DatabaseSession,
    actor: PurchasingIdentity,
) -> object:
    return StaffService(session).save_employee(payload, record_id, actor.user_id)
