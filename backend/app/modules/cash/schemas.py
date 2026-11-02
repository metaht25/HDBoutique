"""Explicit monetary commands; no implicit payments or partial credit."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BeforeValidator, Field, PlainSerializer, model_validator

from app.api.schemas import InputModel, OutputModel, require_exact_decimal

Money = Annotated[
    Decimal,
    Field(ge=0, max_digits=12, decimal_places=2),
    BeforeValidator(require_exact_decimal),
]
PositiveId = Annotated[int, Field(gt=0, strict=True)]
Reason = Annotated[str, Field(min_length=1, max_length=300)]
Reference = Annotated[str, Field(min_length=1, max_length=100)]
CashMoney = Annotated[
    Decimal, PlainSerializer(lambda value: format(value, ".2f"), return_type=str)
]


class PaymentCreate(InputModel):
    shift_id: Annotated[
        PositiveId | None,
        Field(
            deprecated=True,
            description="Solo para reintentos anteriores; sin efecto operativo.",
        ),
    ] = None
    method: Literal["cash", "transfer", "mixed"]
    transfer_amount: Money | None = None
    received_amount: Money
    reference: Reference | None = None
    transfer_confirmed: Annotated[bool, Field(strict=True)] = False

    @model_validator(mode="after")
    def validate_method(self) -> Self:
        if self.method == "cash":
            if (
                self.reference is not None
                or self.transfer_confirmed
                or self.transfer_amount is not None
            ):
                raise ValueError("Cash requires received amount only")
        elif not self.reference or not self.transfer_confirmed:
            raise ValueError("Confirm the transfer manually and provide its reference")
        if self.method == "mixed" and (
            self.transfer_amount is None or self.transfer_amount <= 0
        ):
            raise ValueError("El pago mixto requiere un monto transferido positivo")
        if self.method == "transfer" and self.transfer_amount is not None:
            raise ValueError("Indica el monto exacto en received_amount")
        return self


class ReturnItemCreate(InputModel):
    sale_item_id: PositiveId
    returned_quantity: Annotated[int, Field(ge=0, le=2147483647, strict=True)]


class VoidCreate(InputModel):
    shift_id: Annotated[
        PositiveId | None,
        Field(
            deprecated=True,
            description="Solo para reintentos anteriores; no utiliza un turno.",
        ),
    ] = None
    reason: Reason
    refund_confirmed: Annotated[bool, Field(strict=True)]
    reference: Reference | None = None
    items: Annotated[list[ReturnItemCreate], Field(min_length=1, max_length=100)]

    @model_validator(mode="after")
    def require_refund_confirmation(self) -> Self:
        if not self.refund_confirmed:
            raise ValueError("Confirm the full refund explicitly")
        return self


class PaymentRead(OutputModel):
    cash_amount: CashMoney | None = None
    transfer_amount: CashMoney | None = None
    payment_id: int
    shift_id: int | None
    method: str
    amount: CashMoney
    received_amount: CashMoney
    change_amount: CashMoney
    reference: str | None


class ReturnItemRead(OutputModel):
    sale_item_id: int
    returned_quantity: int


class VoidRead(OutputModel):
    cash_amount: CashMoney | None = None
    transfer_amount: CashMoney | None = None
    void_id: int
    shift_id: int | None
    reason: str
    method: str
    amount: CashMoney
    reference: str | None
    created_at: datetime
    performed_by_user_id: int
    items: list[ReturnItemRead]
