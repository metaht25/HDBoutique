"""Explicit customers contracts preserving initial compatibility limits."""

from typing import Annotated

from pydantic import Field

from app.api.schemas import InputModel, OutputModel, PatchModel


class CustomerTypeCreate(InputModel):
    name: Annotated[str | None, Field(max_length=20, strict=True)] = None


class CustomerTypePatch(PatchModel):
    required_fields = frozenset([])
    name: Annotated[str | None, Field(max_length=20, strict=True)] = None


class CustomerTypeRead(OutputModel):
    customer_type_id: int
    name: Annotated[str | None, Field(max_length=20, strict=True)]


class CustomerCreate(InputModel):
    address_id: Annotated[int, Field(gt=0, strict=True)]
    customer_type_id: Annotated[int, Field(gt=0, strict=True)]
    first_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    last_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    phone_number: Annotated[str, Field(max_length=10, min_length=1, strict=True)]


class CustomerPatch(PatchModel):
    required_fields = frozenset(
        ["address_id", "customer_type_id", "first_names", "last_names", "phone_number"]
    )
    address_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    customer_type_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    first_names: Annotated[
        str | None, Field(max_length=40, min_length=1, strict=True)
    ] = None
    last_names: Annotated[
        str | None, Field(max_length=40, min_length=1, strict=True)
    ] = None
    phone_number: Annotated[
        str | None, Field(max_length=10, min_length=1, strict=True)
    ] = None


class CustomerRead(OutputModel):
    customer_id: int
    address_id: Annotated[int, Field(gt=0, strict=True)]
    customer_type_id: Annotated[int, Field(gt=0, strict=True)]
    first_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    last_names: Annotated[str, Field(max_length=40, min_length=1, strict=True)]
    phone_number: Annotated[str, Field(max_length=10, min_length=1, strict=True)]
