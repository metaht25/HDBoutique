"""Preserve employee identity and employment dates without creating accounts."""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Identity, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class Employee(Base):
    __tablename__ = "employees"

    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    employee_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    address_id: Mapped[int] = mapped_column(
        ForeignKey("addresses.address_id", ondelete="RESTRICT"), index=True
    )
    first_names: Mapped[str] = mapped_column(String(40))
    last_names: Mapped[str] = mapped_column(String(40))
    phone_number: Mapped[str] = mapped_column(String(10))
    work_email: Mapped[str | None] = mapped_column(String(100))
    job_title: Mapped[str | None] = mapped_column(String(20))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
