"""Atomic purchase input; historical costs and totals are read-only."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, BeforeValidator, Field, field_validator, model_validator

from app.api.schemas import InputModel, require_exact_decimal
from app.modules.suppliers.schemas import SupplierCreate

PositiveId = Annotated[int, Field(gt=0, strict=True)]
Money = Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)]


class PurchaseLineCreate(InputModel):
    supplier_product_id: PositiveId | None = None
    product_id: PositiveId | None = None
    unit_cost: (
        Annotated[
            Decimal,
            Field(gt=0, max_digits=10, decimal_places=2),
            BeforeValidator(require_exact_decimal),
        ]
        | None
    ) = None

    @model_validator(mode="after")
    def validate_source(self) -> Self:
        if (self.supplier_product_id is None) == (self.product_id is None):
            raise ValueError("Indica un único producto")
        if self.supplier_product_id is not None and self.unit_cost is not None:
            raise ValueError("El costo explícito requiere seleccionar el producto")
        return self

    quantity: Annotated[int, Field(gt=0, le=2147483647, strict=True)]


class PurchaseCreate(InputModel):
    description: Annotated[str | None, Field(max_length=500)] = None
    supplier_id: PositiveId | None = None
    supplier: SupplierCreate | None = None
    employee_id: PositiveId | None = None
    purchase_date: date
    review_date: date | None = None
    refill_date: date | None = None
    shipping_cost: Money = Decimal("0.00")
    items: Annotated[list[PurchaseLineCreate], Field(min_length=1, max_length=100)]

    @field_validator("shipping_cost", mode="before")
    @classmethod
    def require_exact_money(cls, value: object) -> object:
        return require_exact_decimal(value)

    @field_validator("shipping_cost")
    @classmethod
    def normalize_money_scale(cls, value: Decimal) -> Decimal:
        # La precision ya fue validada; no se redondean fracciones adicionales.
        return value.quantize(Decimal("0.01"))

    @model_validator(mode="after")
    def reject_duplicate_lines(self) -> Self:
        if len(
            {(item.supplier_product_id, item.product_id) for item in self.items}
        ) != len(self.items):
            raise ValueError("Duplicate supplier product")
        return self


class PurchaseReceive(InputModel):
    employee_id: PositiveId | None = None


class PurchaseLineRead(BaseModel):
    purchase_item_id: int
    supplier_product_id: int
    quantity: int
    product_id: int | None
    unit_cost: Decimal | None
    subtotal: Decimal | None


class PurchaseRead(BaseModel):
    description: str | None = None
    purchase_id: int
    supplier_id: int
    employee_id: int
    purchase_date: date
    review_date: date | None
    refill_date: date | None
    shipping_cost: Decimal | None
    currency: Literal["NIO"] = "NIO"
    status: Literal["registered", "received"] | None
    created_by_user_id: int | None
    created_at: datetime | None
    received_at: datetime | None
    received_by_user_id: int | None
    received_employee_id: int | None
    items: list[PurchaseLineRead]
    merchandise_total: Decimal | None
    total: Decimal | None
