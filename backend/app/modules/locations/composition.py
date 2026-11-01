"""Save inline addresses in the caller's transaction; never guess municipalities."""

from typing import Annotated

from pydantic import Field
from sqlalchemy.orm import Session

from app.api.schemas import InputModel
from app.core.errors import ApplicationError
from app.modules.locations.models import Address, Department, Municipality


class InlineAddress(InputModel):
    department_id: Annotated[int, Field(gt=0, strict=True)]
    municipality_id: Annotated[int, Field(gt=0, strict=True)]
    address_line: Annotated[str, Field(min_length=1, max_length=100)]


def save_inline_address(session: Session, payload: InlineAddress) -> int:
    municipality = session.get(Municipality, payload.municipality_id)
    if municipality is None or municipality.department_id != payload.department_id:
        raise ApplicationError(
            422, "invalid_municipality", "El municipio no pertenece al departamento."
        )
    address = Address(**payload.model_dump())
    session.add(address)
    session.flush()
    return address.address_id


def address_text(session: Session, address_id: int | None) -> str | None:
    address = session.get(Address, address_id) if address_id else None
    if address is None:
        return None
    municipality = (
        session.get(Municipality, address.municipality_id)
        if address.municipality_id
        else None
    )
    department = session.get(Department, address.department_id)
    return ", ".join(
        value
        for value in (
            address.address_line,
            municipality.name if municipality else None,
            department.name if department else None,
        )
        if value
    )
