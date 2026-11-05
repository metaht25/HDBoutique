"""Concrete purchase persistence with explicit row and idempotency locks."""

from hashlib import sha256

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modules.identity.models import UserAccount
from app.modules.purchases.models import Purchase, PurchaseItem
from app.modules.purchases.workflow_models import PurchaseItemCost, PurchaseWorkflow
from app.modules.staff.models import Employee
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct


class PurchaseRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def lock_idempotency(self, actor_id: int, key_hash: str) -> None:
        value = int.from_bytes(
            sha256(f"purchase:{actor_id}:{key_hash}".encode()).digest()[:8], signed=True
        )
        self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": value})

    def by_idempotency(self, actor_id: int, key_hash: str) -> PurchaseWorkflow | None:
        return self.session.scalar(
            select(PurchaseWorkflow).where(
                PurchaseWorkflow.created_by_user_id == actor_id,
                PurchaseWorkflow.idempotency_hash == key_hash,
            )
        )

    def account(self, user_id: int) -> UserAccount | None:
        return self.session.get(UserAccount, user_id)

    def employee_exists(self, employee_id: int) -> bool:
        record = self.session.get(Employee, employee_id)
        return record is not None and record.is_active

    def supplier_exists(self, supplier_id: int) -> bool:
        record = self.session.get(Supplier, supplier_id)
        return record is not None and record.is_active

    def offered_product(
        self, supplier_id: int, supplier_product_id: int
    ) -> SupplierProduct | None:
        product = self.session.scalar(
            select(SupplierProduct)
            .where(
                SupplierProduct.supplier_product_id == supplier_product_id,
            )
            .with_for_update()
        )
        offering = self.session.scalar(
            select(SupplierOffering)
            .where(
                SupplierOffering.supplier_id == supplier_id,
                SupplierOffering.supplier_product_id == supplier_product_id,
            )
            .order_by(SupplierOffering.offering_id)
            .limit(1)
            .with_for_update(read=True)
        )
        return product if offering is not None else None

    def add_purchase(self, record: Purchase) -> None:
        self.session.add(record)
        self.session.flush()

    def add_line(self, record: PurchaseItem) -> None:
        self.session.add(record)
        self.session.flush()

    def add_cost(self, record: PurchaseItemCost) -> None:
        self.session.add(record)
        self.session.flush()

    def add_workflow(self, record: PurchaseWorkflow) -> None:
        self.session.add(record)
        self.session.flush()

    def get_purchase(self, purchase_id: int) -> Purchase | None:
        return self.session.get(Purchase, purchase_id)

    def workflow(
        self, purchase_id: int, *, lock: bool = False
    ) -> PurchaseWorkflow | None:
        statement = select(PurchaseWorkflow).where(
            PurchaseWorkflow.purchase_id == purchase_id
        )
        if lock:
            statement = statement.with_for_update()
        return self.session.scalar(statement)

    def lines(
        self, purchase_id: int
    ) -> list[tuple[PurchaseItem, PurchaseItemCost | None]]:
        return self.lines_for_purchases([purchase_id]).get(purchase_id, [])

    def lines_for_purchases(
        self, purchase_ids: list[int]
    ) -> dict[int, list[tuple[PurchaseItem, PurchaseItemCost | None]]]:
        rows = self.session.execute(
            select(PurchaseItem, PurchaseItemCost)
            .outerjoin(
                PurchaseItemCost,
                PurchaseItemCost.purchase_item_id == PurchaseItem.purchase_item_id,
            )
            .where(PurchaseItem.purchase_id.in_(purchase_ids))
            .order_by(PurchaseItem.purchase_item_id)
        )
        grouped: dict[int, list[tuple[PurchaseItem, PurchaseItemCost | None]]] = {}
        for item, cost in rows:
            grouped.setdefault(item.purchase_id, []).append((item, cost))
        return grouped

    def workflows(self, purchase_ids: list[int]) -> dict[int, PurchaseWorkflow]:
        return {
            row.purchase_id: row
            for row in self.session.scalars(
                select(PurchaseWorkflow).where(
                    PurchaseWorkflow.purchase_id.in_(purchase_ids)
                )
            )
        }

    def list_purchases(self, offset: int, limit: int) -> list[Purchase]:
        return list(
            self.session.scalars(
                select(Purchase)
                .order_by(Purchase.purchase_id)
                .offset(offset)
                .limit(limit)
            )
        )
