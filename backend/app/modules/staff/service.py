"""staff use cases with explicit service-owned transactions."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.boutique.audit import audit
from app.modules.identity.models import UserAccount
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.security import hash_password
from app.modules.locations.composition import save_inline_address
from app.modules.staff.models import Employee
from app.modules.staff.repository import StaffRepository
from app.modules.staff.schemas import (
    EmployeeCreate,
    EmployeePatch,
    validate_employee_phone,
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
        self,
        payload: EmployeeCreate | EmployeePatch,
        record_id: int | None = None,
        actor_id: int | None = None,
    ) -> Employee:

        try:
            with self.session.begin():
                identity = IdentityRepository(self.session)

                identity.lock_administration()

                values = payload.model_dump(exclude_unset=True)
                if record_id is None:
                    values["job_title"] = "Vendedor"

                if "phone_number" in values:
                    validate_employee_phone(values["phone_number"])

                username = values.pop("username", None)

                values.pop("password", None)

                values.pop("address", None)

                if payload.address is not None:
                    if payload.address_id is not None:
                        raise ApplicationError(
                            422, "ambiguous_address", "Indica un único domicilio."
                        )

                    values["address_id"] = save_inline_address(
                        self.session, payload.address
                    )

                if record_id is None and not values.get("address_id"):
                    raise ApplicationError(
                        422,
                        "address_required",
                        "Indica departamento, municipio y dirección exacta.",
                    )

                if record_id is None:
                    record = Employee(created_at=datetime.now(UTC), **values)

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
                    if (
                        field == "job_title"
                        and record_id is not None
                        and value != record.job_title
                    ):
                        raise ApplicationError(
                            422, "invalid_job_title", "El cargo no se puede modificar."
                        )
                    setattr(record, field, value)

                self.repository.add_employee(record)

                account = self.session.scalar(
                    select(UserAccount).where(
                        UserAccount.employee_id == record.employee_id
                    )
                )

                if record_id is None:
                    assert isinstance(payload, EmployeeCreate)

                    account = UserAccount(
                        username=str(username).strip().lower(),
                        password_hash=hash_password(
                            payload.password.get_secret_value()
                        ),
                        employee_id=record.employee_id,
                        role="Cashier",
                        is_active=True,
                        must_change_password=False,
                    )

                    self.session.add(account)

                elif account is not None:
                    if (
                        values.get("is_active") is False
                        and account.role == "Administrator"
                        and account.is_active
                        and not identity.usable_administrators(
                            excluding_user_id=account.user_id
                        )
                    ):
                        raise ApplicationError(
                            409, "last_administrator", "Debe quedar una dueña activa."
                        )

                    if "is_active" in values:
                        account.is_active = record.is_active

                        identity.revoke_user_sessions(account.user_id)

                    if payload.password is not None:
                        account.password_hash = hash_password(
                            payload.password.get_secret_value()
                        )

                        account.must_change_password = False

                        identity.revoke_user_sessions(account.user_id)

                elif payload.password is not None:
                    raise ApplicationError(
                        422,
                        "account_required",
                        "Vincula primero una cuenta existente al empleado.",
                    )

                audit(
                    self.session,
                    "employees",
                    record.employee_id,
                    "created" if record_id is None else "updated",
                    actor_id,
                    ",".join(sorted(values)),
                )

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
