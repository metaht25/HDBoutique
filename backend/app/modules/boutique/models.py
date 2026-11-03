"""Small durable profile and append-only management audit, included in pg_dump."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Identity, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


class BoutiqueProfile(Base):
    __tablename__ = "boutique_profiles"

    profile_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    phone_number: Mapped[str | None] = mapped_column(String(30))
    address_line: Mapped[str] = mapped_column(String(250))
    logo: Mapped[bytes | None] = mapped_column(LargeBinary)


class ManagementEvent(Base):
    __tablename__ = "management_events"

    event_id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    resource: Mapped[str] = mapped_column(String(40))
    record_id: Mapped[int]
    action: Mapped[str] = mapped_column(String(40))
    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_accounts.user_id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    detail: Mapped[str] = mapped_column(String(300))
