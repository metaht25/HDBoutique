"""Explicit monetary commands; no implicit payments or partial credit."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, BeforeValidator, Field, PlainSerializer, model_validator

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


class ShiftOpen(InputModel):
    employee_id: PositiveId | None = None
    opening_amount: Money


class ShiftClose(InputModel):
    counted_amount: Money
    reason: Reason | None = None


class MovementCreate(InputModel):
    kind: Literal["deposit", "withdrawal"]
    amount: Annotated[Money, Field(gt=0)]
    reason: Reason


class PaymentCreate(InputModel):
    shift_id: PositiveId
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
    shift_id: PositiveId
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
    shift_id: int
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
    shift_id: int
    reason: str
    method: str
    amount: CashMoney
    reference: str | None
    created_at: datetime
    performed_by_user_id: int
    items: list[ReturnItemRead]


class MovementRead(OutputModel):
    movement_id: int
    kind: str
    amount: CashMoney
    reason: str
    created_at: datetime
    performed_by_user_id: int


class ShiftRead(BaseModel):
    shift_id: int
    register_code: Literal["main"] = "main"
    employee_id: int
    opened_by_user_id: int
    opened_at: datetime
    opening_amount: CashMoney
    status: Literal["open", "closed"]
    cash_collected: CashMoney
    transfers_collected: CashMoney
    cash_refunded: CashMoney
    transfers_refunded: CashMoney
    deposits: CashMoney
    withdrawals: CashMoney
    expected_amount: CashMoney
    counted_amount: CashMoney | None
    difference: CashMoney | None
    closed_at: datetime | None
    closed_by_user_id: int | None
    closing_reason: str | None
    movements: list[MovementRead]
