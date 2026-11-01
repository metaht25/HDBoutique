"""Purchase storage preserving dates and original supplier-product links."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Identity, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class Purchase(Base):
    __tablename__ = "purchases"

    purchase_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"), index=True
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.employee_id", ondelete="RESTRICT"), index=True
    )
    purchase_date: Mapped[date] = mapped_column(Date)
    review_date: Mapped[date | None] = mapped_column(Date)
    refill_date: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(String(500))
    shipping_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    purchase_item_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    supplier_product_id: Mapped[int] = mapped_column(
        ForeignKey("supplier_products.supplier_product_id", ondelete="RESTRICT"),
        index=True,
    )
    purchase_id: Mapped[int] = mapped_column(
        ForeignKey("purchases.purchase_id", ondelete="RESTRICT"), index=True
    )
    quantity: Mapped[int]
