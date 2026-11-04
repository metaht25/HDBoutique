"""Shared technical validation; business fields remain explicit per module."""

import re
from typing import Annotated, ClassVar

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    ValidationInfo,
    field_validator,
)


def validate_mobile_phone(value: object) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[78][0-9]{3}-?[0-9]{4}", value):
        raise ValueError("El teléfono debe tener ocho dígitos y comenzar con 7 u 8.")
    return value.replace("-", "")


PhoneNumber = Annotated[str, BeforeValidator(validate_mobile_phone)]


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class PatchModel(InputModel):
    required_fields: ClassVar[frozenset[str]] = frozenset()

    @field_validator("*")
    @classmethod
    def reject_required_nulls(cls, value: object, info: ValidationInfo) -> object:
        if value is None and info.field_name in cls.required_fields:
            raise ValueError("This field cannot be null")
        return value


class OutputModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorField(BaseModel):
    location: list[str | int]
    type: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: list[ErrorField] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


def require_exact_decimal(value: object) -> object:
    if isinstance(value, str) and not re.fullmatch(r"-?[0-9]+(?:\.[0-9]{1,2})?", value):
        raise ValueError(
            "Usa un importe decimal sin exponentes y con hasta dos decimales"
        )
    if isinstance(value, (float, bool)):
        raise ValueError("Send money as decimal text or integer")
    return value
