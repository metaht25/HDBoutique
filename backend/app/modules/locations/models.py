"""Location storage compatible with the currently declared legacy structure."""

from sqlalchemy import Boolean, ForeignKey, Identity, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class Department(Base):
    __tablename__ = "departments"

    department_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    is_seeded: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    is_permanent: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    name: Mapped[str] = mapped_column(String(40))


class Municipality(Base):
    __tablename__ = "municipalities"

    municipality_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("departments.department_id", ondelete="RESTRICT"), index=True
    )
    is_seeded: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    is_permanent: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
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
