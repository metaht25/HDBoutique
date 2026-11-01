"""Sales storage with exact decimal unit prices and preserved legacy dates."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Identity, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class Sale(Base):
    __tablename__ = "sales"

    sale_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.customer_id", ondelete="RESTRICT"), index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.employee_id", ondelete="RESTRICT"), index=True
    )
    sale_date: Mapped[date] = mapped_column(Date)
    customer_kind: Mapped[str | None] = mapped_column(String(16))
    customer_name: Mapped[str | None] = mapped_column(String(100))
    customer_phone: Mapped[str | None] = mapped_column(String(10))
    customer_address: Mapped[str | None] = mapped_column(String(250))
    seller_name: Mapped[str | None] = mapped_column(String(100))
    delivery_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(String(500))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))


class SaleItem(Base):
    __tablename__ = "sale_items"

    sale_item_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.sale_id", ondelete="RESTRICT"), index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.product_id", ondelete="RESTRICT"), index=True
    )
    product_name: Mapped[str | None] = mapped_column(String(40))
    size_name: Mapped[str | None] = mapped_column(String(20))
    quantity: Mapped[int]
    # 10 digitos enteros preservan todo el rango INTEGER del campo legacy.
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
