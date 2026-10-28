"""Concrete identity queries; transaction boundaries belong to the service."""

from datetime import datetime

from sqlalchemy import delete, or_, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.identity.models import LoginThrottle, UserAccount, WebSession
from app.modules.staff.models import Employee


class IdentityRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def user_by_name(self, username: str) -> UserAccount | None:
        return self.session.scalar(
            select(UserAccount).where(UserAccount.username == username)
        )

    def user_by_id(self, user_id: int) -> UserAccount | None:
        return self.session.get(UserAccount, user_id)

    def list_users(self, offset: int, limit: int) -> list[UserAccount]:
        return list(
            self.session.scalars(
                select(UserAccount)
                .order_by(UserAccount.user_id)
                .offset(offset)
                .limit(limit)
            )
        )

    def employee_exists(self, employee_id: int) -> bool:
        return self.session.get(Employee, employee_id) is not None

    def session_by_hash(self, token_hash: str) -> WebSession | None:
        return self.session.scalar(
            select(WebSession)
            .where(WebSession.token_hash == token_hash)
            .with_for_update()
        )

    def add_user(self, user: UserAccount) -> None:
        self.session.add(user)
        self.session.flush()

    def add_session(self, record: WebSession) -> None:
        self.session.add(record)
        self.session.flush()

    def remove_session(self, record: WebSession) -> None:
        self.session.delete(record)

    def revoke_user_sessions(self, user_id: int) -> None:
        self.session.execute(delete(WebSession).where(WebSession.user_id == user_id))

    def lock_administration(self) -> None:
        # Serializa bootstrap y cambios de cuentas; no bloquea el CRUD comercial.
        self.session.execute(text("SELECT pg_advisory_xact_lock(48320901)"))

    def active_administrators(self) -> list[UserAccount]:
        return list(
            self.session.scalars(
                select(UserAccount).where(
                    UserAccount.role == "Administrator",
                    UserAccount.is_active.is_(True),
                )
            )
        )

    def throttle(self, subject_hash: str, now: datetime) -> LoginThrottle:
        self.session.execute(
            insert(LoginThrottle)
            .values(
                subject_hash=subject_hash,
                failures=0,
                window_start=now,
            )
            .on_conflict_do_nothing(index_elements=["subject_hash"])
        )
        return self.session.scalars(
            select(LoginThrottle)
            .where(
                LoginThrottle.subject_hash == subject_hash,
            )
            .with_for_update()
        ).one()

    def purge_expired(self, now: datetime, throttle_cutoff: datetime) -> None:
        self.session.execute(
            delete(WebSession).where(
                or_(
                    WebSession.expires_at <= now,
                    WebSession.last_seen_at <= throttle_cutoff,
                )
            )
        )
        self.session.execute(
            delete(LoginThrottle).where(LoginThrottle.window_start <= throttle_cutoff)
        )
