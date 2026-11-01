"""Shared technical validation; business fields remain explicit per module."""

from typing import ClassVar

from pydantic import BaseModel, ConfigDict, ValidationInfo, field_validator


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
    if isinstance(value, (float, bool)):
        raise ValueError("Send money as decimal text or integer")
    return value
