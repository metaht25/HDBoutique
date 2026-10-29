"""suppliers use cases with explicit service-owned transactions."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct
from app.modules.suppliers.repository import SuppliersRepository
from app.modules.suppliers.schemas import (
    SupplierCreate,
    SupplierOfferingCreate,
    SupplierOfferingPatch,
    SupplierPatch,
    SupplierProductCreate,
    SupplierProductPatch,
)


class SuppliersService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = SuppliersRepository(session)

    def list_supplier(
        self, offset: int, limit: int, query: str | None = None
    ) -> list[Supplier]:
        with self.session.begin():
            return self.repository.list_supplier(offset, limit, query)

    def get_supplier(self, record_id: int) -> Supplier:
        with self.session.begin():
            record = self.repository.get_supplier(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_supplier(
        self, payload: SupplierCreate | SupplierPatch, record_id: int | None = None
    ) -> Supplier:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Supplier(**values)
                else:
                    existing = self.repository.get_supplier(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_supplier_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_supplier(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_supplier(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_supplier(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_supplier(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_supplier_product(self, offset: int, limit: int) -> list[SupplierProduct]:
        with self.session.begin():
            return self.repository.list_supplier_product(offset, limit)

    def get_supplier_product(self, record_id: int) -> SupplierProduct:
        with self.session.begin():
            record = self.repository.get_supplier_product(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_supplier_product(
        self,
        payload: SupplierProductCreate | SupplierProductPatch,
        record_id: int | None = None,
    ) -> SupplierProduct:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = SupplierProduct(**values)
                else:
                    existing = self.repository.get_supplier_product(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_supplier_product_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_supplier_product(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_supplier_product(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_supplier_product(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_supplier_product(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_supplier_offering(self, offset: int, limit: int) -> list[SupplierOffering]:
        with self.session.begin():
            return self.repository.list_supplier_offering(offset, limit)

    def get_supplier_offering(self, record_id: int) -> SupplierOffering:
        with self.session.begin():
            record = self.repository.get_supplier_offering(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_supplier_offering(
        self,
        payload: SupplierOfferingCreate | SupplierOfferingPatch,
        record_id: int | None = None,
    ) -> SupplierOffering:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = SupplierOffering(**values)
                else:
                    existing = self.repository.get_supplier_offering(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_supplier_offering_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_supplier_offering(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_supplier_offering(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_supplier_offering(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_supplier_offering(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error
