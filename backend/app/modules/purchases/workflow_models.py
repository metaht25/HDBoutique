"""New purchase metadata is separate from unverified legacy history."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class PurchaseWorkflow(Base):
    __tablename__ = "purchase_workflows"
    __table_args__ = (
        UniqueConstraint("created_by_user_id", "idempotency_hash"),
        CheckConstraint("status IN ('registered', 'received')", name="valid_status"),
        CheckConstraint(
            "(status = 'registered' AND received_at IS NULL "
            "AND received_by_user_id IS NULL AND received_employee_id IS NULL) OR "
            "(status = 'received' AND received_at IS NOT NULL "
            "AND received_by_user_id IS NOT NULL AND received_employee_id IS NOT NULL)",
            name="receipt_consistency",
        ),
    )
    purchase_id: Mapped[int] = mapped_column(
        ForeignKey("purchases.purchase_id", ondelete="RESTRICT"),
        primary_key=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(16))
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idempotency_hash: Mapped[str] = mapped_column(String(64))
    request_hash: Mapped[str] = mapped_column(String(64))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    received_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"),
        index=True,
    )
    received_employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.employee_id", ondelete="RESTRICT"),
        index=True,
    )


class PurchaseItemCost(Base):
    __tablename__ = "purchase_item_costs"
    __table_args__ = (CheckConstraint("unit_cost >= 0", name="nonnegative_cost"),)

    purchase_item_id: Mapped[int] = mapped_column(
        ForeignKey("purchase_items.purchase_item_id", ondelete="RESTRICT"),
        primary_key=True,
        index=True,
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.product_id", ondelete="RESTRICT"),
        index=True,
    )
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2))
