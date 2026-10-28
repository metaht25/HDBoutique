"""catalog use cases with explicit service-owned transactions."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.catalog.models import Category, Product, Size
from app.modules.catalog.repository import CatalogRepository
from app.modules.catalog.schemas import (
    CategoryCreate,
    CategoryPatch,
    ProductCreate,
    ProductPatch,
    SizeCreate,
    SizePatch,
)


class CatalogService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = CatalogRepository(session)

    def list_category(self, offset: int, limit: int) -> list[Category]:
        with self.session.begin():
            return self.repository.list_category(offset, limit)

    def get_category(self, record_id: int) -> Category:
        with self.session.begin():
            record = self.repository.get_category(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_category(
        self, payload: CategoryCreate | CategoryPatch, record_id: int | None = None
    ) -> Category:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Category(**values)
                else:
                    existing = self.repository.get_category(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_category_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_category(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_category(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_category(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_category(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_size(self, offset: int, limit: int) -> list[Size]:
        with self.session.begin():
            return self.repository.list_size(offset, limit)

    def get_size(self, record_id: int) -> Size:
        with self.session.begin():
            record = self.repository.get_size(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_size(
        self, payload: SizeCreate | SizePatch, record_id: int | None = None
    ) -> Size:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Size(**values)
                else:
                    existing = self.repository.get_size(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_size_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_size(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_size(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_size(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_size(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_product(self, offset: int, limit: int) -> list[Product]:
        with self.session.begin():
            return self.repository.list_product(offset, limit)

    def get_product(self, record_id: int) -> Product:
        with self.session.begin():
            record = self.repository.get_product(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_product(
        self, payload: ProductCreate | ProductPatch, record_id: int | None = None
    ) -> Product:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Product(legacy_stock=0, **values)
                else:
                    existing = self.repository.get_product(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_product_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_product(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_product(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_product(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_product(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error
