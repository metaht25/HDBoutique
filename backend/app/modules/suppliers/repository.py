"""Concrete suppliers persistence; callers own the transaction."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.models import Product
from app.modules.locations.models import Address
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct


class SuppliersRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_supplier(self, offset: int, limit: int) -> list[Supplier]:
        return list(
            self.session.scalars(
                select(Supplier)
                .order_by(Supplier.supplier_id)
                .offset(offset)
                .limit(limit)
            )
        )

    def get_supplier(self, record_id: int) -> Supplier | None:
        return self.session.get(Supplier, record_id)

    def add_supplier(self, record: Supplier) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_supplier(self, record: Supplier) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_supplier_references(self, values: dict[str, object]) -> bool:
        return all(
            (
                "address_id" not in values
                or self.session.get(Address, values["address_id"]) is not None,
            )
        )

    def list_supplier_product(self, offset: int, limit: int) -> list[SupplierProduct]:
        return list(
            self.session.scalars(
                select(SupplierProduct)
                .order_by(SupplierProduct.supplier_product_id)
                .offset(offset)
                .limit(limit)
            )
        )

    def get_supplier_product(self, record_id: int) -> SupplierProduct | None:
        return self.session.get(SupplierProduct, record_id)

    def add_supplier_product(self, record: SupplierProduct) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_supplier_product(self, record: SupplierProduct) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_supplier_product_references(self, values: dict[str, object]) -> bool:
        return all(
            (
                "product_id" not in values
                or self.session.get(Product, values["product_id"]) is not None,
            )
        )

    def list_supplier_offering(self, offset: int, limit: int) -> list[SupplierOffering]:
        return list(
            self.session.scalars(
                select(SupplierOffering)
                .order_by(SupplierOffering.offering_id)
                .offset(offset)
                .limit(limit)
            )
        )

    def get_supplier_offering(self, record_id: int) -> SupplierOffering | None:
        return self.session.get(SupplierOffering, record_id)

    def add_supplier_offering(self, record: SupplierOffering) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_supplier_offering(self, record: SupplierOffering) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_supplier_offering_references(self, values: dict[str, object]) -> bool:
        return all(
            (
                "supplier_id" not in values
                or self.session.get(Supplier, values["supplier_id"]) is not None,
                "supplier_product_id" not in values
                or self.session.get(SupplierProduct, values["supplier_product_id"])
                is not None,
            )
        )
