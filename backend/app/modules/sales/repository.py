"""Sale persistence with transaction-scoped idempotency locks; no commits."""

from hashlib import sha256

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.modules.customers.models import Customer
from app.modules.identity.models import UserAccount
from app.modules.sales.models import Sale, SaleItem
from app.modules.sales.workflow_models import SaleWorkflow
from app.modules.staff.models import Employee


class SaleRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def lock_idempotency(self, actor_id: int, key_hash: str) -> None:
        value = int.from_bytes(
            sha256(f"sale:{actor_id}:{key_hash}".encode()).digest()[:8], signed=True
        )
        self.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": value})

    def by_idempotency(self, actor_id: int, key_hash: str) -> SaleWorkflow | None:
        return self.session.scalar(
            select(SaleWorkflow).where(
                SaleWorkflow.created_by_user_id == actor_id,
                SaleWorkflow.idempotency_hash == key_hash,
            )
        )

    def account(self, user_id: int) -> UserAccount | None:
        return self.session.get(UserAccount, user_id)

    def employee_exists(self, employee_id: int) -> bool:
        record = self.session.get(Employee, employee_id)
        return record is not None and record.is_active

    def customer_exists(self, customer_id: int) -> bool:
        record = self.session.get(Customer, customer_id)
        return record is not None and record.is_active

    def add_sale(self, record: Sale) -> None:
        self.session.add(record)
        self.session.flush()

    def add_line(self, record: SaleItem) -> None:
        self.session.add(record)
        self.session.flush()

    def add_workflow(self, record: SaleWorkflow) -> None:
        self.session.add(record)
        self.session.flush()

    def get_sale(self, sale_id: int) -> Sale | None:
        return self.session.get(Sale, sale_id)

    def workflow(self, sale_id: int) -> SaleWorkflow | None:
        return self.session.get(SaleWorkflow, sale_id)

    def lines(self, sale_id: int) -> list[SaleItem]:
        return list(
            self.session.scalars(
                select(SaleItem)
                .where(SaleItem.sale_id == sale_id)
                .order_by(SaleItem.sale_item_id)
            )
        )

    def list_sales(
        self, offset: int, limit: int, user_id: int | None = None
    ) -> list[Sale]:
        query = select(Sale)
        if user_id is not None:
            query = query.join(SaleWorkflow).where(
                SaleWorkflow.created_by_user_id == user_id
            )
        return list(
            self.session.scalars(
                query.order_by(Sale.sale_id.desc()).offset(offset).limit(limit)
            )
        )
