"""Concrete cash persistence; caller owns transactions and lock order."""

from decimal import Decimal
from hashlib import sha256

from sqlalchemy import case, func, select, text
from sqlalchemy.orm import Session

from app.modules.cash.models import (
    CashMovement,
    CashRequest,
    CashShift,
    SalePayment,
    SaleVoid,
)


class CashRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def lock_register(self) -> None:
        # One physical box. All commands acquire this before shift/sale/product locks.
        self.session.execute(text("SELECT pg_advisory_xact_lock(671443120619)"))

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

    def shift(self, shift_id: int) -> CashShift | None:
        return self.session.scalar(
            select(CashShift).where(CashShift.shift_id == shift_id).with_for_update()
        )

    def totals(self, shift_id: int) -> dict[str, Decimal]:
        result: dict[str, Decimal] = {}
        for model, prefix in ((SalePayment, "collected"), (SaleVoid, "refunded")):
            for method in ("cash", "transfer"):
                result[f"{method}_{prefix}"] = self.session.scalar(
                    select(
                        func.coalesce(
                            func.sum(
                                func.coalesce(
                                    getattr(model, method + "_amount"),
                                    case(
                                        (model.method == method, model.amount), else_=0
                                    ),
                                )
                            ),
                            0,
                        )
                    ).where(model.shift_id == shift_id)
                ) or Decimal("0.00")
        for kind in ("deposit", "withdrawal"):
            result[kind] = self.session.scalar(
                select(func.coalesce(func.sum(CashMovement.amount), 0)).where(
                    CashMovement.shift_id == shift_id,
                    CashMovement.kind == kind,
                )
            ) or Decimal("0.00")
        return result

    def expected(self, shift: CashShift) -> Decimal:
        totals = self.totals(shift.shift_id)
        return (
            shift.opening_amount
            + totals["cash_collected"]
            - totals["cash_refunded"]
            + totals["deposit"]
            - totals["withdrawal"]
        )

    def add(
        self, record: CashShift | CashRequest | CashMovement | SalePayment | SaleVoid
    ) -> None:
        self.session.add(record)
        self.session.flush()
