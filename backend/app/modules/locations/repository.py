"""Concrete locations persistence; callers own the transaction."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.locations.models import Address, Department, Municipality


class LocationsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_department(self, offset: int, limit: int) -> list[Department]:
        return list(
            self.session.scalars(
                select(Department)
                .order_by(Department.department_id)
                .offset(offset)
                .limit(limit)
            )
        )

    def get_department(self, record_id: int) -> Department | None:
        return self.session.get(Department, record_id)

    def add_department(self, record: Department) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_department(self, record: Department) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_department_references(self, values: dict[str, object]) -> bool:
        return True

    def list_municipality(self, offset: int, limit: int) -> list[Municipality]:
        return list(
            self.session.scalars(
                select(Municipality)
                .order_by(Municipality.municipality_id)
                .offset(offset)
                .limit(limit)
            )
        )

    def get_municipality(self, record_id: int) -> Municipality | None:
        return self.session.get(Municipality, record_id)

    def add_municipality(self, record: Municipality) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_municipality(self, record: Municipality) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_municipality_references(self, values: dict[str, object]) -> bool:
        return all(
            (
                "department_id" not in values
                or self.session.get(Department, values["department_id"]) is not None,
            )
        )

    def list_address(self, offset: int, limit: int) -> list[Address]:
        return list(
            self.session.scalars(
                select(Address).order_by(Address.address_id).offset(offset).limit(limit)
            )
        )

    def get_address(self, record_id: int) -> Address | None:
        return self.session.get(Address, record_id)

    def add_address(self, record: Address) -> None:
        self.session.add(record)
        self.session.flush()

    def delete_address(self, record: Address) -> None:
        self.session.delete(record)
        self.session.flush()

    def validate_address_references(self, values: dict[str, object]) -> bool:
        return all(
            (
                "department_id" not in values
                or self.session.get(Department, values["department_id"]) is not None,
            )
        )
