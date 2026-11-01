"""Catalog storage with available stock and a separate preserved legacy count."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Identity, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class Category(Base):
    __tablename__ = "categories"

    category_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(20))


class Size(Base):
    __tablename__ = "sizes"

    size_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(20))


class Product(Base):
    __tablename__ = "products"

    product_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.category_id", ondelete="RESTRICT"), index=True
    )
    size_id: Mapped[int] = mapped_column(
        ForeignKey("sizes.size_id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str | None] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    supplier_id: Mapped[int | None] = mapped_column(
        ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"), index=True
    )
    created_date: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(String(500))
    # B01: cantidadstock se conserva; solo legacy_stock es disponible.
    legacy_stock_quantity: Mapped[int | None]
    legacy_stock: Mapped[int | None]
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
