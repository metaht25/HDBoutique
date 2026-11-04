"""Employee contracts preserving existing field limits and nullable dates."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BeforeValidator, ConfigDict, Field, ValidationInfo, field_validator

from app.api.schemas import InputModel, OutputModel, PatchModel, validate_mobile_phone
from app.modules.identity.schemas import Password
from app.modules.locations.composition import InlineAddress


def validate_employee_phone(value: object) -> object:
    return validate_mobile_phone(value)


EmployeePhone = Annotated[str, BeforeValidator(validate_employee_phone)]


class EmployeeInput(InputModel):
    model_config = ConfigDict(str_strip_whitespace=False, hide_input_in_errors=True)

    @field_validator("*", mode="before")
    @classmethod
    def normalize_text(cls, value: object, info: ValidationInfo) -> object:
        if isinstance(value, str) and info.field_name not in {
            "password",
            "phone_number",
        }:
            return value.strip()
        return value


class EmployeeCreate(EmployeeInput):
    username: Annotated[
        str, Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    ]
    password: Password
    address: InlineAddress | None = None
    address_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    first_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    last_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    phone_number: EmployeePhone

    job_title: Literal["Vendedor"] = "Vendedor"
    start_date: date | None = None
    end_date: date | None = None


class EmployeePatch(PatchModel, EmployeeInput):
    password: Password | None = None
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
    phone_number: EmployeePhone | None = None

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

    job_title: Annotated[str | None, Field(max_length=20, strict=True)] = None
    start_date: date | None = None
    end_date: date | None = None


class EmployeeOption(OutputModel):
    employee_id: int
    first_names: str
    last_names: str
