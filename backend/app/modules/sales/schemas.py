"""Complete sale requests; prices, totals and inventory are server-owned."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field, model_validator

from app.api.schemas import InputModel
from app.modules.cash.schemas import PaymentCreate, PaymentRead, VoidRead

PositiveId = Annotated[int, Field(gt=0, strict=True)]


class SaleLineCreate(InputModel):
    product_id: PositiveId
    quantity: Annotated[int, Field(gt=0, le=2147483647, strict=True)]


class SaleCreate(InputModel):
    customer_id: PositiveId | None = None
    customer_kind: Literal["general", "regular", "delivery"] = "regular"
    delivery_cost: Annotated[Decimal, Field(ge=0, max_digits=10, decimal_places=2)] = (
        Decimal("0.00")
    )
    notes: Annotated[str | None, Field(max_length=500)] = None
    employee_id: PositiveId | None = None
    sale_date: date | None = None
    items: Annotated[list[SaleLineCreate], Field(min_length=1, max_length=100)]
    payment: PaymentCreate

    @model_validator(mode="after")
    def reject_duplicate_lines(self) -> Self:
        if len({item.product_id for item in self.items}) != len(self.items):
            raise ValueError("Duplicate product")
        return self


class SaleLineRead(BaseModel):
    product_name: str | None = None
    size_name: str | None = None
    sale_item_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class SaleRead(BaseModel):
    customer_kind: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_address: str | None = None
    seller_name: str | None = None
    delivery_cost: Decimal | None = None
    notes: str | None = None
    sale_id: int
    customer_id: int
    employee_id: int
    sale_date: date
    total: Decimal
    currency: Literal["NIO"] = "NIO"
    status: Literal["confirmed", "voided"] | None
    created_by_user_id: int | None
    created_at: datetime | None
    items: list[SaleLineRead]
    payment: PaymentRead | None
    annulment: VoidRead | None
