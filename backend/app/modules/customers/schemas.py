"""Explicit customers contracts preserving initial compatibility limits."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from app.api.schemas import InputModel, OutputModel, PatchModel, PhoneNumber
from app.modules.locations.composition import InlineAddress


class CustomerTypeCreate(InputModel):
    name: Annotated[str, Field(min_length=1, max_length=20, strict=True)]


class CustomerTypePatch(PatchModel):
    required_fields = frozenset(["name"])
    name: Annotated[str | None, Field(min_length=1, max_length=20, strict=True)] = None


class CustomerTypeRead(OutputModel):
    customer_type_id: int
    name: Annotated[str | None, Field(max_length=20, strict=True)]


class CustomerCreate(InputModel):
    address_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    address: InlineAddress | None = None
    customer_type_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    kind: Literal["regular", "delivery"] = "regular"
    first_names: Annotated[str, Field(max_length=40, min_length=1)]
    last_names: Annotated[str, Field(max_length=40, min_length=1)]
    phone_number: PhoneNumber | None = None


class CustomerPatch(PatchModel):
    required_fields = frozenset(["first_names", "last_names", "kind", "is_active"])
    address_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    address: InlineAddress | None = None
    customer_type_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    kind: Literal["regular", "delivery"] | None = None
    first_names: Annotated[str | None, Field(max_length=40, min_length=1)] = None
    last_names: Annotated[str | None, Field(max_length=40, min_length=1)] = None
    phone_number: PhoneNumber | None = None
    is_active: Annotated[bool | None, Field(strict=True)] = None


class CustomerRead(OutputModel):
    customer_id: int
    address_id: int | None
    customer_type_id: int | None
    kind: str | None
    first_names: str
    last_names: str
    phone_number: str | None
    is_active: bool
    created_at: datetime | None
