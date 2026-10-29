"""Audit and idempotency for new sales, without reconstructing legacy history."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class SaleWorkflow(Base):
    __tablename__ = "sale_workflows"
    __table_args__ = (UniqueConstraint("created_by_user_id", "idempotency_hash"),)

    sale_id: Mapped[int] = mapped_column(
        ForeignKey("sales.sale_id", ondelete="RESTRICT"), primary_key=True, index=True
    )
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idempotency_hash: Mapped[str] = mapped_column(String(64))
    request_hash: Mapped[str] = mapped_column(String(64))
