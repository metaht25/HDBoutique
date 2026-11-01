"""Atomic cash shifts, full payment and supervised whole-sale corrections."""

import json
from datetime import UTC, datetime
from decimal import Decimal
from hashlib import sha256

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.cash.models import (
    CashMovement,
    CashRequest,
    CashShift,
    SalePayment,
    SaleReturnItem,
    SaleVoid,
)
from app.modules.cash.repository import CashRepository
from app.modules.cash.schemas import (
    MovementCreate,
    MovementRead,
    PaymentCreate,
    ReturnItemRead,
    ShiftClose,
    ShiftOpen,
    ShiftRead,
    VoidCreate,
    VoidRead,
)
from app.modules.identity.models import UserAccount
from app.modules.identity.service import Principal
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.sales.models import Sale, SaleItem
from app.modules.staff.models import Employee


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
        digest = sha256(
            json.dumps(
                payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
        self.repository.lock_request(actor.user_id, operation, key_hash)
        existing = self.repository.request(actor.user_id, operation, key_hash)
        if existing and existing.request_hash != digest:
            raise conflict(
                "idempotency_conflict", "Key already used for another request"
            )
        self.repository.lock_register()
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

    def lock_shift(
        self, shift_id: int, actor: Principal, *, employee_id: int | None = None
    ) -> CashShift:
        account = self._actor(actor)
        self.repository.lock_register()
        shift = self.repository.shift(shift_id)
        if shift is None:
            raise ApplicationError(404, "not_found", "Cash shift not found")
        if account.role == "Cashier" and shift.opened_by_user_id != actor.user_id:
            raise ApplicationError(403, "permission_denied", "Use your own cash shift")
        if shift.closed_at is not None:
            raise conflict("shift_closed", "Cash shift is closed")
        if employee_id is not None and employee_id != shift.employee_id:
            raise ApplicationError(
                422, "employee_mismatch", "Use the cash shift employee"
            )
        return shift

    def _read(self, shift_id: int, actor: Principal) -> ShiftRead:
        account = self._actor(actor)
        shift = self.session.get(CashShift, shift_id)
        if shift is None:
            raise ApplicationError(404, "not_found", "Cash shift not found")
        if account.role == "Cashier" and shift.opened_by_user_id != actor.user_id:
            raise ApplicationError(403, "permission_denied", "Permission denied")
        totals = self.repository.totals(shift_id)
        expected = (
            shift.opening_amount
            + totals["cash_collected"]
            - totals["cash_refunded"]
            + totals["deposit"]
            - totals["withdrawal"]
        )
        return ShiftRead(
            shift_id=shift_id,
            employee_id=shift.employee_id,
            opened_by_user_id=shift.opened_by_user_id,
            opened_at=shift.opened_at,
            opening_amount=shift.opening_amount,
            status="closed" if shift.closed_at else "open",
            cash_collected=totals["cash_collected"],
            transfers_collected=totals["transfer_collected"],
            cash_refunded=totals["cash_refunded"],
            transfers_refunded=totals["transfer_refunded"],
            deposits=totals["deposit"],
            withdrawals=totals["withdrawal"],
            expected_amount=shift.expected_amount if shift.closed_at else expected,
            counted_amount=shift.counted_amount,
            difference=shift.difference,
            closed_at=shift.closed_at,
            closed_by_user_id=shift.closed_by_user_id,
            closing_reason=shift.closing_reason,
            movements=[
                MovementRead.model_validate(row)
                for row in self.session.scalars(
                    select(CashMovement)
                    .where(CashMovement.shift_id == shift_id)
                    .order_by(CashMovement.movement_id)
                )
            ],
        )

    def list_shifts(self, actor: Principal, offset: int, limit: int) -> list[ShiftRead]:
        with self.session.begin():
            account = self._actor(actor)
            query = (
                select(CashShift.shift_id)
                .order_by(CashShift.shift_id.desc())
                .offset(offset)
                .limit(limit)
            )
            if account.role == "Cashier":
                query = query.where(CashShift.opened_by_user_id == actor.user_id)
            # Serialize aggregate reads with commands for a consistent cash count.
            self.repository.lock_register()
            return [
                self._read(shift_id, actor) for shift_id in self.session.scalars(query)
            ]

    def open(self, payload: ShiftOpen, actor: Principal, key: str) -> ShiftRead:
        try:
            with self.session.begin():
                account = self._actor(actor)
                existing, key_hash, digest = self._request(actor, "open", key, payload)
                if existing:
                    return self._read(existing.result_id, actor)
                if self.session.scalar(
                    select(CashShift.shift_id).where(CashShift.closed_at.is_(None))
                ):
                    raise conflict(
                        "shift_already_open",
                        "Close the current shift before opening another",
                    )
                employee_id = (
                    account.employee_id
                    if account.employee_id is not None
                    else payload.employee_id
                )
                if account.employee_id is not None and payload.employee_id not in (
                    None,
                    account.employee_id,
                ):
                    raise ApplicationError(
                        422, "employee_mismatch", "Use the account employee"
                    )
                employee = (
                    self.session.get(Employee, employee_id) if employee_id else None
                )
                if employee is None or not employee.is_active:
                    raise ApplicationError(
                        422, "employee_required", "An existing employee is required"
                    )
                shift = CashShift(
                    register_code="main",
                    employee_id=employee_id,
                    opened_by_user_id=actor.user_id,
                    opened_at=datetime.now(UTC),
                    opening_amount=payload.opening_amount,
                )
                self.repository.add(shift)
                self._remember(actor, "open", key_hash, digest, shift.shift_id)
                return self._read(shift.shift_id, actor)
        except IntegrityError as error:
            raise conflict(
                "integrity_conflict", "Conflicting cash shift data"
            ) from error

    def close(
        self, shift_id: int, payload: ShiftClose, actor: Principal, key: str
    ) -> ShiftRead:
        with self.session.begin():
            self._actor(actor)
            operation = f"close:{shift_id}"
            existing, key_hash, digest = self._request(actor, operation, key, payload)
            if existing:
                return self._read(existing.result_id, actor)
            shift = self.lock_shift(shift_id, actor)
            expected = self.repository.expected(shift)
            difference = payload.counted_amount - expected
            if difference != 0:
                self._actor(actor, supervisor=True)
                if not payload.reason:
                    raise ApplicationError(
                        422,
                        "reason_required",
                        "A reason is required for a cash difference",
                    )
            shift.counted_amount, shift.expected_amount, shift.difference = (
                payload.counted_amount,
                expected,
                difference,
            )
            shift.closed_at, shift.closed_by_user_id = datetime.now(UTC), actor.user_id
            shift.closing_reason = payload.reason
            self.session.flush()
            self._remember(actor, operation, key_hash, digest, shift_id)
            return self._read(shift_id, actor)

    def move(
        self, shift_id: int, payload: MovementCreate, actor: Principal, key: str
    ) -> ShiftRead:
        with self.session.begin():
            self._actor(actor, supervisor=True)
            operation = f"move:{shift_id}"
            existing, key_hash, digest = self._request(actor, operation, key, payload)
            if existing:
                return self._read(existing.result_id, actor)
            shift = self.lock_shift(shift_id, actor)
            if (
                payload.kind == "withdrawal"
                and self.repository.expected(shift) < payload.amount
            ):
                raise conflict("insufficient_cash", "Insufficient cash for withdrawal")
            self.repository.add(
                CashMovement(
                    shift_id=shift_id,
                    kind=payload.kind,
                    amount=payload.amount,
                    reason=payload.reason,
                    created_at=datetime.now(UTC),
                    performed_by_user_id=actor.user_id,
                )
            )
            self._remember(actor, operation, key_hash, digest, shift_id)
            return self._read(shift_id, actor)

    def collect(
        self, sale_id: int, total: Decimal, payload: PaymentCreate, actor: Principal
    ) -> None:
        # Called only inside the sale transaction after locking its shift.
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
                shift_id=payload.shift_id,
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
            shift = self.lock_shift(payload.shift_id, actor)
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
            if self.repository.expected(shift) < cash_refund:
                raise conflict(
                    "insufficient_cash", "Insufficient cash for the full refund"
                )
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
                shift_id=shift.shift_id,
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
                            employee_id=shift.employee_id,
                        )
                    )
            self._remember(actor, operation, key_hash, digest, record.void_id)
            result = self.void_detail(sale_id)
            assert result is not None
            return result
