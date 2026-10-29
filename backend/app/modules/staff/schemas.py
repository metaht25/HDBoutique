"""Employee contracts preserving existing field limits and nullable dates."""

from datetime import date
from typing import Annotated

from pydantic import Field

from app.api.schemas import InputModel, OutputModel, PatchModel


class EmployeeCreate(InputModel):
    address_id: Annotated[int, Field(gt=0, strict=True)]
    first_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    last_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    phone_number: Annotated[str, Field(max_length=10, min_length=1, strict=True)]

    work_email: Annotated[str | None, Field(max_length=20, strict=True)] = None
    job_title: Annotated[str | None, Field(max_length=20, strict=True)] = None
    start_date: date | None = None
    end_date: date | None = None


class EmployeePatch(PatchModel):
    required_fields = frozenset(
        ["address_id", "first_names", "last_names", "phone_number"]
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

    work_email: Annotated[str | None, Field(max_length=20, strict=True)] = None
    job_title: Annotated[str | None, Field(max_length=20, strict=True)] = None
    start_date: date | None = None
    end_date: date | None = None


class EmployeeRead(OutputModel):
    employee_id: int
    address_id: Annotated[int, Field(gt=0, strict=True)]
    first_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    last_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    phone_number: Annotated[str, Field(max_length=10, min_length=1, strict=True)]

    work_email: Annotated[str | None, Field(max_length=20, strict=True)] = None
    job_title: Annotated[str | None, Field(max_length=20, strict=True)] = None
    start_date: date | None = None
    end_date: date | None = None


class EmployeeOption(OutputModel):
    employee_id: int
    first_names: str
    last_names: str
