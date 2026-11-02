"""locations use cases with explicit service-owned transactions."""

import unicodedata

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.locations.models import Address, Department, Municipality
from app.modules.locations.repository import LocationsRepository
from app.modules.locations.schemas import (
    AddressCreate,
    AddressPatch,
    DepartmentCreate,
    DepartmentPatch,
    MunicipalityCreate,
    MunicipalityPatch,
)


class LocationsService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = LocationsRepository(session)

    def list_department(self, offset: int, limit: int) -> list[Department]:
        with self.session.begin():
            return self.repository.list_department(offset, limit)

    def get_department(self, record_id: int) -> Department:
        with self.session.begin():
            record = self.repository.get_department(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_department(
        self, payload: DepartmentCreate | DepartmentPatch, record_id: int | None = None
    ) -> Department:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Department(**values)
                else:
                    existing = self.repository.get_department(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_department_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                if record_id is not None and record.is_permanent:
                    raise ApplicationError(
                        409,
                        "permanent_reference",
                        "Los registros iniciales son permanentes.",
                    )
                self.session.execute(text("SELECT pg_advisory_xact_lock(671443120621)"))
                normalized = normalize_name(record.name)
                with self.session.no_autoflush:
                    candidates = self.session.scalars(select(Department)).all()
                if any(
                    other.department_id != record_id
                    and normalize_name(other.name) == normalized
                    for other in candidates
                ):
                    raise ApplicationError(
                        409, "duplicate_name", "El nombre ya existe en esta ubicación."
                    )
                self.repository.add_department(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_department(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_department(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                if record.is_permanent:
                    raise ApplicationError(
                        409,
                        "permanent_reference",
                        "Los registros iniciales son permanentes.",
                    )
                self.repository.delete_department(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_municipality(self, offset: int, limit: int) -> list[Municipality]:
        with self.session.begin():
            return self.repository.list_municipality(offset, limit)

    def get_municipality(self, record_id: int) -> Municipality:
        with self.session.begin():
            record = self.repository.get_municipality(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_municipality(
        self,
        payload: MunicipalityCreate | MunicipalityPatch,
        record_id: int | None = None,
    ) -> Municipality:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Municipality(**values)
                else:
                    existing = self.repository.get_municipality(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_municipality_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                if (
                    record_id is not None
                    and "department_id" in values
                    and self.session.scalar(
                        select(Address.address_id)
                        .where(
                            Address.municipality_id == record_id,
                            Address.department_id != record.department_id,
                        )
                        .limit(1)
                    )
                ):
                    raise ApplicationError(
                        409,
                        "municipality_in_use",
                        "El municipio tiene domicilios en su departamento actual.",
                    )
                if record_id is not None and record.is_permanent:
                    raise ApplicationError(
                        409,
                        "permanent_reference",
                        "Los registros iniciales son permanentes.",
                    )
                self.session.execute(text("SELECT pg_advisory_xact_lock(671443120621)"))
                normalized = normalize_name(record.name)
                with self.session.no_autoflush:
                    candidates = self.session.scalars(select(Municipality)).all()
                if any(
                    other.municipality_id != record_id
                    and normalize_name(other.name) == normalized
                    and other.department_id == record.department_id
                    for other in candidates
                ):
                    raise ApplicationError(
                        409, "duplicate_name", "El nombre ya existe en esta ubicación."
                    )
                self.repository.add_municipality(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_municipality(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_municipality(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                if record.is_permanent:
                    raise ApplicationError(
                        409,
                        "permanent_reference",
                        "Los registros iniciales son permanentes.",
                    )
                self.repository.delete_municipality(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error

    def list_address(self, offset: int, limit: int) -> list[Address]:
        with self.session.begin():
            return self.repository.list_address(offset, limit)

    def get_address(self, record_id: int) -> Address:
        with self.session.begin():
            record = self.repository.get_address(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_address(
        self, payload: AddressCreate | AddressPatch, record_id: int | None = None
    ) -> Address:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Address(**values)
                else:
                    existing = self.repository.get_address(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_address_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                if record.municipality_id is not None:
                    with self.session.no_autoflush:
                        municipality = self.session.get(
                            Municipality, record.municipality_id
                        )
                    if (
                        municipality is None
                        or municipality.department_id != record.department_id
                    ):
                        raise ApplicationError(
                            422,
                            "invalid_municipality",
                            "El municipio no pertenece al departamento.",
                        )
                self.repository.add_address(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def delete_address(self, record_id: int) -> None:
        try:
            with self.session.begin():
                record = self.repository.get_address(record_id)
                if record is None:
                    raise ApplicationError(404, "not_found", "Record not found")
                self.repository.delete_address(record)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Record is referenced"
            ) from error


def normalize_name(value: str | None) -> str:
    return (
        "".join(
            c
            for c in unicodedata.normalize("NFKD", value or "")
            if not unicodedata.combining(c)
        )
        .strip()
        .casefold()
    )
