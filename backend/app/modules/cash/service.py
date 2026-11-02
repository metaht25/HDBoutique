"""Atomic full payments and supervised whole-sale corrections; no live shifts."""

import json
from datetime import UTC, datetime
from decimal import Decimal
from hashlib import sha256

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.cash.models import (
    CashRequest,
    SalePayment,
    SaleReturnItem,
    SaleVoid,
)
from app.modules.cash.repository import CashRepository
from app.modules.cash.schemas import (
    PaymentCreate,
    ReturnItemRead,
    VoidCreate,
    VoidRead,
)
from app.modules.identity.models import UserAccount
from app.modules.identity.service import Principal
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.sales.models import Sale, SaleItem


def conflict(code: str, message: str) -> ApplicationError:
    return ApplicationError(409, code, message)


class CashService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = CashRepository(session)

    def _actor(self, actor: Principal, *, supervisor: bool = False) -> UserAccount:
        account = self.session.get(UserAccount, actor.user_id)
        roles = {"Administrator"} if supervisor else {"Administrator", "Cashier"}
        if account is None or not account.is_active or account.role not in roles:
            raise ApplicationError(403, "permission_denied", "Permission denied")
        return account

    def _request(
        self, actor: Principal, operation: str, key: str, payload: BaseModel
    ) -> tuple[CashRequest | None, str, str]:
        key_hash = sha256(key.encode()).hexdigest()
        values = payload.model_dump(mode="json")
        if values.get("shift_id") is None:
            values.pop("shift_id", None)
        digest = sha256(
            json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        self.repository.lock_request(actor.user_id, operation, key_hash)
        existing = self.repository.request(actor.user_id, operation, key_hash)
        if existing and existing.request_hash != digest:
            raise conflict(
                "idempotency_conflict", "Key already used for another request"
            )
        return existing, key_hash, digest

    def _remember(
        self,
        actor: Principal,
        operation: str,
        key_hash: str,
        digest: str,
        result_id: int,
    ) -> None:
        self.repository.add(
            CashRequest(
                actor_id=actor.user_id,
                operation=operation,
                key_hash=key_hash,
                request_hash=digest,
                result_id=result_id,
            )
        )

    def collect(
        self, sale_id: int, total: Decimal, payload: PaymentCreate, actor: Principal
    ) -> None:
        # Called only inside the atomic sale transaction.
        received = payload.received_amount
        transfer = (
            payload.transfer_amount
            if payload.method == "mixed"
            else total
            if payload.method == "transfer"
            else Decimal("0.00")
        )
        assert transfer is not None
        applied_cash = total - transfer
        if (
            (payload.method == "mixed" and not Decimal("0.00") < transfer < total)
            or (payload.method == "transfer" and received != total)
            or (payload.method != "transfer" and received < applied_cash)
        ):
            raise ApplicationError(
                422,
                "payment_incomplete",
                "El pago debe cubrir el total exacto; revisa efectivo y transferencia.",
            )
        self.repository.add(
            SalePayment(
                sale_id=sale_id,
                shift_id=None,
                method=payload.method,
                amount=total,
                cash_amount=applied_cash,
                transfer_amount=transfer,
                received_amount=received,
                change_amount=received - applied_cash
                if payload.method != "transfer"
                else Decimal("0.00"),
                reference=payload.reference,
                created_at=datetime.now(UTC),
                performed_by_user_id=actor.user_id,
            )
        )

    def void_detail(self, sale_id: int) -> VoidRead | None:
        record = self.session.scalar(
            select(SaleVoid).where(SaleVoid.sale_id == sale_id)
        )
        if record is None:
            return None
        return VoidRead(
            void_id=record.void_id,
            shift_id=record.shift_id,
            reason=record.reason,
            method=record.method,
            amount=record.amount,
            cash_amount=record.cash_amount,
            transfer_amount=record.transfer_amount,
            reference=record.reference,
            created_at=record.created_at,
            performed_by_user_id=record.performed_by_user_id,
            items=[
                ReturnItemRead.model_validate(row)
                for row in self.session.scalars(
                    select(SaleReturnItem)
                    .where(SaleReturnItem.void_id == record.void_id)
                    .order_by(SaleReturnItem.sale_item_id)
                )
            ],
        )

    def void(
        self, sale_id: int, payload: VoidCreate, actor: Principal, key: str
    ) -> VoidRead:
        with self.session.begin():
            self._actor(actor, supervisor=True)
            operation = f"void:{sale_id}"
            existing, key_hash, digest = self._request(actor, operation, key, payload)
            if existing:
                result = self.void_detail(sale_id)
                assert result is not None
                return result
            sale = self.session.scalar(
                select(Sale).where(Sale.sale_id == sale_id).with_for_update()
            )
            if sale is None:
                raise ApplicationError(404, "not_found", "Sale not found")
            if self.void_detail(sale_id):
                raise conflict("sale_already_voided", "Sale already voided")
            payment = self.session.scalar(
                select(SalePayment).where(SalePayment.sale_id == sale_id)
            )
            if payment is None:
                raise conflict(
                    "payment_reconciliation_required",
                    "Historical sale requires payment reconciliation",
                )
            if (payment.method in {"transfer", "mixed"}) != (
                payload.reference is not None
            ):
                raise ApplicationError(
                    422,
                    "invalid_refund_reference",
                    "Provide a reference only for a transfer refund",
                )
            cash_refund = (
                payment.cash_amount
                if payment.cash_amount is not None
                else payment.amount
                if payment.method == "cash"
                else Decimal("0.00")
            )
            transfer_refund = payment.amount - cash_refund
            lines = list(
                self.session.scalars(
                    select(SaleItem)
                    .where(SaleItem.sale_id == sale_id)
                    .order_by(SaleItem.sale_item_id)
                )
            )
            returned = {
                item.sale_item_id: item.returned_quantity for item in payload.items
            }
            if (
                len(returned) != len(payload.items)
                or set(returned) != {line.sale_item_id for line in lines}
                or any(returned[line.sale_item_id] > line.quantity for line in lines)
            ):
                raise ApplicationError(
                    422,
                    "invalid_return",
                    "Specify actual returned quantities for every original line",
                )
            inventory = InventoryRepository(self.session)
            products = inventory.lock_products(
                {line.product_id for line in lines if returned[line.sale_item_id]}
            )
            now = datetime.now(UTC)
            record = SaleVoid(
                sale_id=sale_id,
                shift_id=None,
                amount=sale.total,
                cash_amount=cash_refund,
                transfer_amount=transfer_refund,
                method=payment.method,
                reference=payload.reference,
                reason=payload.reason,
                created_at=now,
                performed_by_user_id=actor.user_id,
            )
            self.repository.add(record)
            for line in lines:
                count = returned[line.sale_item_id]
                item = SaleReturnItem(
                    void_id=record.void_id,
                    sale_item_id=line.sale_item_id,
                    returned_quantity=count,
                )
                self.session.add(item)
                self.session.flush()
                if count:
                    product = products[line.product_id]
                    before = product.legacy_stock
                    if before is None or before < 0 or before + count > 2147483647:
                        raise conflict(
                            "stock_count_required",
                            "A valid stock count is required for returned goods",
                        )
                    product.legacy_stock = before + count
                    inventory.append_movement(
                        InventoryMovement(
                            product_id=line.product_id,
                            return_item_id=item.return_item_id,
                            movement_type="sale_return",
                            quantity=count,
                            stock_before=before,
                            stock_after=product.legacy_stock,
                            created_at=now,
                            performed_by_user_id=actor.user_id,
                            employee_id=sale.employee_id,
                        )
                    )
            self._remember(actor, operation, key_hash, digest, record.void_id)
            result = self.void_detail(sale_id)
            assert result is not None
            return result
