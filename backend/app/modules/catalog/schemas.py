"""Explicit catalog contracts preserving initial compatibility limits."""

from decimal import Decimal
from typing import Annotated

from pydantic import BeforeValidator, Field

from app.api.schemas import InputModel, OutputModel, PatchModel, require_exact_decimal


class CategoryCreate(InputModel):
    name: Annotated[str, Field(min_length=1, max_length=20, strict=True)]


class CategoryPatch(PatchModel):
    required_fields = frozenset(["name"])

    name: Annotated[str | None, Field(min_length=1, max_length=20, strict=True)] = None


class CategoryRead(OutputModel):
    category_id: int

    name: Annotated[str | None, Field(max_length=20, strict=True)]


class SizeCreate(InputModel):
    name: Annotated[str, Field(max_length=20, min_length=1, strict=True)]


class SizePatch(PatchModel):
    required_fields = frozenset(["name"])

    name: Annotated[str | None, Field(max_length=20, min_length=1, strict=True)] = None


class SizeRead(OutputModel):
    is_permanent: bool = False

    size_id: int

    name: Annotated[str | None, Field(max_length=20, strict=True)]


class ProductCreate(InputModel):
    category_id: Annotated[int, Field(gt=0, strict=True)]

    size_id: Annotated[int, Field(gt=0, strict=True)]

    name: Annotated[str, Field(max_length=40, min_length=1)]

    cost: Annotated[
        Decimal,
        Field(gt=0, le=Decimal("86956521.73"), decimal_places=2),
        BeforeValidator(require_exact_decimal),
    ]

    initial_stock: Annotated[int, Field(ge=0, le=0, strict=True)] = 0

    supplier_ids: Annotated[
        list[Annotated[int, Field(gt=0, strict=True)]],
        Field(min_length=1, max_length=100),
    ]

    description: Annotated[str | None, Field(max_length=500)] = None


class ProductPatch(PatchModel):
    supplier_ids: Annotated[
        list[Annotated[int, Field(gt=0, strict=True)]] | None,
        Field(min_length=1, max_length=100),
    ] = None

    required_fields = frozenset(["category_id", "size_id", "name", "cost", "is_active"])

    category_id: Annotated[int | None, Field(gt=0, strict=True)] = None

    size_id: Annotated[int | None, Field(gt=0, strict=True)] = None

    name: Annotated[str | None, Field(max_length=40, min_length=1)] = None

    cost: Annotated[
        Decimal | None,
        Field(gt=0, le=Decimal("86956521.73"), decimal_places=2),
        BeforeValidator(require_exact_decimal),
    ] = None

    description: Annotated[str | None, Field(max_length=500)] = None

    is_active: Annotated[bool | None, Field(strict=True)] = None


class ProductRead(OutputModel):
    product_id: int

    category_id: int

    size_id: int

    name: str | None

    legacy_stock_quantity: int | None

    legacy_stock: int | None

    unit_price: Decimal | None

    is_active: bool

    description: str | None


class ProductOwnerRead(ProductRead):
    cost: Decimal | None

    supplier_id: int | None
