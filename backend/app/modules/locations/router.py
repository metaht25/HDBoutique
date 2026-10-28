"""Development/test locations routes; production exposure awaits phase 8."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies import DatabaseSession
from app.api.schemas import ErrorResponse
from app.modules.identity.dependencies import authorize_business_request
from app.modules.locations.schemas import (
    AddressCreate,
    AddressPatch,
    AddressRead,
    DepartmentCreate,
    DepartmentPatch,
    DepartmentRead,
    MunicipalityCreate,
    MunicipalityPatch,
    MunicipalityRead,
)
from app.modules.locations.service import LocationsService

router = APIRouter(
    prefix="/api/v1",
    dependencies=[Depends(authorize_business_request)],
    tags=["locations"],
    responses={
        status: {"model": ErrorResponse} for status in (401, 403, 404, 409, 422, 503)
    },
)


@router.get("/departments", response_model=list[DepartmentRead])
def list_department(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return LocationsService(session).list_department(offset, limit)


@router.get("/departments/{record_id}", response_model=DepartmentRead)
def get_department(record_id: int, session: DatabaseSession) -> object:
    return LocationsService(session).get_department(record_id)


@router.post("/departments", response_model=DepartmentRead, status_code=201)
def create_department(payload: DepartmentCreate, session: DatabaseSession) -> object:
    return LocationsService(session).save_department(payload)


@router.put("/departments/{record_id}", response_model=DepartmentRead)
def replace_department(
    record_id: int, payload: DepartmentCreate, session: DatabaseSession
) -> object:
    complete = DepartmentCreate(**payload.model_dump())
    return LocationsService(session).save_department(complete, record_id)


@router.patch("/departments/{record_id}", response_model=DepartmentRead)
def update_department(
    record_id: int, payload: DepartmentPatch, session: DatabaseSession
) -> object:
    return LocationsService(session).save_department(payload, record_id)


@router.delete("/departments/{record_id}", status_code=204)
def delete_department(record_id: int, session: DatabaseSession) -> Response:
    LocationsService(session).delete_department(record_id)
    return Response(status_code=204)


@router.get("/municipalities", response_model=list[MunicipalityRead])
def list_municipality(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return LocationsService(session).list_municipality(offset, limit)


@router.get("/municipalities/{record_id}", response_model=MunicipalityRead)
def get_municipality(record_id: int, session: DatabaseSession) -> object:
    return LocationsService(session).get_municipality(record_id)


@router.post("/municipalities", response_model=MunicipalityRead, status_code=201)
def create_municipality(
    payload: MunicipalityCreate, session: DatabaseSession
) -> object:
    return LocationsService(session).save_municipality(payload)


@router.put("/municipalities/{record_id}", response_model=MunicipalityRead)
def replace_municipality(
    record_id: int, payload: MunicipalityCreate, session: DatabaseSession
) -> object:
    complete = MunicipalityCreate(**payload.model_dump())
    return LocationsService(session).save_municipality(complete, record_id)


@router.patch("/municipalities/{record_id}", response_model=MunicipalityRead)
def update_municipality(
    record_id: int, payload: MunicipalityPatch, session: DatabaseSession
) -> object:
    return LocationsService(session).save_municipality(payload, record_id)


@router.delete("/municipalities/{record_id}", status_code=204)
def delete_municipality(record_id: int, session: DatabaseSession) -> Response:
    LocationsService(session).delete_municipality(record_id)
    return Response(status_code=204)


@router.get("/addresses", response_model=list[AddressRead])
def list_address(
    session: DatabaseSession,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> object:
    return LocationsService(session).list_address(offset, limit)


@router.get("/addresses/{record_id}", response_model=AddressRead)
def get_address(record_id: int, session: DatabaseSession) -> object:
    return LocationsService(session).get_address(record_id)


@router.post("/addresses", response_model=AddressRead, status_code=201)
def create_address(payload: AddressCreate, session: DatabaseSession) -> object:
    return LocationsService(session).save_address(payload)


@router.put("/addresses/{record_id}", response_model=AddressRead)
def replace_address(
    record_id: int, payload: AddressCreate, session: DatabaseSession
) -> object:
    complete = AddressCreate(**payload.model_dump())
    return LocationsService(session).save_address(complete, record_id)


@router.patch("/addresses/{record_id}", response_model=AddressRead)
def update_address(
    record_id: int, payload: AddressPatch, session: DatabaseSession
) -> object:
    return LocationsService(session).save_address(payload, record_id)


@router.delete("/addresses/{record_id}", status_code=204)
def delete_address(record_id: int, session: DatabaseSession) -> Response:
    LocationsService(session).delete_address(record_id)
    return Response(status_code=204)
