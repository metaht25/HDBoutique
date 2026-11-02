"""Concrete cash persistence; caller owns transactions and lock order."""

from hashlib import sha256

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modules.cash.models import (
    CashRequest,
    SalePayment,
    SaleVoid,
)


class CashRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def lock_request(self, actor_id: int, operation: str, key_hash: str) -> None:
        value = int.from_bytes(
            sha256(f"cash:{actor_id}:{operation}:{key_hash}".encode()).digest()[:8],
            signed=True,
        )
        self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": value})

    def request(
        self, actor_id: int, operation: str, key_hash: str
    ) -> CashRequest | None:
        return self.session.scalar(
            select(CashRequest).where(
                CashRequest.actor_id == actor_id,
                CashRequest.operation == operation,
                CashRequest.key_hash == key_hash,
            )
        )

    def add(self, record: CashRequest | SalePayment | SaleVoid) -> None:
        self.session.add(record)
        self.session.flush()
