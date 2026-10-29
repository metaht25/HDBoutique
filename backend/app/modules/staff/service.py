"""staff use cases with explicit service-owned transactions."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.staff.models import Employee
from app.modules.staff.repository import StaffRepository
from app.modules.staff.schemas import (
    EmployeeCreate,
    EmployeePatch,
)


class StaffService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = StaffRepository(session)

    def list_employee(
        self, offset: int, limit: int, query: str | None = None
    ) -> list[Employee]:
        with self.session.begin():
            return self.repository.list_employee(offset, limit, query)

    def get_employee(self, record_id: int) -> Employee:
        with self.session.begin():
            record = self.repository.get_employee(record_id)
            if record is None:
                raise ApplicationError(404, "not_found", "Record not found")
            return record

    def save_employee(
        self, payload: EmployeeCreate | EmployeePatch, record_id: int | None = None
    ) -> Employee:
        try:
            with self.session.begin():
                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    record = Employee(**values)
                else:
                    existing = self.repository.get_employee(record_id)
                    if existing is None:
                        raise ApplicationError(404, "not_found", "Record not found")
                    record = existing
                if not self.repository.validate_employee_references(values):
                    raise ApplicationError(
                        422, "invalid_reference", "Related record not found"
                    )
                for field, value in values.items():
                    setattr(record, field, value)
                self.repository.add_employee(record)
            return record
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting related data"
            ) from error

    def list_options(
        self, offset: int, limit: int, query: str | None
    ) -> list[dict[str, object]]:
        with self.session.begin():
            return self.repository.list_options(offset, limit, query)
