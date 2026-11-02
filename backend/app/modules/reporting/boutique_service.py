"""Read-only snapshot transactions for screen summaries and paginated results."""

from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

from sqlalchemy import Connection, func, select, text
from sqlalchemy.orm import Session

from app.modules.identity.service import Principal
from app.modules.reporting.boutique_repository import BoutiqueReportingRepository
from app.modules.reporting.schemas import DateRange
from app.modules.reporting.service import report_context
from app.modules.suppliers.models import Supplier, SupplierOffering, SupplierProduct


def summary_values(values: dict[str, Any]) -> dict[str, int | str | None]:
    return {
        key: int(value)
        if key in {"units", "today_units", "month_units"} and value is not None
        else format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), ".2f")
        if isinstance(value, Decimal)
        else value
        for key, value in values.items()
    }


class BoutiqueReportingService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = BoutiqueReportingRepository(session)

    def _snapshot(self) -> None:
        # A caller-owned transaction must already provide snapshot isolation.
        if (
            isinstance(self.session.bind, Connection)
            and self.session.bind.in_transaction()
        ):
            if self.session.bind.get_isolation_level() not in {
                "REPEATABLE READ",
                "SERIALIZABLE",
            }:
                raise RuntimeError("Reports require a repeatable external transaction")
            return
        self.session.execute(
            text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        )

    def directory(
        self,
        resource: Literal["products", "customers", "suppliers", "employees"],
        actor: Principal,
        q: str | None,
        status: str | None,
        reference_id: int | None,
        offset: int,
        limit: int,
    ) -> dict[str, Any]:
        context = report_context(DateRange())
        with self.session.begin():
            self._snapshot()
            if resource == "products":
                summary, items = self.repository.products(
                    actor.role == "Administrator",
                    q,
                    reference_id,
                    status,
                    offset,
                    limit,
                )
                if actor.role == "Administrator" and items:
                    relations = self.session.execute(
                        select(
                            SupplierProduct.product_id,
                            Supplier.company_name,
                            SupplierProduct.purchase_price,
                        )
                        .join(
                            SupplierOffering,
                            SupplierOffering.supplier_product_id
                            == SupplierProduct.supplier_product_id,
                        )
                        .join(
                            Supplier,
                            Supplier.supplier_id == SupplierOffering.supplier_id,
                        )
                        .where(
                            SupplierProduct.product_id.in_(
                                [row["product_id"] for row in items]
                            )
                        )
                        .distinct()
                    ).all()
                    for row in items:
                        row["suppliers"] = [
                            f"{name}: C$ {cost:.2f}"
                            for product_id, name, cost in relations
                            if product_id == row["product_id"]
                        ]
            elif resource == "customers":
                summary, items = self.repository.customer_directory(
                    q,
                    reference_id,
                    status,
                    context.business_date.replace(day=1),
                    offset,
                    limit,
                )
            elif resource == "suppliers":
                summary, items = self.repository.suppliers(q, status, offset, limit)
            else:
                summary, items = self.repository.employees(q, status, offset, limit)
            return {
                "context": context,
                "summary": summary_values(summary),
                "items": items,
                "offset": offset,
                "limit": limit,
            }

    def sales(
        self,
        actor: Principal,
        period: DateRange,
        q: str | None,
        customer: str | None,
        method: str | None,
        status: str | None,
        receipts: bool,
        offset: int,
        limit: int,
    ) -> dict[str, Any]:
        context = report_context(period)
        with self.session.begin():
            self._snapshot()
            base = self.repository.sales_base(
                actor.user_id if actor.role == "Cashier" else None,
                period.start_date,
                period.end_date,
                q,
                customer,
                method,
                status,
                receipts,
            )
            summary, items = self.repository.ledger(
                base, context.business_date, offset, limit
            )
            return {
                "context": context,
                "summary": summary_values(summary),
                "items": items,
                "offset": offset,
                "limit": limit,
                "methods": self.repository.payment_groups(base),
                "best_products": self.repository.best_products(base)
                if actor.role == "Administrator"
                else [],
            }

    def purchases(
        self,
        period: DateRange,
        q: str | None,
        supplier_id: int | None,
        status: str | None,
        offset: int,
        limit: int,
    ) -> dict[str, Any]:
        context = report_context(period)
        with self.session.begin():
            self._snapshot()
            summary, items = self.repository.purchase_ledger(
                q,
                supplier_id,
                period.start_date,
                period.end_date,
                status,
                context.business_date,
                offset,
                limit,
            )
            return {
                "context": context,
                "summary": summary_values(summary),
                "items": items,
                "offset": offset,
                "limit": limit,
            }

    def overview(
        self, actor: Principal, period: Literal["week", "month", "year"]
    ) -> dict[str, Any]:
        context = report_context(DateRange())
        today = context.business_date
        start = (
            today - timedelta(days=today.weekday())
            if period == "week"
            else today.replace(day=1)
            if period == "month"
            else date(today.year, 1, 1)
        )
        context.start_date, context.end_date = start, today
        with self.session.begin():
            self._snapshot()
            base = self.repository.sales_base(
                actor.user_id if actor.role == "Cashier" else None
            )
            valid = base.c.status != "voided"
            aggregate = select(
                func.coalesce(
                    func.sum(base.c.total).filter(valid & (base.c.sale_date == today)),
                    0,
                ).label("today_amount"),
                func.count()
                .filter(valid & (base.c.sale_date == today))
                .label("today_count"),
                func.coalesce(
                    func.sum(base.c.units).filter(valid & (base.c.sale_date == today)),
                    0,
                ).label("today_units"),
                func.coalesce(
                    func.sum(base.c.total).filter(
                        valid & base.c.sale_date.between(today.replace(day=1), today)
                    ),
                    0,
                ).label("month_amount"),
                func.coalesce(
                    func.sum(base.c.units).filter(
                        valid & base.c.sale_date.between(today.replace(day=1), today)
                    ),
                    0,
                ).label("month_units"),
                func.count()
                .filter(valid & base.c.sale_date.between(today.replace(day=1), today))
                .label("month_count"),
                func.coalesce(
                    func.sum(base.c.total).filter(
                        valid & base.c.sale_date.between(start, today)
                    ),
                    0,
                ).label("period_amount"),
                func.count()
                .filter(valid & base.c.sale_date.between(start, today))
                .label("period_count"),
            ).select_from(base)
            summary = dict(self.session.execute(aggregate).mappings().one())
            stock_summary, low_stock = self.repository.products(
                False, None, None, "low_stock", 0, 5
            )
            summary["low_stock"] = stock_summary["total_count"]
            recent = [
                dict(row)
                for row in self.session.execute(
                    select(base)
                    .order_by(base.c.sale_date.desc(), base.c.sale_id.desc())
                    .limit(5)
                ).mappings()
            ]
            return {
                "context": context,
                "summary": summary_values(summary),
                "recent_sales": recent,
                "low_stock": low_stock,
                "period": period,
            }
