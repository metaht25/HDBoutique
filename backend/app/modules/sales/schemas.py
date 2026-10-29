"""Complete sale requests; prices, totals and inventory are server-owned."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field, model_validator

from app.api.schemas import InputModel

PositiveId = Annotated[int, Field(gt=0, strict=True)]


class SaleLineCreate(InputModel):
    product_id: PositiveId
    quantity: Annotated[int, Field(gt=0, le=2147483647, strict=True)]


class SaleCreate(InputModel):
    customer_id: PositiveId
    employee_id: PositiveId | None = None
    sale_date: date
    items: Annotated[list[SaleLineCreate], Field(min_length=1, max_length=100)]

    @model_validator(mode="after")
    def reject_duplicate_lines(self) -> Self:
        if len({item.product_id for item in self.items}) != len(self.items):
            raise ValueError("Duplicate product")
        return self


class SaleLineRead(BaseModel):
    sale_item_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class SaleRead(BaseModel):
    sale_id: int
    customer_id: int
    employee_id: int
    sale_date: date
    total: Decimal
    currency: Literal["NIO"] = "NIO"
    status: Literal["confirmed"] | None
    created_by_user_id: int | None
    created_at: datetime | None
    items: list[SaleLineRead]
