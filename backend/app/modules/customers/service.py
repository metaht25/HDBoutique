"""customers use cases with explicit service-owned transactions."""

from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.boutique.audit import audit
from app.modules.customers.models import Customer, CustomerType
from app.modules.customers.repository import CustomersRepository
from app.modules.customers.schemas import (
    CustomerCreate,
    CustomerPatch,
    CustomerTypeCreate,
    CustomerTypePatch,
)
from app.modules.locations.composition import save_inline_address
from app.modules.locations.models import Address


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

    def list_customer(
        self, offset: int, limit: int, query: str | None = None
    ) -> list[Customer]:

        with self.session.begin():
            return self.repository.list_customer(offset, limit, query)

    def get_customer(self, record_id: int) -> Customer:

        with self.session.begin():
            record = self.repository.get_customer(record_id)

            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")

            return record

    def save_customer(
        self,
        payload: CustomerCreate | CustomerPatch,
        record_id: int | None = None,
        actor_id: int | None = None,
    ) -> Customer:

        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)

                values.pop("address", None)

                if payload.address is not None:
                    if payload.address_id is not None:
                        raise ApplicationError(
                            422,
                            "ambiguous_address",
                            "Indica un domicilio o una dirección existente.",
                        )

                    values["address_id"] = save_inline_address(
                        self.session, payload.address
                    )

                if record_id is None:
                    values.setdefault("kind", "regular")
                    record = Customer(created_at=datetime.now(UTC), **values)

                else:
                    existing = self.repository.get_customer(record_id)

                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")

                    record = existing

                    if record.technical_key:
                        raise ApplicationError(
                            409,
                            "general_customer",
                            "La identidad de Cliente general no se puede modificar.",
                        )

                if not self.repository.validate_customer_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )

                for field, value in values.items():
                    setattr(record, field, value)

                if record.kind == "delivery":
                    address = (
                        self.session.get(Address, record.address_id)
                        if record.address_id
                        else None
                    )

                    if (
                        not record.phone_number
                        or address is None
                        or not address.municipality_id
                        or not address.address_line
                    ):
                        raise ApplicationError(
                            422,
                            "delivery_details_required",
                            "Delivery requiere teléfono, departamento, "
                            "municipio y dirección exacta.",
                        )

                self.repository.add_customer(record)

                audit(
                    self.session,
                    "customers",
                    record.customer_id,
                    "created" if record_id is None else "updated",
                    actor_id,
                    ",".join(sorted(values)),
                )

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

                raise ApplicationError(
                    409,
                    "history_preserved",
                    "Desactiva el cliente para conservar su historia.",
                )

        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error


def general_customer(session: Session) -> Customer:

    session.execute(text("SELECT pg_advisory_xact_lock(671443120620)"))

    customer = session.scalar(
        select(Customer).where(Customer.technical_key == "general")
    )

    if customer is None:
        customer = Customer(
            first_names="Cliente",
            last_names="general",
            kind="general",
            technical_key="general",
            is_active=True,
            created_at=datetime.now(UTC),
        )

        session.add(customer)

        session.flush()

    return customer
