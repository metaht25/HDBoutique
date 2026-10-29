"""Catalog storage with available stock and a separate preserved legacy count."""

from decimal import Decimal

from sqlalchemy import ForeignKey, Identity, Numeric, String
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
    # B01: cantidadstock se conserva; solo legacy_stock es disponible.
    legacy_stock_quantity: Mapped[int | None]
    legacy_stock: Mapped[int | None]
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
