"""Explicit suppliers contracts preserving initial compatibility limits."""

from decimal import Decimal
from typing import Annotated

from pydantic import BeforeValidator, Field

from app.api.schemas import (
    InputModel,
    OutputModel,
    PatchModel,
    PhoneNumber,
    require_exact_decimal,
)
from app.modules.locations.composition import InlineAddress


class SupplierCreate(InputModel):
    address_line: Annotated[str | None, Field(max_length=100)] = None
    address: InlineAddress | None = None
    address_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    company_name: Annotated[str, Field(max_length=50, min_length=1, strict=True)]
    contact_first_names: Annotated[str, Field(max_length=50, min_length=1, strict=True)]
    contact_last_names: Annotated[str, Field(max_length=50, min_length=1, strict=True)]
    phone_number: PhoneNumber
    work_email: Annotated[str | None, Field(max_length=40, strict=True)] = None


class SupplierPatch(PatchModel):
    address: InlineAddress | None = None
    is_active: Annotated[bool | None, Field(strict=True)] = None
    required_fields = frozenset(
        [
            "is_active",
            "address_id",
            "company_name",
            "contact_first_names",
            "contact_last_names",
            "phone_number",
        ]
    )
    address_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    company_name: Annotated[
        str | None, Field(max_length=50, min_length=1, strict=True)
    ] = None
    contact_first_names: Annotated[
        str | None, Field(max_length=50, min_length=1, strict=True)
    ] = None
    contact_last_names: Annotated[
        str | None, Field(max_length=50, min_length=1, strict=True)
    ] = None
    phone_number: PhoneNumber | None = None
    work_email: Annotated[str | None, Field(max_length=40, strict=True)] = None


class SupplierRead(OutputModel):
    address_line: str | None = None
    is_active: bool
    supplier_id: int
    address_id: int | None
    company_name: Annotated[str, Field(max_length=50, min_length=1, strict=True)]
    contact_first_names: Annotated[str, Field(max_length=50, min_length=1, strict=True)]
    contact_last_names: Annotated[str, Field(max_length=50, min_length=1, strict=True)]
    phone_number: Annotated[str, Field(max_length=10, min_length=1, strict=True)]
    work_email: Annotated[str | None, Field(max_length=40, strict=True)]


class SupplierProductCreate(InputModel):
    product_id: Annotated[int, Field(gt=0, strict=True)]
    purchase_price: Annotated[
        Decimal,
        Field(max_digits=10, decimal_places=2),
        BeforeValidator(require_exact_decimal),
    ]


class SupplierProductPatch(PatchModel):
    required_fields = frozenset(["product_id", "purchase_price"])
    product_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    purchase_price: Annotated[
        Decimal | None,
        Field(max_digits=10, decimal_places=2),
        BeforeValidator(require_exact_decimal),
    ] = None


class SupplierProductRead(OutputModel):
    supplier_product_id: int
    product_id: Annotated[int, Field(gt=0, strict=True)]
    purchase_price: Annotated[Decimal, Field(max_digits=10, decimal_places=2)]


class SupplierOfferingCreate(InputModel):
    supplier_id: Annotated[int, Field(gt=0, strict=True)]
    supplier_product_id: Annotated[int, Field(gt=0, strict=True)]


class SupplierOfferingPatch(PatchModel):
    required_fields = frozenset(["supplier_id", "supplier_product_id"])
    supplier_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    supplier_product_id: Annotated[int | None, Field(gt=0, strict=True)] = None


class SupplierOfferingRead(OutputModel):
    offering_id: int
    supplier_id: Annotated[int, Field(gt=0, strict=True)]
    supplier_product_id: Annotated[int, Field(gt=0, strict=True)]
