"""Explicit operator preparation of a real administrator, employee and boutique."""

from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.boutique.audit import audit
from app.modules.boutique.schemas import ProfileWrite
from app.modules.boutique.service import BoutiqueService
from app.modules.identity.models import UserAccount
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import AccountCreate, AccountPatch
from app.modules.identity.security import verify_password
from app.modules.identity.service import IdentityService, principal_from_user
from app.modules.locations.composition import save_inline_address
from app.modules.locations.models import Address
from app.modules.staff.models import Employee
from app.modules.staff.schemas import EmployeeCreate


class InitialSetupService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def configure(
        self,
        employee: EmployeeCreate,
        profile: ProfileWrite,
        *,
        existing_account: bool = False,
    ) -> UserAccount:
        try:
            with self.session.begin():
                identity = IdentityRepository(self.session)
                identity.lock_administration()
                user = identity.user_by_name(employee.username.lower())
                if existing_account:
                    if (
                        user is None
                        or not user.is_active
                        or user.role != "Administrator"
                        or not verify_password(
                            user.password_hash, employee.password.get_secret_value()
                        )
                    ):
                        raise ApplicationError(
                            403,
                            "setup_not_authorized",
                            "Verifica la cuenta y su contraseña actual.",
                        )
                    if user.employee_id is not None:
                        raise ApplicationError(
                            409,
                            "setup_already_linked",
                            "La cuenta ya tiene empleado; no se sustituye.",
                        )
                elif identity.list_users(0, 1):
                    raise ApplicationError(
                        409,
                        "bootstrap_unavailable",
                        "Ya existen cuentas; usa complete-setup si corresponde.",
                    )
                values = employee.model_dump(
                    exclude={"username", "password", "address"}
                )
                if employee.address is not None:
                    if employee.address_id is not None:
                        raise ApplicationError(
                            422, "ambiguous_address", "Indica un único domicilio."
                        )
                    values["address_id"] = save_inline_address(
                        self.session, employee.address
                    )
                address_id = values.get("address_id")
                if address_id is None or self.session.get(Address, address_id) is None:
                    raise ApplicationError(
                        422,
                        "address_required",
                        "Indica un domicilio válido para la identidad real.",
                    )
                person = Employee(
                    **values, created_at=datetime.now(UTC), is_active=True
                )
                self.session.add(person)
                self.session.flush()
                service = IdentityService(self.session)
                if existing_account:
                    assert user is not None
                    user = service.update_user(
                        user.user_id,
                        AccountPatch(employee_id=person.employee_id),
                        in_transaction=True,
                    )
                else:
                    user = service.create_user(
                        AccountCreate(
                            username=employee.username,
                            password=employee.password,
                            role="Administrator",
                            employee_id=person.employee_id,
                        ),
                        bootstrap=True,
                        in_transaction=True,
                    )
                BoutiqueService(self.session).save(
                    profile, principal_from_user(user), in_transaction=True
                )
                audit(
                    self.session,
                    "employees",
                    person.employee_id,
                    "initial_setup",
                    user.user_id,
                )
                return user
        except IntegrityError as error:
            raise ApplicationError(
                409,
                "setup_conflict",
                "Conflicto de preparación; no se guardaron cambios.",
            ) from error

    def status(self) -> dict[str, bool]:
        with self.session.begin():
            users = IdentityRepository(self.session).usable_administrators()
            operational = any(user.employee_id is not None for user in users)
        profile = BoutiqueService(self.session).profile()
        return {
            "administrator_can_login": bool(users),
            "administrator_can_operate": operational,
            "boutique_ready": profile.ready,
            "ready": operational and profile.ready,
        }
