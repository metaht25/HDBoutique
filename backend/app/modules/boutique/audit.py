"""Management audit without passwords, contact details or request bodies."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.boutique.models import ManagementEvent


def audit(
    session: Session,
    resource: str,
    record_id: int,
    action: str,
    actor_id: int | None,
    detail: str = "",
) -> None:
    session.add(
        ManagementEvent(
            resource=resource,
            record_id=record_id,
            action=action,
            actor_id=actor_id,
            detail=detail,
            created_at=datetime.now(UTC),
        )
    )
