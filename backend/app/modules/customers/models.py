"""Customer storage without inferring debt principal, balances or discounts."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Identity, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class CustomerType(Base):
    __tablename__ = "customer_types"

    customer_type_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(20))


class Customer(Base):
    __tablename__ = "customers"

    customer_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    address_id: Mapped[int] = mapped_column(
        ForeignKey("addresses.address_id", ondelete="RESTRICT"), index=True
    )
    customer_type_id: Mapped[int] = mapped_column(
        ForeignKey("customer_types.customer_type_id", ondelete="RESTRICT"), index=True
    )
    first_names: Mapped[str] = mapped_column(String(40))
    last_names: Mapped[str] = mapped_column(String(40))
    phone_number: Mapped[str] = mapped_column(String(10))


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
