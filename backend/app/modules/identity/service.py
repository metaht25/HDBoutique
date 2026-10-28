"""Identity use cases: explicit transactions, revocation and fail-closed sessions."""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.identity.models import UserAccount, WebSession
from app.modules.identity.repository import IdentityRepository
from app.modules.identity.schemas import AccountCreate, AccountPatch
from app.modules.identity.security import (
    PASSWORD_HASHER,
    digest_token,
    dummy_password_hash,
    hash_password,
    matches_token,
    new_token,
    verify_password,
)

LOGGER = logging.getLogger("hdb.security")
SESSION_LIFETIME = timedelta(hours=8)
IDLE_TIMEOUT = timedelta(minutes=30)
PREAUTH_LIFETIME = timedelta(minutes=10)
THROTTLE_WINDOW = timedelta(minutes=15)


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class Principal:
    user_id: int
    username: str
    role: str
    is_active: bool
    employee_id: int | None


def principal_from_user(user: UserAccount) -> Principal:
    return Principal(
        user.user_id, user.username, user.role, user.is_active, user.employee_id
    )


def unauthorized() -> ApplicationError:
    return ApplicationError(401, "authentication_required", "Authentication required")


class IdentityService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = IdentityRepository(session)

    def _valid_session(self, token: str | None, now: datetime) -> WebSession | None:
        if not token or len(token) > 128:
            return None
        record = self.repository.session_by_hash(digest_token(token))
        if (
            record is None
            or record.expires_at <= now
            or record.last_seen_at + IDLE_TIMEOUT <= now
        ):
            return None
        return record

    def _new_session(self, user_id: int | None, now: datetime) -> tuple[str, str]:
        token, csrf = new_token(), new_token()
        self.repository.add_session(
            WebSession(
                token_hash=digest_token(token),
                csrf_hash=digest_token(csrf),
                user_id=user_id,
                last_seen_at=now,
                expires_at=now
                + (SESSION_LIFETIME if user_id is not None else PREAUTH_LIFETIME),
            )
        )
        return token, csrf

    def csrf(self, token: str | None) -> tuple[str | None, str]:
        with self.session.begin():
            record = self._valid_session(token, utc_now())
            if record is not None:
                csrf = new_token()
                record.csrf_hash = digest_token(csrf)
                return None, csrf
            return self._new_session(None, utc_now())

    def authenticate(
        self, token: str | None, csrf: str | None = None, *, write: bool = False
    ) -> Principal:
        with self.session.begin():
            record = self._valid_session(token, utc_now())
            if record is None or record.user_id is None:
                raise unauthorized()
            user = self.repository.user_by_id(record.user_id)
            if user is None or not user.is_active:
                raise unauthorized()
            if write and not matches_token(csrf, record.csrf_hash):
                LOGGER.warning("csrf_rejected")
                raise ApplicationError(403, "csrf_failed", "CSRF validation failed")
            record.last_seen_at = utc_now()
            return principal_from_user(user)

    def login(
        self,
        token: str | None,
        csrf: str | None,
        username: str,
        password: str,
        peer: str,
    ) -> tuple[str, str, Principal]:
        failure: ApplicationError | None = None
        result: tuple[str, str, Principal] | None = None
        with self.session.begin():
            self.repository.lock_administration()
            now = utc_now()
            record = self._valid_session(token, now)
            if record is None or not matches_token(csrf, record.csrf_hash):
                raise ApplicationError(403, "csrf_failed", "CSRF validation failed")
            # Orden de bloqueo estable para evitar interbloqueos entre cuenta e IP.
            subjects = [
                (digest_token("account:" + username), 5),
                (digest_token("peer:" + peer), 30),
            ]
            throttles = [
                (self.repository.throttle(subject, now), limit)
                for subject, limit in sorted(subjects)
            ]
            for throttle, _ in throttles:
                if throttle.window_start + THROTTLE_WINDOW <= now:
                    throttle.failures = 0
                    throttle.window_start = now
            if any(throttle.failures >= limit for throttle, limit in throttles):
                failure = ApplicationError(429, "login_throttled", "Try again later")
                LOGGER.warning("login_throttled")
            else:
                user = self.repository.user_by_name(username)
                encoded = (
                    user.password_hash if user is not None else dummy_password_hash()
                )
                valid = verify_password(encoded, password)
                if not valid or user is None or not user.is_active:
                    for throttle, _ in throttles:
                        throttle.failures += 1
                    failure = ApplicationError(
                        401, "invalid_credentials", "Invalid credentials"
                    )
                    LOGGER.warning("login_failed")
                else:
                    if PASSWORD_HASHER.check_needs_rehash(user.password_hash):
                        user.password_hash = hash_password(password)
                    self.repository.remove_session(record)
                    new_session, new_csrf = self._new_session(user.user_id, now)
                    result = new_session, new_csrf, principal_from_user(user)
                    LOGGER.info("login_succeeded user_id=%s", user.user_id)
        # El rechazo ocurre despues de confirmar los contadores de intentos.
        if failure is not None:
            raise failure
        assert result is not None
        return result

    def logout(self, token: str) -> None:
        with self.session.begin():
            record = self.repository.session_by_hash(digest_token(token))
            if record is not None:
                self.repository.remove_session(record)
            LOGGER.info("logout_succeeded")

    def list_users(self, offset: int, limit: int) -> list[UserAccount]:
        with self.session.begin():
            return self.repository.list_users(offset, limit)

    def create_user(
        self, payload: AccountCreate, *, bootstrap: bool = False
    ) -> UserAccount:
        try:
            with self.session.begin():
                self.repository.lock_administration()
                if bootstrap and self.repository.active_administrators():
                    raise ApplicationError(
                        409, "bootstrap_unavailable", "Administrator already exists"
                    )
                if bootstrap and payload.role != "Administrator":
                    raise ApplicationError(
                        422, "invalid_role", "Bootstrap requires Administrator"
                    )
                if (
                    payload.employee_id is not None
                    and not self.repository.employee_exists(payload.employee_id)
                ):
                    raise ApplicationError(
                        422, "invalid_reference", "Employee not found"
                    )
                user = UserAccount(
                    username=payload.username,
                    password_hash=hash_password(payload.password.get_secret_value()),
                    role=payload.role,
                    employee_id=payload.employee_id,
                    is_active=True,
                )
                self.repository.add_user(user)
                LOGGER.info("account_created user_id=%s", user.user_id)
            return user
        except IntegrityError as error:
            raise ApplicationError(
                409, "account_conflict", "Username or employee already assigned"
            ) from error

    def update_user(self, user_id: int, payload: AccountPatch) -> UserAccount:
        try:
            with self.session.begin():
                self.repository.lock_administration()
                user = self.repository.user_by_id(user_id)
                if user is None:
                    raise ApplicationError(404, "not_found", "Account not found")
                if (
                    payload.employee_id is not None
                    and not self.repository.employee_exists(payload.employee_id)
                ):
                    raise ApplicationError(
                        422, "invalid_reference", "Employee not found"
                    )
                removes_admin = (
                    payload.role not in (None, "Administrator")
                    or payload.is_active is False
                )
                if (
                    user.is_active
                    and user.role == "Administrator"
                    and removes_admin
                    and len(self.repository.active_administrators()) == 1
                ):
                    raise ApplicationError(
                        409, "last_administrator", "An active Administrator is required"
                    )
                for field in payload.model_fields_set:
                    value = getattr(payload, field)
                    if field == "password":
                        user.password_hash = hash_password(value.get_secret_value())
                    else:
                        setattr(user, field, value)
                if payload.model_fields_set:
                    self.repository.revoke_user_sessions(user_id)
                self.repository.add_user(user)
                LOGGER.info("account_updated user_id=%s", user.user_id)
            return user
        except IntegrityError as error:
            raise ApplicationError(
                409, "account_conflict", "Employee already assigned"
            ) from error

    def purge_expired(self) -> None:
        with self.session.begin():
            self.repository.purge_expired(utc_now(), utc_now() - IDLE_TIMEOUT)
