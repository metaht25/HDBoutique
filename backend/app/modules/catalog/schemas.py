"""Explicit catalog contracts preserving initial compatibility limits."""

from decimal import Decimal
from typing import Annotated

from pydantic import Field

from app.api.schemas import InputModel, OutputModel, PatchModel


class CategoryCreate(InputModel):
    name: Annotated[str | None, Field(max_length=20, strict=True)] = None


class CategoryPatch(PatchModel):
    required_fields = frozenset([])
    name: Annotated[str | None, Field(max_length=20, strict=True)] = None


class CategoryRead(OutputModel):
    category_id: int
    name: Annotated[str | None, Field(max_length=20, strict=True)]


class SizeCreate(InputModel):
    name: Annotated[str, Field(max_length=20, min_length=1, strict=True)]


class SizePatch(PatchModel):
    required_fields = frozenset(["name"])
    name: Annotated[str | None, Field(max_length=20, min_length=1, strict=True)] = None


class SizeRead(OutputModel):
    size_id: int
    name: Annotated[str, Field(max_length=20, min_length=1, strict=True)]


class ProductCreate(InputModel):
    category_id: Annotated[int, Field(gt=0, strict=True)]
    size_id: Annotated[int, Field(gt=0, strict=True)]
    name: Annotated[str | None, Field(max_length=40, strict=True)] = None
    unit_price: Annotated[Decimal | None, Field(max_digits=10, decimal_places=2)] = None


class ProductPatch(PatchModel):
    required_fields = frozenset(["category_id", "size_id"])
    category_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    size_id: Annotated[int | None, Field(gt=0, strict=True)] = None
    name: Annotated[str | None, Field(max_length=40, strict=True)] = None
    unit_price: Annotated[Decimal | None, Field(max_digits=10, decimal_places=2)] = None


class ProductRead(OutputModel):
    product_id: int
    category_id: Annotated[int, Field(gt=0, strict=True)]
    size_id: Annotated[int, Field(gt=0, strict=True)]
    name: Annotated[str | None, Field(max_length=40, strict=True)]
    legacy_stock_quantity: Annotated[
        int | None, Field(ge=-2147483648, le=2147483647, strict=True)
    ]
    legacy_stock: Annotated[
        int | None, Field(ge=-2147483648, le=2147483647, strict=True)
    ]
    unit_price: Annotated[Decimal | None, Field(max_digits=10, decimal_places=2)]
