"""Employee contracts preserving existing field limits and nullable dates."""

from datetime import date
from typing import Annotated

from pydantic import Field

from app.api.schemas import InputModel, OutputModel, PatchModel
from app.modules.identity.schemas import Password
from app.modules.locations.composition import InlineAddress


class EmployeeCreate(InputModel):
    username: Annotated[
        str, Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    ]
    temporary_password: Password
    address: InlineAddress | None = None
    address_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    first_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    last_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    phone_number: Annotated[str, Field(max_length=10, min_length=1, strict=True)]

    work_email: Annotated[str | None, Field(max_length=100, strict=True)] = None
    job_title: Annotated[str | None, Field(max_length=20, strict=True)] = None
    start_date: date | None = None
    end_date: date | None = None


class EmployeePatch(PatchModel):
    temporary_password: Password | None = None
    address: InlineAddress | None = None
    is_active: Annotated[bool | None, Field(strict=True)] = None
    required_fields = frozenset(
        ["address_id", "is_active", "first_names", "last_names", "phone_number"]
    )
    address_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    first_names: Annotated[
        str | None, Field(max_length=40, min_length=1, strict=True)
    ] = None
    last_names: Annotated[
        str | None, Field(max_length=40, min_length=1, strict=True)
    ] = None
    phone_number: Annotated[
        str | None, Field(max_length=10, min_length=1, strict=True)
    ] = None

    work_email: Annotated[str | None, Field(max_length=100, strict=True)] = None
    job_title: Annotated[str | None, Field(max_length=20, strict=True)] = None
    start_date: date | None = None
    end_date: date | None = None


class EmployeeRead(OutputModel):
    username: str | None = None
    is_active: bool
    employee_id: int
    address_id: Annotated[int, Field(gt=0, strict=True)]
    first_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    last_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    phone_number: Annotated[str, Field(max_length=10, min_length=1, strict=True)]

    work_email: Annotated[str | None, Field(max_length=100, strict=True)] = None
    job_title: Annotated[str | None, Field(max_length=20, strict=True)] = None
    start_date: date | None = None
    end_date: date | None = None


class EmployeeOption(OutputModel):
    employee_id: int
    first_names: str
    last_names: str
