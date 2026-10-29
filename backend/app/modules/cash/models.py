"""Append-only receipts, refunds and supervised cash movements."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class CashShift(Base):
    __tablename__ = "cash_shifts"
    __table_args__ = (
        CheckConstraint("register_code = 'main'", name="single_register"),
        CheckConstraint("opening_amount >= 0", name="opening_amount"),
        CheckConstraint(
            "(closed_at IS NULL AND counted_amount IS NULL AND expected_amount IS NULL "
            "AND difference IS NULL AND closed_by_user_id IS NULL) OR "
            "(closed_at IS NOT NULL AND counted_amount IS NOT NULL "
            "AND counted_amount >= 0 AND expected_amount IS NOT NULL "
            "AND difference IS NOT NULL "
            "AND difference = counted_amount - expected_amount "
            "AND closed_by_user_id IS NOT NULL)",
            name="closure",
        ),
        Index(
            "uq_cash_shifts_open_register",
            "register_code",
            unique=True,
            postgresql_where=text("closed_at IS NULL"),
        ),
    )
    shift_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    register_code: Mapped[str] = mapped_column(String(20))
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.employee_id", ondelete="RESTRICT"), index=True
    )
    opened_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"), index=True
    )
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    opening_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    closed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"), index=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    counted_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    expected_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    difference: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    closing_reason: Mapped[str | None] = mapped_column(String(300))


class SalePayment(Base):
    __tablename__ = "sale_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="positive_amount"),
        CheckConstraint(
            "(method = 'cash' AND received_amount >= amount "
            "AND change_amount = received_amount - amount AND reference IS NULL) OR "
            "(method = 'transfer' AND received_amount = amount "
            "AND change_amount = 0 AND reference IS NOT NULL AND "
            "length(reference) > 0)",
            name="full_payment",
        ),
    )
    payment_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.sale_id", ondelete="RESTRICT"), unique=True, index=True
    )
    shift_id: Mapped[int] = mapped_column(
        ForeignKey("cash_shifts.shift_id", ondelete="RESTRICT"), index=True
    )
    method: Mapped[str] = mapped_column(String(16))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    received_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    change_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    reference: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    performed_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"), index=True
    )


class CashMovement(Base):
    __tablename__ = "cash_movements"
    __table_args__ = (
        CheckConstraint(
            "amount > 0 AND kind IN ('deposit', 'withdrawal')", name="valid_movement"
        ),
    )
    movement_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    shift_id: Mapped[int] = mapped_column(
        ForeignKey("cash_shifts.shift_id", ondelete="RESTRICT"), index=True
    )
    kind: Mapped[str] = mapped_column(String(16))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    reason: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    performed_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"), index=True
    )


class SaleVoid(Base):
    __tablename__ = "sale_voids"
    __table_args__ = (
        CheckConstraint(
            "amount > 0 AND method IN ('cash', 'transfer')", name="valid_refund"
        ),
    )
    void_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.sale_id", ondelete="RESTRICT"), unique=True, index=True
    )
    shift_id: Mapped[int] = mapped_column(
        ForeignKey("cash_shifts.shift_id", ondelete="RESTRICT"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    method: Mapped[str] = mapped_column(String(16))
    reference: Mapped[str | None] = mapped_column(String(100))
    reason: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    performed_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"), index=True
    )


class SaleReturnItem(Base):
    __tablename__ = "sale_return_items"
    __table_args__ = (
        CheckConstraint("returned_quantity >= 0", name="returned_quantity"),
    )
    return_item_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    void_id: Mapped[int] = mapped_column(
        ForeignKey("sale_voids.void_id", ondelete="RESTRICT"), index=True
    )
    sale_item_id: Mapped[int] = mapped_column(
        ForeignKey("sale_items.sale_item_id", ondelete="RESTRICT"),
        unique=True,
        index=True,
    )
    returned_quantity: Mapped[int]


class CashRequest(Base):
    __tablename__ = "cash_requests"
    __table_args__ = (UniqueConstraint("actor_id", "operation", "key_hash"),)
    request_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    actor_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"), index=True
    )
    operation: Mapped[str] = mapped_column(String(40))
    key_hash: Mapped[str] = mapped_column(String(64))
    request_hash: Mapped[str] = mapped_column(String(64))
    result_id: Mapped[int]
