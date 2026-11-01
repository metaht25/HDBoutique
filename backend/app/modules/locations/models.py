"""Location storage compatible with the currently declared legacy structure."""

from sqlalchemy import ForeignKey, Identity, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class Department(Base):
    __tablename__ = "departments"

    department_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))


class Municipality(Base):
    __tablename__ = "municipalities"

    municipality_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.department_id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str | None] = mapped_column(String(40))


class Address(Base):
    __tablename__ = "addresses"

    address_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.department_id", ondelete="RESTRICT"), index=True
    )
    municipality_id: Mapped[int | None] = mapped_column(
        ForeignKey("municipalities.municipality_id", ondelete="RESTRICT"), index=True
    )
    address_line: Mapped[str | None] = mapped_column(String(100))
