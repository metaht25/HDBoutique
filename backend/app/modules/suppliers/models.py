"""Preserve supplier associations without assuming pair uniqueness."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Identity, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    supplier_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    address_line: Mapped[str | None] = mapped_column(String(100))
    address_id: Mapped[int | None] = mapped_column(
        ForeignKey("addresses.address_id", ondelete="RESTRICT"), index=True
    )
    company_name: Mapped[str] = mapped_column(String(50))
    contact_first_names: Mapped[str] = mapped_column(String(50))
    contact_last_names: Mapped[str] = mapped_column(String(50))
    phone_number: Mapped[str] = mapped_column(String(10))
    work_email: Mapped[str | None] = mapped_column(String(40))


class SupplierProduct(Base):
    __tablename__ = "supplier_products"

    supplier_product_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.product_id", ondelete="RESTRICT"), index=True
    )
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))


class SupplierOffering(Base):
    __tablename__ = "supplier_offerings"

    # Identidad del destino: la PK fisica de Ofrece aun requiere inventario.
    offering_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.supplier_id", ondelete="RESTRICT"), index=True
    )
    supplier_product_id: Mapped[int] = mapped_column(
        ForeignKey("supplier_products.supplier_product_id", ondelete="RESTRICT"),
        index=True,
    )
