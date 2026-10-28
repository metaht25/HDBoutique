"""Atomic purchase registration and exactly-once complete inventory receipts."""

import json
from datetime import UTC, datetime
from decimal import Decimal
from hashlib import sha256
from typing import Literal, cast

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.identity.service import Principal
from app.modules.inventory.models import InventoryMovement
from app.modules.inventory.repository import InventoryRepository
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.repository import PurchaseRepository
from app.modules.purchases.schemas import (
    PurchaseCreate,
    PurchaseLineRead,
    PurchaseRead,
    PurchaseReceive,
)
from app.modules.purchases.workflow_models import PurchaseItemCost, PurchaseWorkflow

MAX_STOCK = 2147483647


def request_digest(payload: PurchaseCreate) -> str:
    values = payload.model_dump(mode="json")
    values["shipping_cost"] = format(payload.shipping_cost, ".2f")
    return sha256(
        json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class PurchaseService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = PurchaseRepository(session)
        self.inventory = InventoryRepository(session)

    def _employee(self, actor: Principal, requested: int | None) -> int:
        account = self.repository.account(actor.user_id)
        if (
            account is None
            or not account.is_active
            or account.role not in {"Administrator", "Manager"}
        ):
            raise ApplicationError(403, "permission_denied", "Permission denied")
        if account.employee_id is not None and requested not in (
            None,
            account.employee_id,
        ):
            raise ApplicationError(422, "employee_mismatch", "Use the account employee")
        employee_id = (
            account.employee_id if account.employee_id is not None else requested
        )
        if employee_id is None or not self.repository.employee_exists(employee_id):
            raise ApplicationError(
                422, "employee_required", "An existing employee is required"
            )
        return employee_id

    def _detail(self, purchase_id: int) -> PurchaseRead:
        purchase = self.repository.get_purchase(purchase_id)
        if purchase is None:
            raise ApplicationError(404, "not_found", "Purchase not found")
        workflow = self.repository.workflow(purchase_id)
        rows = self.repository.lines(purchase_id)
        items = [
            PurchaseLineRead(
                purchase_item_id=item.purchase_item_id,
                supplier_product_id=item.supplier_product_id,
                quantity=item.quantity,
                product_id=cost.product_id if cost else None,
                unit_cost=cost.unit_cost if cost else None,
                subtotal=cost.unit_cost * item.quantity if cost else None,
            )
            for item, cost in rows
        ]
        # Sin snapshots no se reconstruyen costes historicos con precios actuales.
        merchandise = (
            sum(
                (item.subtotal for item in items if item.subtotal is not None),
                Decimal("0.00"),
            )
            if items and all(item.subtotal is not None for item in items)
            else None
        )
        total = (
            merchandise + purchase.shipping_cost
            if merchandise is not None and purchase.shipping_cost is not None
            else None
        )
        return PurchaseRead(
            purchase_id=purchase.purchase_id,
            supplier_id=purchase.supplier_id,
            employee_id=purchase.employee_id,
            purchase_date=purchase.purchase_date,
            review_date=purchase.review_date,
            refill_date=purchase.refill_date,
            shipping_cost=purchase.shipping_cost,
            status=cast(Literal["registered", "received"], workflow.status)
            if workflow
            else None,
            created_by_user_id=workflow.created_by_user_id if workflow else None,
            created_at=workflow.created_at if workflow else None,
            received_at=workflow.received_at if workflow else None,
            received_by_user_id=workflow.received_by_user_id if workflow else None,
            received_employee_id=workflow.received_employee_id if workflow else None,
            items=items,
            merchandise_total=merchandise,
            total=total,
        )

    def get_purchase(self, purchase_id: int) -> PurchaseRead:
        with self.session.begin():
            return self._detail(purchase_id)

    def list_purchases(self, offset: int, limit: int) -> list[PurchaseRead]:
        with self.session.begin():
            return [
                self._detail(purchase.purchase_id)
                for purchase in self.repository.list_purchases(offset, limit)
            ]

    def register(
        self, payload: PurchaseCreate, actor: Principal, key: str
    ) -> PurchaseRead:
        key_hash, fingerprint = (
            sha256(key.encode()).hexdigest(),
            request_digest(payload),
        )
        try:
            with self.session.begin():
                self.repository.lock_idempotency(actor.user_id, key_hash)
                existing = self.repository.by_idempotency(actor.user_id, key_hash)
                if existing is not None:
                    if existing.request_hash != fingerprint:
                        raise ApplicationError(
                            409,
                            "idempotency_conflict",
                            "Key already used for another request",
                        )
                    return self._detail(existing.purchase_id)
                employee_id = self._employee(actor, payload.employee_id)
                if not self.repository.supplier_exists(payload.supplier_id):
                    raise ApplicationError(
                        422, "invalid_reference", "Supplier not found"
                    )
                # Orden global tambien para precios/ofertas compartidos por compras.
                products = {}
                for line in sorted(
                    payload.items, key=lambda item: item.supplier_product_id
                ):
                    product = self.repository.offered_product(
                        payload.supplier_id, line.supplier_product_id
                    )
                    if product is None:
                        raise ApplicationError(
                            422,
                            "invalid_offering",
                            "Supplier product is not offered by this supplier",
                        )
                    if product.purchase_price < 0:
                        raise ApplicationError(
                            422, "invalid_cost", "Purchase cost cannot be negative"
                        )
                    products[line.supplier_product_id] = product
                purchase = Purchase(
                    supplier_id=payload.supplier_id,
                    employee_id=employee_id,
                    purchase_date=payload.purchase_date,
                    review_date=payload.review_date,
                    refill_date=payload.refill_date,
                    shipping_cost=payload.shipping_cost,
                )
                self.repository.add_purchase(purchase)
                for line in payload.items:
                    item = PurchaseItem(
                        purchase_id=purchase.purchase_id,
                        supplier_product_id=line.supplier_product_id,
                        quantity=line.quantity,
                    )
                    self.repository.add_line(item)
                    product = products[line.supplier_product_id]
                    self.repository.add_cost(
                        PurchaseItemCost(
                            purchase_item_id=item.purchase_item_id,
                            product_id=product.product_id,
                            unit_cost=product.purchase_price,
                        )
                    )
                self.repository.add_workflow(
                    PurchaseWorkflow(
                        purchase_id=purchase.purchase_id,
                        status="registered",
                        created_by_user_id=actor.user_id,
                        created_at=datetime.now(UTC),
                        idempotency_hash=key_hash,
                        request_hash=fingerprint,
                        received_at=None,
                        received_by_user_id=None,
                        received_employee_id=None,
                    )
                )
                return self._detail(purchase.purchase_id)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting purchase data"
            ) from error

    def receive(
        self, purchase_id: int, payload: PurchaseReceive, actor: Principal
    ) -> PurchaseRead:
        try:
            with self.session.begin():
                workflow = self.repository.workflow(purchase_id, lock=True)
                if workflow is None:
                    if self.repository.get_purchase(purchase_id) is None:
                        raise ApplicationError(404, "not_found", "Purchase not found")
                    raise ApplicationError(
                        409,
                        "legacy_purchase",
                        "Legacy purchase requires reconciliation",
                    )
                if workflow.status == "received":
                    return self._detail(purchase_id)
                employee_id = self._employee(actor, payload.employee_id)
                rows = self.repository.lines(purchase_id)
                if not rows or any(
                    cost is None or item.quantity <= 0 for item, cost in rows
                ):
                    raise ApplicationError(
                        409,
                        "incomplete_purchase",
                        "Purchase has no valid cost snapshots",
                    )
                products = self.inventory.lock_products(
                    {cost.product_id for _, cost in rows if cost is not None}
                )
                now = datetime.now(UTC)
                for item, cost in rows:
                    assert cost is not None
                    product = products.get(cost.product_id)
                    if (
                        product is None
                        or product.legacy_stock is None
                        or product.legacy_stock < 0
                    ):
                        raise ApplicationError(
                            409,
                            "stock_count_required",
                            "A valid explicit stock count is required",
                        )
                    before = product.legacy_stock
                    after = before + item.quantity
                    if after > MAX_STOCK:
                        raise ApplicationError(
                            409, "stock_overflow", "Stock exceeds the supported range"
                        )
                    product.legacy_stock = after
                    self.inventory.append_movement(
                        InventoryMovement(
                            product_id=product.product_id,
                            purchase_item_id=item.purchase_item_id,
                            movement_type="purchase_receipt",
                            quantity=item.quantity,
                            stock_before=before,
                            stock_after=after,
                            created_at=now,
                            performed_by_user_id=actor.user_id,
                            employee_id=employee_id,
                        )
                    )
                workflow.status = "received"
                workflow.received_at = now
                workflow.received_by_user_id = actor.user_id
                workflow.received_employee_id = employee_id
                self.session.flush()
                return self._detail(purchase_id)
        except IntegrityError as error:
            raise ApplicationError(
                409, "integrity_conflict", "Conflicting receipt data"
            ) from error
