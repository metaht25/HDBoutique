"""Explicit identity input and output; password hashes never leave the server."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from app.api.schemas import OutputModel, PatchModel

Role = Literal["Administrator", "Cashier"]
Password = Annotated[SecretStr, Field(min_length=6, max_length=128)]


def normalize_username(value: str) -> str:
    return value.strip().lower()


class LoginInput(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    username: Annotated[
        str, Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")
    ]
    password: Annotated[SecretStr, Field(min_length=1, max_length=128)]

    @field_validator("username", mode="before")
    @classmethod
    def normalize(cls, value: object) -> object:
        return normalize_username(value) if isinstance(value, str) else value


class AccountCreate(LoginInput):
    password: Password
    role: Role
    employee_id: Annotated[int | None, Field(gt=0, strict=True)] = None


class AccountPatch(PatchModel):
    model_config = ConfigDict(str_strip_whitespace=False, hide_input_in_errors=True)
    required_fields = frozenset(["password", "role", "is_active"])
    password: Password | None = None
    role: Role | None = None
    is_active: Annotated[bool | None, Field(strict=True)] = None
    employee_id: Annotated[int | None, Field(gt=0, strict=True)] = None


class AccountRead(OutputModel):
    must_change_password: bool = False
    display_name: str | None = None
    user_id: int
    username: str
    role: str
    is_active: bool
    employee_id: int | None


class CsrfResponse(BaseModel):
    csrf_token: str


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)
    current_password: Annotated[SecretStr, Field(min_length=1, max_length=128)]
    new_password: Password
