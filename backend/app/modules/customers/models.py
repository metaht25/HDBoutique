"""Customer storage without inferring debt principal, balances or discounts."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Numeric,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class CustomerType(Base):
    __tablename__ = "customer_types"

    customer_type_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(20))


class Customer(Base):
    __tablename__ = "customers"

    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    customer_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    address_id: Mapped[int | None] = mapped_column(
        ForeignKey("addresses.address_id", ondelete="RESTRICT"), index=True
    )
    customer_type_id: Mapped[int | None] = mapped_column(
        ForeignKey("customer_types.customer_type_id", ondelete="RESTRICT"), index=True
    )
    first_names: Mapped[str] = mapped_column(String(40))
    last_names: Mapped[str] = mapped_column(String(40))
    kind: Mapped[str | None] = mapped_column(String(16))
    technical_key: Mapped[str | None] = mapped_column(String(30), unique=True)
    phone_number: Mapped[str | None] = mapped_column(String(10))


class CustomerPayment(Base):
    __tablename__ = "customer_payments"

    payment_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.customer_id", ondelete="RESTRICT"), index=True
    )
    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.sale_id", ondelete="RESTRICT"), index=True
    )
    payment_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
