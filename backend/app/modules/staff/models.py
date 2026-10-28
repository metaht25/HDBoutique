"""Preserve employee identity and employment dates without creating accounts."""

from datetime import date

from sqlalchemy import Date, ForeignKey, Identity, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class Employee(Base):
    __tablename__ = "employees"

    employee_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    address_id: Mapped[int] = mapped_column(
        ForeignKey("addresses.address_id", ondelete="RESTRICT"), index=True
    )
    first_names: Mapped[str] = mapped_column(String(40))
    last_names: Mapped[str] = mapped_column(String(40))
    phone_number: Mapped[str] = mapped_column(String(10))
    work_email: Mapped[str | None] = mapped_column(String(20))
    job_title: Mapped[str | None] = mapped_column(String(20))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
