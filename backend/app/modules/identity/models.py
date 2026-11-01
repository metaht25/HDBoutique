"""Identity storage is independent from legacy employee and Django accounts."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class UserAccount(Base):
    __tablename__ = "user_accounts"
    __table_args__ = (
        CheckConstraint(
            "role IN ('Administrator', 'Manager', 'Cashier')",
            name="valid_role",
        ),
    )

    user_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean)
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false")
    )
    employee_id: Mapped[int | None] = mapped_column(
        ForeignKey("employees.employee_id", ondelete="RESTRICT"),
        unique=True,
        index=True,
    )


class WebSession(Base):
    __tablename__ = "web_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"),
        index=True,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LoginThrottle(Base):
    __tablename__ = "login_throttles"

    subject_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    failures: Mapped[int]
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
