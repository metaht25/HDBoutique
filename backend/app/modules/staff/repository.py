"""Concrete employees persistence; callers own the transaction."""

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.locations.models import Address
from app.modules.staff.models import Employee


class StaffRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_employee(
        self, offset: int, limit: int, query: str | None = None
    ) -> list[Employee]:
        statement = select(Employee)
        if query:
            statement = statement.where(
                or_(
                    (Employee.first_names + " " + Employee.last_names).icontains(
                        query, autoescape=True
                    ),
                    Employee.phone_number.icontains(query, autoescape=True),
                )
            )
        return list(
            self.session.scalars(
                statement.order_by(Employee.employee_id).offset(offset).limit(limit)
            )
        )

    def get_employee(self, record_id: int) -> Employee | None:
        return self.session.get(Employee, record_id)

    def add_employee(self, record: Employee) -> None:
        self.session.add(record)
        self.session.flush()

    def validate_employee_references(self, values: dict[str, object]) -> bool:
        return (
            "address_id" not in values
            or self.session.get(Address, values["address_id"]) is not None
        )

    def list_options(
        self, offset: int, limit: int, query: str | None
    ) -> list[dict[str, object]]:
        statement = select(
            Employee.employee_id, Employee.first_names, Employee.last_names
        )
        if query:
            statement = statement.where(
                (Employee.first_names + " " + Employee.last_names).icontains(
                    query, autoescape=True
                )
            )
        return [
            dict(row)
            for row in self.session.execute(
                statement.where(Employee.is_active.is_(True))
                .order_by(Employee.employee_id)
                .offset(offset)
                .limit(limit)
            ).mappings()
        ]
