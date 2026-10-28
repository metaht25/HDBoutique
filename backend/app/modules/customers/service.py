"""customers use cases with explicit service-owned transactions."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.customers.models import Customer, CustomerType
from app.modules.customers.repository import CustomersRepository
from app.modules.customers.schemas import (
    CustomerCreate,
    CustomerPatch,
    CustomerTypeCreate,
    CustomerTypePatch,
)


class CustomersService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = CustomersRepository(session)

    def list_customer_type(self, offset: int, limit: int) -> list[CustomerType]:
        with self.session.begin():
            return self.repository.list_customer_type(offset, limit)

    def get_customer_type(self, record_id: int) -> CustomerType:
        with self.session.begin():
            record = self.repository.get_customer_type(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_customer_type(
        self,
        payload: CustomerTypeCreate | CustomerTypePatch,
        record_id: int | None = None,
    ) -> CustomerType:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = CustomerType(**values)
                else:
                    existing = self.repository.get_customer_type(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_customer_type_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_customer_type(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_customer_type(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_customer_type(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_customer_type(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_customer(self, offset: int, limit: int) -> list[Customer]:
        with self.session.begin():
            return self.repository.list_customer(offset, limit)

    def get_customer(self, record_id: int) -> Customer:
        with self.session.begin():
            record = self.repository.get_customer(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_customer(
        self, payload: CustomerCreate | CustomerPatch, record_id: int | None = None
    ) -> Customer:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Customer(**values)
                else:
                    existing = self.repository.get_customer(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_customer_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_customer(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_customer(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_customer(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_customer(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error
