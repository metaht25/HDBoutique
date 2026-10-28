"""One inventory entry per received purchase line, preserving before/after values."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    __table_args__ = (
        CheckConstraint("movement_type = 'purchase_receipt'", name="receipt_type"),
        CheckConstraint(
            "quantity > 0 AND stock_before >= 0 AND stock_after >= 0",
            name="valid_quantities",
        ),
        CheckConstraint("stock_after = stock_before + quantity", name="stock_delta"),
    )
    movement_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.product_id", ondelete="RESTRICT"),
        index=True,
    )
    purchase_item_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_items.purchase_item_id", ondelete="RESTRICT"),
        unique=True,
        index=True,
    )
    movement_type: Mapped[str] = mapped_column(String(24))
    quantity: Mapped[int]
    stock_before: Mapped[int]
    stock_after: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    performed_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"),
        index=True,
    )
    employee_id: Mapped[int] = mapped_column(
        ForeignKey("employees.employee_id", ondelete="RESTRICT"),
        index=True,
    )
